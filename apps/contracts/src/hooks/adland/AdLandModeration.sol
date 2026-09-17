// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AdLandStorage} from "./AdLandStorage.sol";
import {Creative, ISlotAd, Moderation, ModerationMode} from "./IAdLand.sol";

/**
 * @title AdLandModeration
 * @notice A slot's manager screening creatives before they show.
 *
 * @dev ── Where the safety comes from ──────────────────────────────────────
 *
 *      Not from a check on the read path. Every reader — the lens,
 *      `creativeOf`, the SDK, the embed, the indexer's `Published` handler —
 *      reads `_creative`. A creative waiting for approval is written to
 *      `_pendingCreative` instead, so it is not hidden from those readers by a
 *      condition someone could get wrong; it is somewhere none of them look.
 *      The only write that moves it is {approveCreative}. None of the read
 *      paths changed to add this, which is why none of the clients had to.
 *
 *      ── "Keep the previous one" costs nothing ──────────────────────────────
 *
 *      While an update from the same occupant waits, their last approved
 *      creative is still in `_creative`, stamped with this tenure, so it keeps
 *      showing. When a DIFFERENT occupant is seated the tenure moves on, that
 *      stamp goes stale, and the previous advertiser's ad stops showing — the
 *      new occupant's slot stands empty until their first creative is
 *      approved, rather than advertising somebody who no longer pays. Both
 *      halves are the existing tenure stamp; neither needed code here.
 *
 *      ── Who moderates ──────────────────────────────────────────────────────
 *
 *      The slot's `manager`: the address that already governs its terms. A slot
 *      with no manager — terms fixed at birth — cannot be moderated, and stays
 *      `Open`. Deliberately not this contract's owner: moderation is a
 *      decision about one space, made by whoever runs that space.
 *
 *      ── A mode change waits for the next occupant ──────────────────────────
 *
 *      An advertiser buys under the mode in force. Switching an occupied slot
 *      to `Every` the moment somebody has paid, then approving nothing, would
 *      have them paying rent for an empty space. So a change to an OCCUPIED
 *      slot applies from the next tenure, the same rule `Slot` applies to the
 *      manager's tax changes. A VACANT slot has nobody to protect and changes
 *      immediately.
 *
 *      What the manager can never do is REMOVE an approved creative: every mode
 *      only decides whether a new one replaces it. Taking an ad down is a
 *      separate power, and not one this adds.
 */
