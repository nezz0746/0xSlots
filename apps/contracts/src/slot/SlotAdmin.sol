// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../errors/SlotErrors.sol";
import {SlotEscrow} from "./SlotEscrow.sol";
import {TaxTerms, HookTerms, HookOffer} from "../types/SlotTypes.sol";
import {Settings} from "./SlotStorage.sol";
import {TermsLib, TermsQueue} from "../libraries/TermsLib.sol";

/**
 * @title SlotAdmin
 * @notice The manager's surface, which is deliberately small.
 *
 * @dev Terms only ever QUEUE: they ripen for `TERMS_DELAY` and land at the next
 *      occupancy transition, so nothing an occupant bought into moves under
 *      them. A term moves only if the slot was created mutable for it. The
 *      immediate powers touch no occupant: handing the slot to another manager,
 *      and accepting a hook's new fee.
 */
abstract contract SlotAdmin is SlotEscrow {
    using TermsLib for TermsQueue;

    /**
     * @notice Queue a change to any of the slot's terms.
     *
     * @param taxTerms Only the fields named by `mask` are read.
     * @param hookTerms Read as a whole when `mask` includes `TERM_HOOK`. Its offer
     *        is whatever the hook declares, never chosen here.
     * @param mask `TERM_TAX_RATE | TERM_RECIPIENT | TERM_MIN_RUNWAY | TERM_HOOK`.
     *
     * @dev Validated now, so a bad value is refused while somebody is around to
     *      fix it. A hook is asked to accept its terms here and asked again when
     *      it attaches. Proposing again overwrites the named fields, keeps the
     *      rest queued, and restarts the delay for all of them.
     */
    function proposeTerms(
        TaxTerms calldata taxTerms,
        HookTerms calldata hookTerms,
        uint8 mask
    ) external onlyManager {
        if (mask == 0) revert NothingProposed();
        if (mask & ~TermsLib.PROPOSABLE != 0) revert UnknownTerms();
        _requireMutable(mask);

        _validateRent(taxTerms, mask);
        if (mask & TermsLib.HOOK != 0) _validateHook(hookTerms);

        _queue().propose(_nextTaxTerms(), _nextHookTerms(), taxTerms, hookTerms, mask);
        emit TermsProposed(taxTerms, hookTerms, mask);
    }

    /**
     * @notice Drop queued changes.
     * @dev Clears whichever of `mask` is queued and leaves the rest standing,
     *      so one party retracting their change never erases another's.
     *      Reverts only when none of `mask` was queued.
     */
    function cancelTerms(uint8 mask) external onlyManager {
        if (mask == 0) revert NothingProposed();
        uint8 dropped = _queue().cancel(_nextTaxTerms(), _nextHookTerms(), mask);
        if (dropped == 0) revert NoPendingTerms();
        emit TermsCancelled(dropped);
    }

    /**
     * @notice Accept what the attached hook offers today.
     *
     * @param expected The offer the manager reviewed. The call reverts if the
     *        hook now declares anything else, so a hook cannot change its offer
     *        between a manager signing and the transaction landing.
     *
     * @dev A new fee applies at once, on any slot: it only changes how collected
     *      rent is split between the recipient and the hook, never what an
     *      occupant pays. Rent collected so far is paid out under the old fee
     *      first.
     *
     *      New permissions change what the hook may do to an occupant, so they queue
     *      like any term and land at the next occupancy transition, and only on
     *      a slot whose hook is mutable. An immutable hook keeps the
     *      permissions it attached with.
     */
    function acceptHookOffer(HookOffer calldata expected) external nonReentrant onlyManager {
        HookTerms memory h = _hookTerms();
        if (h.target == address(0)) revert InvalidHook();
        HookOffer memory offered = _readHook(h);
        if (
            offered.permissions != expected.permissions ||
            offered.feeBps != expected.feeBps ||
            offered.feeRecipient != expected.feeRecipient
        ) revert HookOfferChanged();

        (bool feeChanges, bool permissionsChange) = _offerChanges(offered);
        if (!feeChanges && !permissionsChange) revert NothingToAccept();

        if (feeChanges) {
            _settle();
            _flush();
            HookOffer storage live = _hookOffer();
            live.feeBps = offered.feeBps;
            live.feeRecipient = offered.feeRecipient;
        }
        if (permissionsChange) _queue().queueHookPermissions(offered.permissions);

        emit HookOfferAccepted(offered, feeChanges, permissionsChange);
    }

    /**
     * @notice Hand the slot to another manager, immediately.
     * @dev One step, no acceptance. Anything already queued stays queued; the
     *      new manager may cancel it.
     */
    function setManager(address next) external onlyManager {
        if (next == address(0)) revert InvalidManager();
        emit ManagerSet(_settings().manager, next);
        _settings().manager = next;
    }

    // ─── validation ─────────────────────────────────────────────────────────

    function _validateRent(TaxTerms memory taxTerms, uint8 mask) internal pure {
        if (mask & TermsLib.TAX_RATE != 0) {
            if (taxTerms.rateBps == 0 || taxTerms.rateBps > MAX_TAX_BPS) revert InvalidTax();
        }
        if (mask & TermsLib.RECIPIENT != 0) {
            if (taxTerms.recipient == address(0)) revert InvalidRecipient();
        }
    }

    /// @dev Each term moves only if the slot was born able to move it.
    function _requireMutable(uint8 mask) internal view {
        Settings storage st = _settings();
        if (mask & (TermsLib.TAX_RATE | TermsLib.MIN_RUNWAY) != 0 && !st.mutableTax) revert NotMutable();
        if (mask & TermsLib.RECIPIENT != 0 && !st.mutableRecipient) revert NotMutable();
        if (mask & TermsLib.HOOK != 0 && !st.mutableHook) revert NotMutable();
    }

    /// @dev Returns the hook's offer, as it declares it.
    function _validateHook(HookTerms memory h) internal view returns (HookOffer memory offer) {
        if (h.target == address(0)) {
            // Configuration for a hook that is not there. Nothing would read it,
            // and it would silently go live the day a hook attaches without its own.
            if (h.config != bytes32(0)) revert InvalidHook();
            return offer;
        }
        return _readHook(h);
    }
}
