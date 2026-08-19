// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IOccupancyPolicy, OccupancyContext} from "../interfaces/IOccupancyPolicy.sol";
import {CompositePolicy} from "./CompositePolicy.sol";

/// @title AllOfPolicy
/// @notice Every child policy must permit the action. Conjunction.
/// @dev The composite you want almost every time two rules apply at once: a
///      membership gate AND a reserve price, a minimum tenure AND a floor.
///
///      ── Failures are not caught, and that is the feature ─────────────────
///      Each child is called plainly. A child that reverts takes the whole
///      transaction with it, carrying ITS OWN revert data all the way to the
///      buyer — so somebody refused by the floor sees `PriceBelowFloor(100e6)`
///      and somebody refused by the gate sees `NotAHolder(0x…)`, exactly as if
///      that policy were installed alone.
///
///      Wrapping the children in `try/catch` to emit a tidy `AllOfFailed()`
///      would be strictly worse: one error for every possible cause, and a
///      buyer with no way to learn which rule they broke or by how much. The
///      simplest implementation is also the most legible one here.
///
///      ── Order is consulted order, and it is worth choosing ───────────────
///      Children are called in the order given and the first refusal ends the
///      call. Cheap checks first is a real gas saving on the refusal path; more
///      importantly, the FIRST failing rule is the one the buyer is told about,
///      so put the rule you most want understood at the front.
///
///      ── Harberger impact: THE STRICTEST OF ITS CHILDREN ──────────────────
///      A conjunction can only ever narrow. Combining two near-pure policies
///      gives something still near-pure; combining anything with a tenure lock
///      inherits that lock. Read the composite as its harshest member, because
///      that is what it is.
contract AllOfPolicy is CompositePolicy {
    constructor(address[] memory policies_) CompositePolicy(policies_) {}

    function checkBuy(OccupancyContext calldata ctx) external view {
        uint256 n = _policies.length;
        for (uint256 i; i < n; ++i) {
            IOccupancyPolicy(_policies[i]).checkBuy(ctx);
        }
    }

    function checkPriceUpdate(OccupancyContext calldata ctx) external view {
        uint256 n = _policies.length;
        for (uint256 i; i < n; ++i) {
            IOccupancyPolicy(_policies[i]).checkPriceUpdate(ctx);
        }
    }

    function name() external pure returns (string memory) {
        return "AllOfPolicy";
    }
}