abstract contract AdLandModeration is AdLandStorage {
    /**
     * @notice Set how `slot` screens creatives.
     * @dev Immediately if the slot is vacant; from the next tenure otherwise.
     *      The latest call wins — a second change before the first applies
     *      replaces it rather than queueing behind it.
     */
    function setModerationMode(address slot, ModerationMode mode) external {
        _onlyManager(slot);

        uint64 tenure = ISlotAd(slot).tenureId();
        Moderation storage m = _moderation[slot];

        // Collapse a schedule that has already taken effect, so `current` holds
        // what applies right now before anything is decided from it.
        ModerationMode live = _modeAt(m, tenure);

        if (ISlotAd(slot).occupant() == address(0)) {
            m.current = mode;
            m.next = ModerationMode.Open;
            m.nextFromTenure = 0;
            emit ModerationModeSet(slot, mode, tenure);
            return;
        }

        m.current = live;
        m.next = mode;
        m.nextFromTenure = tenure + 1;
        emit ModerationModeSet(slot, mode, tenure + 1);
    }

    /**
     * @notice Put the waiting creative live.
     * @param uriHash `keccak256` of the URI the manager actually reviewed.
     *
     * @dev ── Why the hash ───────────────────────────────────────────────────
     *
     *      The occupant can replace a waiting submission at any time. Without
     *      the hash, an occupant who watched a manager's approval enter the
     *      mempool could swap their submission in the same block, and the
     *      manager would approve something they had never seen. The hash pins
     *      the approval to the bytes that were reviewed; a swap reverts.
     *
     *      Emits `Published` after `Approved`, so an indexer that treats
     *      `Published` as "this creative went live" is still right without
     *      learning that moderation exists.
     */
    function approveCreative(address slot, bytes32 uriHash) external {
        _onlyManager(slot);
        Creative memory waiting = _waiting(slot, uriHash);

        delete _pendingCreative[slot];
        _creative[slot] = waiting;

        emit Approved(slot, waiting.uri, waiting.tenureId);
        emit Published(slot, waiting.uri, waiting.tenureId);
    }

    /**
     * @notice Turn the waiting creative down.
     * @dev Pinned by hash for the same reason as {approveCreative}: a manager
     *      rejecting what they reviewed should not silently discard a different
     *      submission that replaced it. The live creative is untouched.
     */
    function rejectCreative(address slot, bytes32 uriHash) external {
        _onlyManager(slot);
        Creative memory waiting = _waiting(slot, uriHash);

        delete _pendingCreative[slot];
        emit Rejected(slot, waiting.uri, waiting.tenureId);
    }

    /**
     * @notice Everything a moderation screen needs, in one read.
     *
     * @return current     The mode applying to the occupant seated now.
     * @return nextTenure  The mode a buyer would be seated under. Differs from
     *                     `current` only while a change is scheduled — and it
     *                     is the one somebody deciding whether to buy should see.
     * @return submission  The creative waiting for approval, or "" if none is.
     *                     Already resolved against the tenure: a submission from
     *                     an ended tenure reads as nothing.
     *
     * @dev Never reverts, like the lens. A codeless address or a slot too old to
     *      answer reads as `Open` with nothing waiting.
     */
    function moderationOf(address slot)
        external
        view
        returns (ModerationMode current, ModerationMode nextTenure, string memory submission)
    {
        if (slot.code.length == 0) return (current, nextTenure, submission);

        uint64 tenure;
        try ISlotAd(slot).tenureId() returns (uint64 t) {
            tenure = t;
        } catch {
            return (current, nextTenure, submission);
        }

        Moderation storage m = _moderation[slot];
        current = _modeAt(m, tenure);
        nextTenure = _modeAt(m, tenure + 1);

        try ISlotAd(slot).occupant() returns (address occupant) {
            Creative storage p = _pendingCreative[slot];
            if (occupant != address(0) && p.tenureId == tenure && bytes(p.uri).length != 0) {
                submission = p.uri;
            }
        } catch {}
    }

    // ─── internals ──────────────────────────────────────────────────────────

    /**
     * @dev Whether a creative published now must wait.
     *
     *      `FirstPerTenure` trusts an occupant once something of theirs has been
     *      approved THIS tenure — read straight off the live stamp, so no
     *      separate "trusted" flag exists to drift from it. An occupant who
     *      cleared their creative has nothing live and is asked again.
     *
     *      Costs an `Open` slot one SLOAD on publish: the mode, whose zero value
     *      answers immediately.
     */
    function _requiresApproval(address slot, uint64 tenure) internal view returns (bool) {
        ModerationMode mode = _modeAt(_moderation[slot], tenure);
        if (mode == ModerationMode.Open) return false;
        if (mode == ModerationMode.Every) return true;

        Creative storage live = _creative[slot];
        return bytes(live.uri).length == 0 || live.tenureId != tenure;
    }

    function _modeAt(Moderation storage m, uint64 tenure) internal view returns (ModerationMode) {
        if (m.nextFromTenure != 0 && tenure >= m.nextFromTenure) return m.next;
        return m.current;
    }

    /// @dev The live submission, matching `uriHash`, or a revert that says which
    ///      of those failed.
    function _waiting(address slot, bytes32 uriHash) internal view returns (Creative memory waiting) {
        waiting = _pendingCreative[slot];
        if (
            bytes(waiting.uri).length == 0 || ISlotAd(slot).occupant() == address(0)
                || waiting.tenureId != ISlotAd(slot).tenureId()
        ) revert NothingToModerate();
        if (keccak256(bytes(waiting.uri)) != uriHash) revert SubmissionChanged();
    }

    /// @dev A slot with no manager has nobody who can pass this, which is what
    ///      keeps a slot with fixed terms permanently `Open`.
    function _onlyManager(address slot) internal view {
        if (msg.sender != ISlotAd(slot).manager()) revert NotSlotManager();
    }
}
