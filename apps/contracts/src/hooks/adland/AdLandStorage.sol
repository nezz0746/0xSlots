// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {VersionedUUPS} from "../../VersionedUUPS.sol";
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

    /// @dev Keyed by slot. Stamped with the tenure it belongs to — see `AdLand`.
    mapping(address slot => Creative) internal _creative;

    /// @notice What each key resolves to right now.
    mapping(bytes32 key => address slot) public slotOf;

    /// @notice Changes waiting out `CHANGE_DELAY`.
    mapping(bytes32 key => Pending) public pendingOf;

    /**
     * @notice The factory {AdLandCreate-createAdSlot} deploys through.
     *
     * @dev Stored rather than taken as an argument, which is the whole point of
     *      that function: a caller who can name the factory can name the wrong
     *      one, and a slot deployed by a factory nobody vetted is not a slot
     *      this contract should be lending its name to.
     *
     *      Appended, and it has to be. This contract is a UUPS proxy with live
     *      state, so a variable inserted above `_creative` would move every
     *      mapping beneath it under a deployed contract. New slots go here, at
     *      the end, always.
     */
    address public slotFactory;

    /**
     * @notice Who may repoint each key, besides the owner.
     *
     * @dev Set once, when a key is claimed through {AdLandCreate-createAdSlot},
     *      and never cleared. Without it a permissionless claim gives a
     *      publisher a one-shot binding rather than a name: they could point
     *      "ethereum" at their slot and then never move it again, so the first
     *      time that slot was redeployed their name would outlive it pointing
     *      at nothing — the exact failure this registry exists to prevent,
     *      relocated onto them.
     *
     *      It grants ONE power, over ONE key. It is not ownership of anything
     *      else, and it does not outrank `owner()`.
     *
     *      Appended, and it has to be. See `slotFactory` above.
     */
    mapping(bytes32 key => address) public keyOwner;
}
