// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SlotInfo} from "../../SlotViews.sol";
import {AdLandStorage} from "./AdLandStorage.sol";
import {AdView, Creative, ISlotAd} from "./IAdLand.sol";

/**
 * @title AdLandLens
 * @notice One call for everything a publisher's page draws.
 *
 * @dev Nothing here reverts. A key resolving to nothing, an address that is not
 *      a slot, a slot on an older implementation — all are states a page can
 *      genuinely be in, and none should arrive at the SDK as a failed RPC it has
 *      to tell apart from a network error. They come back as zero, and
 *      `slot == address(0)` is the cue to draw nothing.
 */
abstract contract AdLandLens is AdLandStorage {
    /// @notice Resolve a named slot and read it, in one call.
    function adByKey(bytes32 key) external view returns (AdView memory) {
        return ad(slotOf[key]);
    }

    /// @notice Read a slot the caller already knows the address of.
    /// @dev Public and separate so a publisher running their own inventory gets
    ///      the same single-call read without going through the registry. The
    ///      indirection is a convenience, not a toll gate.
    function ad(address slot) public view returns (AdView memory v) {
        if (slot == address(0)) return v;

        // Probed first: a staticcall to an address with no code SUCCEEDS and
        // returns nothing, which decodes as zero — so without this, any typo'd
        // address reports a healthy, vacant, free ad space that does not exist.
        if (slot.code.length == 0) return v;

        v.slot = slot;

        // One call where V1's lens needed ten. `SlotInfo` carries the tenure and
        // the hook, so the creative resolves from the same result rather than
        // from two more reads.
        try ISlotAd(slot).getSlotInfo() returns (SlotInfo memory info) {
            v.info = info;
            v.managed = info.hook == address(this);

            Creative storage c = _creative[slot];
            if (
                bytes(c.uri).length != 0 &&
                info.occupant != address(0) &&
                c.tenureId == info.tenureId
            ) {
                v.uri = c.uri;
            }
        } catch {
            // Not a slot, or one too old to answer. `v.slot` stays set so a
            // caller can tell "nothing there" from "there, but unreadable".
        }
    }

    /// @notice The creative currently showing in `slot`, or "" if none is.
    /// @dev The cheap read, for callers that need only the URI. `ad()` is the
    ///      one a render path wants.
    function creativeOf(address slot) external view returns (string memory) {
        Creative storage c = _creative[slot];
        if (bytes(c.uri).length == 0) return "";

        // Guarded like `ad()`, and for the same two reasons. A staticcall to a
        // codeless address SUCCEEDS returning nothing, which decodes as zero —
        // and a slot too old to answer these reverts. Both were unguarded here
        // while `ad()` handled them, so the file's own promise that nothing
        // reverts held only on the path a render actually takes.
        if (slot.code.length == 0) return "";

        try ISlotAd(slot).occupant() returns (address occupant) {
            if (occupant == address(0)) return "";
        } catch {
            return "";
        }

        try ISlotAd(slot).tenureId() returns (uint64 id) {
            if (id != c.tenureId) return "";
        } catch {
            return "";
        }

        return c.uri;
    }

    /// @notice The stored entry, stamp included, without resolving it.
    /// @dev For a client that wants to say "your creative ended when the slot
    ///      turned over" rather than show an empty box. Never for rendering.
    function rawCreativeOf(
        address slot
    ) external view returns (string memory uri, uint64 tenureId) {
        Creative storage c = _creative[slot];
        return (c.uri, c.tenureId);
    }
}
