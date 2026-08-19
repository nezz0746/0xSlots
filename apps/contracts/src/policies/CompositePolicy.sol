// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IModuleMetadata} from "../interfaces/IModuleMetadata.sol";
import {IOccupancyPolicy, OccupancyContext} from "../interfaces/IOccupancyPolicy.sol";

/// @title CompositePolicy
/// @notice Shared machinery for policies whose answer is drawn from other
///         policies. `AllOfPolicy` and `OneOfPolicy` differ only in the
///         quantifier; everything below is identical between them.
///
/// @dev ── Why a base rather than two copies ───────────────────────────────
///      What is worth sharing is not the loop — that is three lines and it is
///      the part that differs. It is the surrounding contract: a bounded child
///      list, validated once at construction, with no setter, and the ERC-165
///      answers a verified policy must give. Get the validation wrong in one of
///      two copies and the mistake is invisible until a slot is unbuyable.
///
///      ── Bounded, and why the bound is not cosmetic ───────────────────────
///      Unlike a utility, a policy is NOT gas-capped by the core:
///      `Slot.buy` calls `checkBuy` with everything it has, because a policy is
///      authoritative and must be able to fail the transaction. A composite
///      therefore spends the buyer's gas once per child, and an unbounded list
///      is a slot that becomes progressively more expensive to take until it
///      cannot be taken at all — a denial of service dressed as configuration.
///
///      Eight is chosen to be past any composition anyone has actually wanted
///      while keeping the worst case a few tens of thousands of gas.
///
///      ── Nesting is allowed and is where the bound stops helping ──────────
///      A child may itself be a composite, so the effective breadth is the
///      product down the tree, not the sum. Direct self-reference is rejected
///      below; an indirect cycle (A holds B, B holds A) cannot be seen from
///      here and shows up as a buy that always runs out of gas. Fail-closed,
///      but expensive to diagnose — keep trees shallow.
///
///      ── The list is storage, and what that costs ─────────────────────────
///      Solidity has no immutable dynamic array, so the children live in
///      storage written once in the constructor with no setter. That is
///      immutable in effect but not in form: unlike `MinimumPricePolicy`, the
///      terms are no longer readable from the address alone without a call.
///      A CREATE2 factory keyed on the hash of the child list restores the
///      property — same pattern as the other policy factories, one deployment
///      per distinct composition.
abstract contract CompositePolicy is IOccupancyPolicy {
    /// @notice The most children a composite may hold. See the note above.
    uint256 public constant MAX_POLICIES = 8;

    /// @dev Written once, in the constructor. There is no setter, deliberately:
    ///      changing a slot's terms is already expressible by proposing a
    ///      different policy address through the core's `proposePolicyUpdate`,
    ///      with whatever gating that carries. A setter here would duplicate
    ///      that governance and add a front-running question to every buy.
    address[] internal _policies;

    error NoPolicies();
    error TooManyPolicies(uint256 given, uint256 max);
    error NotAPolicy(address candidate);
    error SelfReference();

    constructor(address[] memory policies_) {
        uint256 n = policies_.length;

        // An empty composite reads as its own opposite in both directions —
        // "all of nothing" permits everyone, "one of nothing" permits nobody —
        // and neither is anything anyone meant to install. Rejected rather than
        // resolved, because there is no reading of an empty list that is not a
        // mistake.
        if (n == 0) revert NoPolicies();
        if (n > MAX_POLICIES) revert TooManyPolicies(n, MAX_POLICIES);

        for (uint256 i; i < n; ++i) {
            address p = policies_[i];

            // Direct recursion is the one cycle visible from here, and it turns
            // every buy into an out-of-gas revert.
            if (p == address(this)) revert SelfReference();
            _assertIsPolicy(p);
            _policies.push(p);
        }
    }

    /// @notice The children, in the order they are consulted.
    function policies() external view returns (address[] memory) {
        return _policies;
    }

    function policyCount() external view returns (uint256) {
        return _policies.length;
    }

    /// @dev Checked at construction rather than per call. A composite pointing
    ///      at something that is not a policy would revert on every buy with an
    ///      error from the wrong contract; better to be undeployable.
    ///
    ///      `supportsInterface` is staticcalled through a low-level call so a
    ///      child that does not implement ERC-165 at all is rejected as "not a
    ///      policy" rather than reverting with a decoding error.
    function _assertIsPolicy(address candidate) internal view {
        if (candidate == address(0) || candidate.code.length == 0) {
            revert NotAPolicy(candidate);
        }

        (bool ok, bytes memory data) = candidate.staticcall(
            abi.encodeCall(
                IERC165.supportsInterface,
                (type(IOccupancyPolicy).interfaceId)
            )
        );
        if (!ok || data.length < 32 || !abi.decode(data, (bool))) {
            revert NotAPolicy(candidate);
        }
    }

    function metadataURI() external pure virtual returns (string memory) {
        return "";
    }

    function version() external pure virtual returns (string memory) {
        return "1.0.0";
    }

    function supportsInterface(bytes4 id) external pure returns (bool) {
        return
            id == type(IOccupancyPolicy).interfaceId ||
            id == type(IModuleMetadata).interfaceId ||
            id == type(IERC165).interfaceId;
    }
}
