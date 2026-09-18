// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {VersionedUUPS} from "../../utils/VersionedUUPS.sol";
import {IAdLand, Creative, Pending} from "./IAdLand.sol";

/**
 * @title AdLandStorage
 * @notice Every storage slot AdLand owns, and nothing else.
 *
 * @dev First in the inheritance chain and the ONLY place that declares state.
 *      Solidity allocates base storage before derived, so splitting a contract
 *      by concern is safe exactly as long as the concerns hold no state of
 *      their own — one `uint256` added to `AdLandRegistry` would silently shift
 *      every slot beneath it. Put it here or nowhere.
 */
abstract contract AdLandStorage is VersionedUUPS, OwnableUpgradeable, IAdLand {
    // ─── constants (no slots) ───────────────────────────────────────────────

    bytes32 public constant FAMILY = keccak256("slots.hook.adland");

    /// @notice How long a change to an EXISTING key must sit before it applies.
    /// @dev Two days: slow enough to be noticed, fast enough to be an incident
    ///      response. A slot that has genuinely been lost is an outage, and a
    ///      week of it to satisfy a delay nobody is watching helps no one.
    uint256 public constant CHANGE_DELAY = 2 days;

    /// @notice The key an SDK resolves when the publisher named no slot.
    bytes32 public constant PRIMARY = "primary";

    // ─── state ──────────────────────────────────────────────────────────────
    //
    // A UUPS proxy: append new state at the end, never above.

    // registry

    /// @notice What each key resolves to right now.
    mapping(bytes32 key => address slot) public slotOf;

    /// @notice Changes waiting out `CHANGE_DELAY`.
    mapping(bytes32 key => Pending) public pendingOf;

    /**
     * @notice Who may repoint each key, besides the owner.
     * @dev Set once, when a key is claimed through {AdLandRegistry-claimKey},
     *      and never cleared. It grants one power, over one key, and does not
     *      outrank `owner()`.
     */
    mapping(bytes32 key => address) public keyOwner;

    // creatives

    /// @dev Keyed by slot. Stamped with the tenure it belongs to — see `AdLand`.
    mapping(address slot => Creative) internal _creative;

    /**
     * @notice A creative waiting for the manager, stamped like a live one.
     *
     * @dev A SEPARATE mapping from `_creative`, and that is the whole safety
     *      argument for moderation: every read path reads `_creative` and
     *      nothing else, so an unapproved submission is not hidden by a check
     *      somebody could forget; it is simply not where anything looks.
     *      Approval is the only write that moves it.
     */
    mapping(address slot => Creative) internal _pendingCreative;
}
