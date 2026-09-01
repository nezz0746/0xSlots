// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice The slice of Superfluid this repo talks to, declared locally.
///
/// @dev Same reasoning as `IManagedSlot` in SlotGovernance.sol: we compile
///      against a signature list, not against someone else's implementation.
///      Vendoring `superfluid-finance/ethereum-contracts` would pull a large
///      dependency tree — the host, all three agreements, the token factory,
///      their own OpenZeppelin pin — to use four functions across an ABI
///      boundary that never changes.
///
///      The risk of hand-declaring is that a signature is wrong and only fails
///      at runtime. That is exactly what `test/SlotStreamCollective.t.sol`
///      exists to rule out: it runs against the REAL forwarder and the REAL
///      ETHx on a Base fork, so a wrong selector or a mis-decoded return value
///      fails the suite rather than the mainnet deployment.

/// @notice A GDA distribution pool. Members hold `units`; anything distributed
///         to the pool splits pro-rata by units.
///
/// @dev The direct analogue of a 0xSplits `Split`: `units` are `allocations`,
///      and `getTotalUnits()` is `totalAllocation`. The difference is WHEN the
///      arithmetic happens — a split divides a lump sum at `distribute()` time,
///      a pool tracks a per-unit index continuously, which is what lets it
///      express a *stream* rather than only a payment.
interface ISuperfluidPool {
    /// @notice Set a member's share. Pool admin only.
    /// @dev Raising total units dilutes every other member, exactly as
    ///      rewriting a split's allocations does.
    function updateMemberUnits(address memberAddr, uint128 newUnits)
        external
        returns (bool);

    function getUnits(address memberAddr) external view returns (uint128);

    function getTotalUnits() external view returns (uint128);

    /// @notice Sweep a member's accrued balance to their wallet.
    /// @dev Needed only for members who have NOT called `connectPool`. A
    ///      connected member sees the balance in `superToken.balanceOf`
    ///      directly, with nothing to claim.
    function claimAll(address memberAddr) external returns (bool);

    function getClaimableNow(address memberAddr)
        external
        view
        returns (int256 claimableBalance, uint256 timestamp);

    /// @notice Lifetime total this member has received from the pool.
    function getTotalAmountReceivedByMember(address memberAddr)
        external
        view
        returns (uint256);

    function admin() external view returns (address);

    function superToken() external view returns (address);
}

/// @notice The forwarder is the trusted entry point for GDA calls.
///
/// @dev Deliberately NOT the host or the agreement directly. `GDAv1Forwarder`
///      is deployed at the same address on every Superfluid chain and wraps the
///      host's `callAgreement` ceremony, so this contract needs no knowledge of
///      agreement class IDs or the ABI-encoded call payloads the host expects.
interface IGDAv1Forwarder {
    struct PoolConfig {
        /// @dev Whether members may transfer their own units.
        bool transferabilityForUnitsOwner;
        /// @dev Whether addresses other than the pool admin may distribute in.
        bool distributionFromAnyAddress;
    }

    function createPool(address token, address admin, PoolConfig memory config)
        external
        returns (bool success, ISuperfluidPool pool);

    /// @notice One-off distribution of `requestedAmount` from `from` to `pool`.
    function distribute(
        address token,
        address from,
        address pool,
        uint256 requestedAmount,
        bytes calldata userData
    ) external returns (bool);

    /// @notice Open, change, or close a continuous stream into `pool`.
    /// @dev A rate of 0 closes it. The rate is per SECOND, in the token's
    ///      smallest unit — see `SlotStreamCollective.setFlowRate`.
    function distributeFlow(
        address token,
        address from,
        address pool,
        int96 requestedFlowRate,
        bytes calldata userData
    ) external returns (bool);

    /// @notice The amount that would actually land, after the pool rounds the
    ///         request down to something divisible by total units.
    function estimateDistributionActualAmount(
        address token,
        address from,
        address to,
        uint256 requestedAmount
    ) external view returns (uint256);

    function getFlowDistributionFlowRate(address token, address from, address to)
        external
        view
        returns (int96);
}

/// @notice A SuperToken. ERC-20 on the surface, with wrap/unwrap underneath.
///
/// @dev The reason this whole variant needs a currency of its own: Superfluid
///      can only move SuperTokens. A slot's tax arrives as whatever the slot's
///      `currency` is — plain ERC-20, or native ETH — so something has to
///      bridge the two. See `SlotStreamCollective._wrap`.
interface ISuperToken is IERC20 {
    /// @notice Wrap `amount` of the underlying, held by the caller.
    /// @dev `amount` is in SUPERTOKEN decimals (always 18), not the
    ///      underlying's. For a 6-decimal underlying like USDC, upgrading
    ///      1e18 pulls 1e6. Getting this backwards silently moves a millionth
    ///      of the intended amount, which is why the scale factor is computed
    ///      once and stored — see `UPGRADE_SCALE`.
    function upgrade(uint256 amount) external;

    /// @notice Wrap the attached native value. Only on native wrappers (ETHx).
    function upgradeByETH() external payable;

    function downgrade(uint256 amount) external;

    /// @notice `address(0)` for native wrappers AND for pure SuperTokens.
    function getUnderlyingToken() external view returns (address);
}
