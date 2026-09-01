// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IOccupancyPolicy, OccupancyContext} from "../interfaces/IOccupancyPolicy.sol";
import {CompositePolicy} from "./CompositePolicy.sol";

/// @title OneOfPolicy
/// @notice At least one child policy must permit the action. Disjunction.
/// @dev Several routes to the same slot: hold the membership NFT, *or* clear a
///      higher reserve price. A way in for people the primary rule was not
///      written for, without weakening it for anyone else.
///
///      ── Why this one must catch, and what that costs ─────────────────────
///      Unlike `AllOfPolicy`, a refusal here is not final — the next child may
///      still permit — so each is wrapped in `try/catch`. Two consequences
///      follow, and both are worth stating rather than discovering:
///
///      1. The buyer loses the children's own errors. Being refused by all of
///         them reports `NoneSatisfied()` and nothing more. There is no honest
///         way around it: with N reasons and one revert, any choice of which to
///         surface would be arbitrary. Clients should read `policies()` and
///         call each child directly to explain a refusal.
///
///      2. A child that reverts for a reason unrelated to policy — a bug, an
///         unreadable dependency — is indistinguishable from one that refused.
///         The composite treats both as "did not permit", which is fail-closed
///         for that child and therefore safe.
///
///      ── The asymmetry that actually matters ──────────────────────────────
///      A conjunction is as strict as its strictest member; a disjunction is as
///      permissive as its LOOSEST. One misconfigured child — a floor of zero, a
///      gate on a collection anyone can mint — opens the slot to everyone, and
///      every other rule in the list becomes decorative. Review a `OneOf` by
///      its weakest member, and never assume a rule still binds because it is
///      in the list.
///
///      ── Harberger impact: THE LOOSEST OF ITS CHILDREN ────────────────────
///      Which, read the other way, is the useful property: a disjunction can
///      only ever WIDEN the buyer set, so adding a route can restore forced
///      sale that a narrow gate had taken away. Pairing a small-collection
///      `TokenHolderPolicy` with a `MinimumPricePolicy` is the canonical use —
///      members enter freely, everyone else may still take the slot by
///      declaring above a reserve.
///
///      ── Gas, and the 63/64 rule ──────────────────────────────────────────
///      Each `try` forwards all but a sixty-fourth of the remaining gas. A
///      child that burns everything it is given leaves too little to consult
///      the rest, and the buy runs out of gas rather than falling through to a
///      child that would have permitted it. Fail-closed, but a reason to keep
///      expensive children last — and to keep `MAX_POLICIES` small.
contract OneOfPolicy is CompositePolicy {
    error NoneSatisfied();

    constructor(address[] memory policies_) CompositePolicy(policies_) {}

    function checkBuy(OccupancyContext calldata ctx) external view {
        uint256 n = _policies.length;
        for (uint256 i; i < n; ++i) {
            try IOccupancyPolicy(_policies[i]).checkBuy(ctx) {
                return;
            } catch {
                // Refused, or broken. Both mean "not this route" — try the next.
            }
        }
        revert NoneSatisfied();
    }

    function checkPriceUpdate(OccupancyContext calldata ctx) external view {
        uint256 n = _policies.length;
        for (uint256 i; i < n; ++i) {
            try IOccupancyPolicy(_policies[i]).checkPriceUpdate(ctx) {
                return;
            } catch {}
        }
        revert NoneSatisfied();
    }

    function name() external pure returns (string memory) {
        return "OneOfPolicy";
    }
}
