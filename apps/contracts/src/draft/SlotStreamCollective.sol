// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {SlotGovernance} from "../SlotGovernance.sol";
import {
    IGDAv1Forwarder,
    ISuperfluidPool,
    ISuperToken
} from "./interfaces/ISuperfluid.sol";

/// @title SlotStreamCollective — a collective that pays out through a Superfluid pool
///
/// @notice The same control panel as `SlotCollective`, with the 0xSplits half
///         swapped for a Superfluid General Distribution Agreement pool.
///
///         Members hold `units` instead of `allocations`, and the collective can
///         pay them two ways:
///
///           `distribute()`  — hand the pool everything held right now, split
///                             pro-rata by units. The split's behaviour.
///           `setFlowRate()` — open a continuous stream into the pool, so every
///                             member's balance rises every second, with no
///                             transaction per payout and no one to call it.
///
/// @dev ── WHY THIS EXISTS ALONGSIDE THE SPLIT ─────────────────────────────
///      A Harberger slot takes tax CONTINUOUSLY — that is the whole mechanism.
///      A split can only ever pay out DISCRETELY: money piles up until somebody
///      pays gas to call `distribute()`, and until they do, recipients own a
///      claim rather than a balance. This variant closes that mismatch: money
///      arrives by the second and can leave by the second.
///
///      The cost is a hard constraint the split does not have — see below.
///
///      ── THE CONSTRAINT: SUPERFLUID ONLY MOVES SUPERTOKENS ────────────────
///      A slot's tax arrives as whatever that slot's `currency` is: an ordinary
///      ERC-20, or native ETH. Superfluid cannot stream either. So this
///      collective is bound at construction to ONE SuperToken and knows how to
///      convert into it — see `_wrap`. Three shapes work:
///
///        SuperToken       slot currency      what `_wrap` does
///        ─────────────────────────────────────────────────────────
///        ETHx (native)    native ETH         upgradeByETH{value: bal}
///        USDCx (wrapper)  USDC               approve + upgrade
///        pure SuperToken  that SuperToken    nothing — already correct
///
///      A collective can therefore serve many slots, but only slots paying in a
///      currency it can convert. The split has no such rule: it distributes any
///      token you name, per call. That difference is the main thing to weigh
///      when choosing between the two.
///
///      ── WHY THE FORWARDER, NOT THE HOST ─────────────────────────────────
///      `GDAv1Forwarder` is deployed at one address across every Superfluid
///      chain and wraps the host's `callAgreement` encoding. Going through the
///      host directly would mean this contract carrying agreement class IDs and
///      hand-built call payloads for no benefit.
///
///      ── WHY THERE IS NO `execCalls` PROBLEM HERE ────────────────────────
///      `SlotCollective` has to pin its owner to itself, because `SplitWalletV2`
///      inherits an ownable arbitrary-call multicall that would bypass every
///      role. Nothing in this contract's inheritance has that hazard: the only
///      base is `SlotGovernance`, which is roles and relays. There is no owner
///      to seal, which is one less thing that can go wrong.
contract SlotStreamCollective is SlotGovernance {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════
    // ROLES
    // ═══════════════════════════════════════════════════════════

    /// @notice May rewrite who is in the pool and how many units they hold,
    ///         open and close the stream, and pause distribution.
    ///
    /// @dev The exact counterpart of `SlotCollective.SPLIT_MANAGER_ROLE`, under
    ///      its own name because it governs a different object. Deliberately not
    ///      hoisted into `SlotGovernance` as one shared `PAYOUT_MANAGER_ROLE` —
    ///      see the note there on why renaming a live role identifier silently
    ///      strips its holders.
    bytes32 public constant POOL_MANAGER_ROLE = keccak256("POOL_MANAGER_ROLE");

    // ═══════════════════════════════════════════════════════════
    // IMMUTABLES
    // ═══════════════════════════════════════════════════════════

    /// @notice The chain's canonical GDA forwarder.
    IGDAv1Forwarder public immutable GDA;

    /// @notice The one token this collective distributes.
    ISuperToken public immutable SUPER_TOKEN;

    /// @notice `SUPER_TOKEN`'s underlying, or `address(0)` for a native wrapper
    ///         and for a pure SuperToken.
    address public immutable UNDERLYING;

    /// @notice Multiplier from underlying units to SuperToken units.
    ///
    /// @dev SuperTokens are always 18 decimals; their underlying need not be.
    ///      `upgrade(amount)` takes `amount` in SUPERTOKEN decimals and pulls
    ///      `amount / 10**(18 - underlyingDecimals)` of the underlying — so
    ///      wrapping a raw USDC balance of 1e6 means calling `upgrade(1e18)`,
    ///      not `upgrade(1e6)`. Passing the raw balance would wrap a millionth
    ///      of it and silently strand the rest. Computed once here so the
    ///      conversion cannot be forgotten at a call site.
    uint256 public immutable UPGRADE_SCALE;

    /// @notice Whether `SUPER_TOKEN` is a native wrapper (ETHx / SETH).
    ///
    /// @dev Passed in rather than detected. A native wrapper and a pure
    ///      SuperToken both report `getUnderlyingToken() == address(0)`, and
    ///      there is no reliable on-chain probe to tell them apart — ETHx is a
    ///      proxy, so scanning its bytecode for `upgradeByETH` finds nothing.
    ///      Guessing wrong would brick `distribute()` the moment any ETH landed
    ///      here, so the deployer states it and the constructor checks the one
    ///      thing it can: that a native wrapper has no ERC-20 underlying.
    bool public immutable NATIVE_WRAPPER;

    // ═══════════════════════════════════════════════════════════
    // STORAGE
    // ═══════════════════════════════════════════════════════════

    /// @notice The distribution pool. Created during initialization, never
    ///         replaced.
    ///
    /// @dev Immutable in spirit but not in fact: it cannot be an `immutable`
    ///      because it is created by an external call during `initialize`, and
    ///      a proxy's constructor does not run against proxy storage. Replacing
    ///      it later is deliberately not offered — members' accrued balances
    ///      live in the pool, and swapping pools would orphan them.
    ISuperfluidPool public pool;

    /// @notice When true, `distribute()` reverts.
    ///
    /// @dev Parity with `SplitWalletV2.paused`. Note it does NOT stop an open
    ///      stream — a stream is a standing agreement inside Superfluid, not a
    ///      call through this contract, so stopping it is `setFlowRate(0)`.
    ///      Pausing something you cannot pause is worse than not offering it,
    ///      hence the two separate levers.
    bool public paused;

    // ═══════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════

    /// @notice A pool with no members, or whose units all sum to zero.
    /// @dev Mirrors `SlotCollective.EmptySplit`, and for the same reason: a
    ///      pool with zero total units accepts no distribution, so shipping one
    ///      means shipping a recipient that can never pay anyone.
    error EmptyPool();

    /// @notice `members` and `units` had different lengths.
    error LengthMismatch();

    /// @notice Superfluid refused to create the pool.
    error PoolCreationFailed();

    /// @notice `distribute()` while paused.
    error DistributionPaused();

    /// @notice A native wrapper cannot also have an ERC-20 underlying.
    error NotANativeWrapper();

    /// @notice The underlying reported more than 18 decimals, which cannot be
    ///         scaled into a SuperToken.
    error UnsupportedDecimals();

    // ═══════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════

    /// @notice The pool was created at initialization.
    event PoolCreated(address indexed pool, address indexed superToken);

    /// @notice A member's units changed.
    /// @dev The counterpart of the split's `SplitUpdated`. Emitted per member
    ///      rather than per rewrite because a pool has no single hash that
    ///      describes it — units are set one at a time, and an indexer wants the
    ///      delta, not a snapshot it would have to diff.
    event MemberUnitsUpdated(address indexed member, uint128 units, address indexed by);

    /// @notice A lump sum was pushed to the pool.
    event Distributed(uint256 amount, address indexed by);

    /// @notice The continuous distribution rate changed. `0` closes the stream.
    event FlowRateUpdated(int96 flowRate, address indexed by);

    /// @notice Distribution was paused or unpaused.
    event SetPaused(bool paused);

    // ═══════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════

    /// @param admin Holder of `DEFAULT_ADMIN_ROLE`.
    /// @param taxManagers Initial `TAX_MANAGER_ROLE` holders. May be empty.
    /// @param policyManagers Initial `POLICY_MANAGER_ROLE` holders. May be empty.
    /// @param utilityManagers Initial `UTILITY_MANAGER_ROLE` holders. May be empty.
    /// @param poolManagers Initial `POOL_MANAGER_ROLE` holders. May be empty.
    struct InitialRoles {
        address admin;
        address[] taxManagers;
        address[] policyManagers;
        address[] utilityManagers;
        address[] poolManagers;
    }

    /// @notice Sets the chain-wide immutables and seals this contract against
    ///         direct use.
    ///
    /// @dev Only immutables here — a proxy's constructor does not run against
    ///      the proxy's storage. These live in the implementation's runtime
    ///      bytecode and read correctly through a delegatecall, so every
    ///      collective behind one beacon shares one forwarder and one token.
    ///
    ///      That last part is a real design consequence: a beacon of these is a
    ///      beacon PER SUPERTOKEN. An ETHx collective and a USDCx collective
    ///      cannot share an implementation. The split has no equivalent
    ///      constraint, because it picks its token per `distribute()` call.
    ///
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address gdaForwarder, address superToken, bool nativeWrapper) {
        GDA = IGDAv1Forwarder(gdaForwarder);
        SUPER_TOKEN = ISuperToken(superToken);
        NATIVE_WRAPPER = nativeWrapper;

        address underlying = ISuperToken(superToken).getUnderlyingToken();
        if (nativeWrapper && underlying != address(0)) revert NotANativeWrapper();
        UNDERLYING = underlying;

        if (underlying == address(0)) {
            UPGRADE_SCALE = 1;
        } else {
            uint8 d = IERC20Metadata(underlying).decimals();
            if (d > 18) revert UnsupportedDecimals();
            UPGRADE_SCALE = 10 ** (18 - d);
        }

        _disableInitializers();
    }

    /// @notice Create the pool, seed its members, and grant the roles.
    ///
    /// @param members Initial pool members.
    /// @param units Their unit counts, positionally matched to `members`.
    /// @param roles Initial role assignment.
    function initializeStreamCollective(
        address[] memory members,
        uint128[] memory units,
        InitialRoles memory roles
    ) external initializer {
        uint256 length = members.length;
        if (length == 0) revert EmptyPool();
        if (units.length != length) revert LengthMismatch();

        // The pool's admin is this contract, which is what makes
        // `updateMemberUnits` reachable from a role-gated function below and
        // from nowhere else.
        (bool ok, ISuperfluidPool created) = GDA.createPool(
            address(SUPER_TOKEN),
            address(this),
            IGDAv1Forwarder.PoolConfig({
                // Units are governance shares, not a tradeable token. Letting
                // members transfer them would route around POOL_MANAGER_ROLE:
                // the role could set the shares, and holders could immediately
                // re-cut them among themselves.
                transferabilityForUnitsOwner: false,
                // Only this contract distributes. Anyone may still fund it —
                // `receive()` is open — but funds then leave under the same
                // rules as tax, rather than by a path the roles never see.
                distributionFromAnyAddress: false
            })
        );
        if (!ok || address(created) == address(0)) revert PoolCreationFailed();
        pool = created;
        emit PoolCreated(address(created), address(SUPER_TOKEN));

        uint256 unitsTotal;
        for (uint256 i; i < length; ++i) {
            unitsTotal += units[i];
            created.updateMemberUnits(members[i], units[i]);
            emit MemberUnitsUpdated(members[i], units[i], msg.sender);
        }
        // The same trap `EmptySplit` guards: a pool that totals zero units can
        // never accept a distribution, so it would be a recipient that can
        // never pay anyone.
        if (unitsTotal == 0) revert EmptyPool();

        _initGovernance(
            roles.admin,
            roles.taxManagers,
            roles.policyManagers,
            roles.utilityManagers
        );
        _grantRoleBatch(POOL_MANAGER_ROLE, roles.poolManagers);
    }

    // ═══════════════════════════════════════════════════════════
    // POOL GOVERNANCE
    // ═══════════════════════════════════════════════════════════

    /// @notice Set one member's units. `0` removes them.
    ///
    /// @dev Changing units changes only FUTURE distributions. Anything a member
    ///      has already accrued is theirs and stays claimable — Superfluid
    ///      settles each member's balance at the moment their units move. This
    ///      is a genuine improvement on the split, where rewriting allocations
    ///      before someone calls `distribute()` retroactively redirects money
    ///      that was earned under the old shares.
    function setMemberUnits(address member, uint128 units)
        external
        onlyRoleOrAdmin(POOL_MANAGER_ROLE)
    {
        pool.updateMemberUnits(member, units);
        emit MemberUnitsUpdated(member, units, msg.sender);
    }

    /// @notice Set many members' units in one call.
    function setMemberUnitsBatch(address[] calldata members, uint128[] calldata units)
        external
        onlyRoleOrAdmin(POOL_MANAGER_ROLE)
    {
        uint256 length = members.length;
        if (units.length != length) revert LengthMismatch();
        for (uint256 i; i < length; ++i) {
            pool.updateMemberUnits(members[i], units[i]);
            emit MemberUnitsUpdated(members[i], units[i], msg.sender);
        }
    }

    /// @notice Pause or unpause lump-sum distribution.
    /// @dev Does not touch an open stream — see the note on `paused`.
    function setPaused(bool _paused) external onlyRoleOrAdmin(POOL_MANAGER_ROLE) {
        paused = _paused;
        emit SetPaused(_paused);
    }

    // ═══════════════════════════════════════════════════════════
    // PAYOUT
    // ═══════════════════════════════════════════════════════════

    /// @notice Wrap whatever this contract holds and hand it all to the pool.
    ///
    /// @notice Permissionless, exactly as `PushSplit.distribute` is, and safe
    ///         for the same reason: the destination is fixed. A caller can move
    ///         money towards the members and nowhere else.
    ///
    /// @dev Returns the amount actually distributed, which can be less than the
    ///      balance: a pool divides by total units and keeps the remainder, so
    ///      `estimateDistributionActualAmount` is asked first and the dust is
    ///      left here to join the next distribution rather than being lost.
    function distribute() external returns (uint256 distributed) {
        if (paused) revert DistributionPaused();

        _wrap();

        uint256 balance = SUPER_TOKEN.balanceOf(address(this));
        if (balance == 0) return 0;

        distributed = GDA.estimateDistributionActualAmount(
            address(SUPER_TOKEN),
            address(this),
            address(pool),
            balance
        );
        if (distributed == 0) return 0;

        GDA.distribute(
            address(SUPER_TOKEN),
            address(this),
            address(pool),
            distributed,
            ""
        );
        emit Distributed(distributed, msg.sender);
    }

    /// @notice Open, change, or close a continuous distribution to the pool.
    ///
    /// @param newFlowRate Tokens per SECOND, in the SuperToken's smallest unit.
    ///        `0` closes the stream.
    ///
    /// @dev Role-gated, unlike `distribute()`. A lump sum is a one-way move of
    ///      money that already arrived; a stream is a standing commitment that
    ///      keeps draining this contract until someone stops it, and it locks a
    ///      buffer. That is a treasury decision, not a keeper action.
    ///
    ///      Superfluid takes a deposit — typically four hours of the rate — and
    ///      holds it until the stream closes, so this contract must already
    ///      hold more than that in SuperToken or the call reverts. It also means
    ///      a rate the incoming tax cannot sustain will eventually drain the
    ///      balance to zero and let anyone liquidate the stream, taking the
    ///      buffer. Size the rate against real tax income, not against the
    ///      current balance.
    function setFlowRate(int96 newFlowRate) external onlyRoleOrAdmin(POOL_MANAGER_ROLE) {
        _wrap();
        GDA.distributeFlow(
            address(SUPER_TOKEN),
            address(this),
            address(pool),
            newFlowRate,
            ""
        );
        emit FlowRateUpdated(newFlowRate, msg.sender);
    }

    /// @notice Convert held tax into the distributable SuperToken, without
    ///         distributing it.
    /// @dev Exposed on its own so a keeper can wrap cheaply and often while
    ///      distribution happens on its own schedule.
    function wrap() external {
        _wrap();
    }

    // ═══════════════════════════════════════════════════════════
    // VIEWS
    // ═══════════════════════════════════════════════════════════

    /// @notice What `member` could claim right now.
    function claimableOf(address member) external view returns (int256) {
        (int256 claimable,) = pool.getClaimableNow(member);
        return claimable;
    }

    function unitsOf(address member) external view returns (uint128) {
        return pool.getUnits(member);
    }

    function totalUnits() external view returns (uint128) {
        return pool.getTotalUnits();
    }

    /// @notice The rate currently streaming into the pool, per second.
    function flowRate() external view returns (int96) {
        return GDA.getFlowDistributionFlowRate(
            address(SUPER_TOKEN),
            address(this),
            address(pool)
        );
    }

    // ═══════════════════════════════════════════════════════════
    // OPERATIONS
    // ═══════════════════════════════════════════════════════════

    /// @notice Native ETH from slot tax and direct sends.
    /// @dev Must stay empty and cheap: `Slot._payOrCredit` pushes native value
    ///      under a `call{gas: 30_000}` cap, and anything heavier here would
    ///      make every native tax push fail and silently degrade into a credit
    ///      that needs a manual `claim`. In particular the wrap does NOT happen
    ///      here — it would blow the cap several times over.
    // solhint-disable-next-line no-empty-blocks
    receive() external payable {}

    // ═══════════════════════════════════════════════════════════
    // INTERNAL
    // ═══════════════════════════════════════════════════════════

    /// @dev Converts held native ETH or held underlying into `SUPER_TOKEN`.
    ///      A no-op when there is nothing to convert, which is the normal case
    ///      for a collective whose slots already pay in the SuperToken.
    function _wrap() internal {
        if (NATIVE_WRAPPER) {
            uint256 nativeBalance = address(this).balance;
            if (nativeBalance != 0) {
                SUPER_TOKEN.upgradeByETH{value: nativeBalance}();
            }
            return;
        }

        if (UNDERLYING == address(0)) return; // pure SuperToken: nothing to wrap

        uint256 balance = IERC20(UNDERLYING).balanceOf(address(this));
        if (balance == 0) return;

        // `forceApprove` rather than `approve`: USDT and friends revert on a
        // non-zero-to-non-zero approval, and a leftover allowance from a
        // partially-consumed wrap is exactly how that state arises.
        IERC20(UNDERLYING).forceApprove(address(SUPER_TOKEN), balance);
        SUPER_TOKEN.upgrade(balance * UPGRADE_SCALE);
    }
}

/// @dev `decimals()` is not on OpenZeppelin's `IERC20`, and pulling the whole
///      `IERC20Metadata` in for one constructor read would drag its `name` and
///      `symbol` into every interface check this contract answers.
interface IERC20Metadata {
    function decimals() external view returns (uint8);
}
