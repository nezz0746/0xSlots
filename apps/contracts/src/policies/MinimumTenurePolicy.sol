// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IOccupancyPolicy, OccupancyContext} from "../interfaces/IOccupancyPolicy.sol";

/// @title MinimumTenurePolicy
/// @notice An occupant cannot be bought out for `tenureSeconds` after acquiring.
/// @dev Stateless singleton — configuration lives in the address itself, so one
///      deployment can serve any number of slots. Deploy one per duration.
///
///      Harberger impact: SOFT. Forced sale is delayed, not removed — a
///      dishonestly low price is still punished, just `tenureSeconds` later.
///      Two conditions keep it sound and both are enforced here:
///        1. Entry is funded — the buyer must escrow the full tenure's tax at
///           the moment of purchase.
///        2. Price cannot be cut while protected, or the occupant would declare
///           high, drop to dust on day 1, and pay nothing for the window.
///      Liquidation is unaffected: insolvency always ends tenure.
///
///      ── What condition 1 does NOT guarantee ───────────────────────────────
///      It is checked at entry and never again. `Slot.withdraw` consults no
///      policy — only the core's own `minDepositSeconds` floor — so the escrow
///      binds exactly as far as that floor reaches. An occupant can escrow the
///      full tenure, withdraw straight back down to the floor, and keep the
///      whole protection window. See
///      `test_Tenure_ProtectionOutlivesTheEscrowDownToTheCoreFloor`.
///
///      This is a leak in the mechanism, not in the economics. Liquidation is
///      never vetoable, so an occupant who withdraws is removable from the
///      moment their runway ends. What the leak costs is the BUYOUT channel:
///      for the rest of the window a rival must liquidate to vacancy rather
///      than buy at the declared price. A slot that wants condition 1 to bind
///      for its full term sets `minDepositSeconds >= tenureSeconds` at
///      creation, which moves the floor into the core where `withdraw`
///      enforces it.
contract MinimumTenurePolicy is IOccupancyPolicy {
    uint256 public constant BASIS_POINTS = 10_000;
    uint256 public constant MONTH = 30 days;

    /// @notice Protection window in seconds.
    uint256 public immutable tenureSeconds;

    error TenureNotElapsed(uint256 availableAt);
    error TenureUnderfunded(uint256 required);
    error PriceCutDuringTenure();

    constructor(uint256 _tenureSeconds) {
        tenureSeconds = _tenureSeconds;
    }

    function checkBuy(OccupancyContext calldata ctx) external view {
        // Condition 1: the incoming occupant pre-pays the whole window.
        uint256 required = _taxFor(ctx.newPrice, ctx.taxPercentage, tenureSeconds);
        if (ctx.depositAmount < required) revert TenureUnderfunded(required);

        if (ctx.occupant == address(0)) return; // vacant — always claimable
        if (ctx.occupiedSince == 0) return;     // legacy slot — treat as unprotected

        uint256 availableAt = ctx.occupiedSince + tenureSeconds;
        if (block.timestamp < availableAt) revert TenureNotElapsed(availableAt);
    }

    function checkPriceUpdate(OccupancyContext calldata ctx) external view {
        if (ctx.occupiedSince == 0) return;
        if (block.timestamp >= ctx.occupiedSince + tenureSeconds) return;
        // Condition 2: no cutting your price while nobody can take it.
        if (ctx.newPrice < ctx.currentPrice) revert PriceCutDuringTenure();
    }

    function name() external pure returns (string memory) { return "MinimumTenurePolicy"; }
    function version() external pure returns (string memory) { return "1.0.0"; }
    function policyURI() external pure returns (string memory) { return ""; }

    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == type(IOccupancyPolicy).interfaceId || id == type(IERC165).interfaceId;
    }

    /// @dev Rounds UP, mirroring `Slot._minDepositFor`. Truncating divided the
    ///      pre-payment in the buyer's favour, and below a threshold price it
    ///      truncated to zero outright — a tenure-protected slot could be taken
    ///      with no pre-payment at all and then held for the whole window. The
    ///      threshold is in RAW UNITS, so what it is worth depends on the
    ///      currency's decimals, which this policy never sees.
    function _taxFor(
        uint256 price_,
        uint256 taxPercentage,
        uint256 seconds_
    ) internal pure returns (uint256) {
        return Math.ceilDiv(price_ * taxPercentage * seconds_, MONTH * BASIS_POINTS);
    }
}
