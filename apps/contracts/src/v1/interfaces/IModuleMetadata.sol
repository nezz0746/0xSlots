// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/// @title IModuleMetadata — how a slot's pluggable contracts describe themselves
/// @notice Shared by the two things a slot can plug in: the utility
///         (`IUtility`, what holding the slot grants) and the occupancy policy
///         (`IOccupancyPolicy`, who may hold it). They are deliberately
///         asymmetric in behaviour — one fails open, the other fails closed —
///         but they describe themselves identically, and there was no reason
///         for `moduleURI()` and `policyURI()` to be different functions
///         returning the same kind of string. A reader that wants a name, a
///         version and a document now needs one interface, not two.
///
/// @dev This is metadata, not protocol. Nothing in `Slot` branches on it: the
///      URI is read once at verification time and surfaced to indexers and
///      UIs. A utility whose `metadataURI()` reverts is still a working
///      utility — see `Slot._utilityURI`, which swallows the failure.
///
///      ── On the rename ────────────────────────────────────────────────────
///      `moduleURI()`/`policyURI()` were removed rather than kept as aliases.
///      That is a WIRE break, and deliberately so:
///
///        * `type(IUtility).interfaceId` is the XOR of its own selectors, so
///          swapping one changes the id. Contracts compiled against the old
///          interface answer `supportsInterface` with the old value and no
///          longer pass `SlotFactory.setUtilityVerified`.
///        * `Slot` staticcalls the getter by selector, so an un-upgraded
///          implementer stops reporting a URI.
///
///      Both were checked against the live deployments before choosing this:
///      every deployed utility and policy returned `""`, so no metadata was
///      actually lost. Utilities are UUPS proxies and were upgraded in place,
///      keeping their addresses. Policies are immutable — they carry their
///      configuration in `immutable` fields and are minted per-slot by a
///      factory — so those were redeployed. A slot still pointing at a
///      pre-rename policy keeps working: `checkBuy` and `checkPriceUpdate` are
///      untouched, and only re-verification would revert.
interface IModuleMetadata is IERC165 {
    /// @notice Human-readable name, e.g. "FeedPostModule".
    function name() external view returns (string memory);

    /// @notice Implementation version, e.g. "1.0.0".
    function version() external view returns (string memory);

    /// @notice Metadata document (e.g. ipfs://Qm… JSON with image, description).
    ///         May be empty.
    function metadataURI() external view returns (string memory);
}
