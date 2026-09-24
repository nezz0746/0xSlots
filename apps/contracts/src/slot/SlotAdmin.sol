// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../errors/SlotErrors.sol";
import {SlotEscrow} from "./SlotEscrow.sol";
import {TaxTerms, ModuleTerms, Manifest, PendingTerms} from "../types/SlotTypes.sol";
import {Settings} from "./SlotStorage.sol";
import {TermsLib} from "../libraries/TermsLib.sol";

/**
 * @title SlotAdmin
 * @notice The manager's surface, which is deliberately small.
 *
 * @dev Terms only ever QUEUE: they ripen for `TERMS_DELAY` and land at the next
 *      buy, so nothing an occupant bought into moves under them. A term moves only if the slot was created mutable for it. The
 *      immediate powers touch no occupant: handing the slot to another manager,
 *      and accepting a module's new fee.
 */
abstract contract SlotAdmin is SlotEscrow {
    using TermsLib for PendingTerms;

    /**
     * @notice Queue a change to any of the slot's terms.
     *
     * @param taxTerms Only the fields named by `mask` are read.
     * @param moduleTerms Read as a whole when `mask` includes `TERM_MODULE`. Its manifest
     *        is whatever the module declares, never chosen here.
     * @param mask `TERM_TAX_RATE | TERM_RECIPIENT | TERM_MIN_RUNWAY | TERM_MODULE`.
     *
     * @dev Validated now, so a bad value is refused while somebody is around to
     *      fix it. A module is asked to accept its terms here and asked again when
     *      it attaches. Proposing again overwrites the named fields, keeps the
     *      rest queued, and restarts the delay for all of them.
     */
    function proposeTerms(
        TaxTerms calldata taxTerms,
        ModuleTerms calldata moduleTerms,
        uint8 mask
    ) external nonReentrant onlyManager {
        if (mask == 0) revert NothingProposed();
        if (mask & ~TermsLib.PROPOSABLE != 0) revert UnknownTerms();
        _requireMutable(mask);

        _validateRent(taxTerms, mask);
        Manifest memory reviewed;
        if (mask & TermsLib.MODULE != 0) {
            reviewed = _validateModule(moduleTerms);
            // A module fee sends part of the rent somewhere the slot's
            // `recipient` is not, so attaching one that charges is a change of
            // destination — the power `mutableRecipient` governs. A slot that
            // promised a fixed recipient keeps that promise whole: the fee may
            // be anything, up to all of it, on a slot whose recipient can move.
            if (reviewed.feeBps != 0 && !_settings().mutableRecipient) {
                revert NotMutable();
            }
        }

        _pending().propose(taxTerms, moduleTerms, mask);
        // Pinned, so the module that attaches an hour from now is the one whose
        // manifest was read here. Without it the apply-time re-read installs
        // whatever the module says by then — including a fee and `strict`
        // nobody accepted.
        if (mask & TermsLib.MODULE != 0) {
            _pending().reviewedManifest = _manifestHash(reviewed);
        }
        emit TermsProposed(taxTerms, moduleTerms, mask);
    }

    /**
     * @notice Drop queued changes.
     * @dev Clears whichever of `mask` is queued and leaves the rest standing,
     *      so one party retracting their change never erases another's.
     *      Reverts only when none of `mask` was queued.
     */
    function cancelTerms(uint8 mask) external nonReentrant onlyManager {
        if (mask == 0) revert NothingProposed();
        uint8 dropped = _pending().cancel(mask);
        if (dropped == 0) revert NoPendingTerms();
        emit TermsCancelled(dropped);
    }

    /**
     * @notice Accept what the attached module declares today.
     *
     * @param expected The manifest the manager reviewed. The call reverts if the
     *        module now declares anything else, so a module cannot change its manifest
     *        between a manager signing and the transaction landing.
     *
     * @dev A new fee applies at once, on any slot: it only changes how collected
     *      rent is split between the recipient and the module, never what an
     *      occupant pays. Rent collected so far is paid out under the old fee
     *      first.
     *
     *      New scopes change what the module may do to an occupant, so they queue
     *      like any term and land at the next buy, and only on a slot whose
     *      module is mutable. An immutable module keeps the
     *      scopes it attached with.
     */
    function grant(Manifest calldata expected) external nonReentrant onlyManager {
        ModuleTerms memory h = _moduleTerms();
        if (h.target == address(0)) revert InvalidModule();
        Manifest memory offered = _readManifest(h);
        if (
            offered.scopes != expected.scopes ||
            offered.feeBps != expected.feeBps ||
            offered.feeRecipient != expected.feeRecipient
        ) revert ManifestChanged();

        (bool feeChanges, bool scopesChange) = _manifestChanges(offered);
        if (!feeChanges && !scopesChange) revert NothingToAccept();

        // Raising the cut needs the same authority as moving the recipient, and
        // for the same reason: more of the rent leaves by a different door.
        // Lowering it always lands — nobody needs protecting from being paid
        // more.
        if (
            feeChanges &&
            offered.feeBps > _manifest().feeBps &&
            !_settings().mutableRecipient
        ) revert NotMutable();

        if (feeChanges) {
            _settle();
            _flush();
            Manifest storage live = _manifest();
            live.feeBps = offered.feeBps;
            live.feeRecipient = offered.feeRecipient;
        }
        if (scopesChange) _pending().queueScopes(offered.scopes);

        emit ScopesGranted(offered, feeChanges, scopesChange);
    }

    /**
     * @notice Land the queued terms now.
     *
     * @dev Two callers, for two reasons. While somebody is seated it is THEIR
     *      call: the delay exists to protect them, so waiving it is theirs to
     *      waive — an occupant happy with a lower tax should not have to give
     *      up the seat to get it. Once the slot is vacant there is nobody to
     *      protect, so anyone may press it, which keeps a manager from waiting
     *      on a buyer to land a change.
     *
     *      Everything ripe lands together, as it would at a buy.
     */
    function applyTerms() external nonReentrant {
        address occupant = _occupancy().occupant;
        if (occupant != address(0) && msg.sender != occupant) revert NotOccupant();
        if (!_pending().isRipe(TERMS_DELAY)) revert NoPendingTerms();

        _settle();
        if (_applyPending()) {
            _onInstall(
                _occupancy().occupant,
                _occupancy().price,
                _occupancy().deposit
            );
        }
    }

    /**
     * @notice Hand the slot to another manager, immediately.
     * @dev One step, no acceptance. Anything already queued stays queued; the
     *      new manager may cancel it.
     */
    function setManager(address next) external nonReentrant onlyManager {
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
        if (mask & TermsLib.MIN_RUNWAY != 0) {
            if (taxTerms.minRunwaySeconds > MAX_MIN_RUNWAY) revert InvalidRunway();
        }
    }

    /// @dev Each term moves only if the slot was born able to move it.
    function _requireMutable(uint8 mask) internal view {
        Settings storage st = _settings();
        if (mask & (TermsLib.TAX_RATE | TermsLib.MIN_RUNWAY) != 0 && !st.mutableTax) revert NotMutable();
        if (mask & TermsLib.RECIPIENT != 0 && !st.mutableRecipient) revert NotMutable();
        if (mask & TermsLib.MODULE != 0 && !st.mutableModule) revert NotMutable();
    }

    /// @dev Returns the module's manifest, as it declares it.
    ///
    ///      Read twice, for two different answers. `_readManifest` is uncapped and
    ///      bubbles the module's own revert, so a module refusing its configuration
    ///      says why. `_tryReadManifest` is the read the slot will actually use when
    ///      the module attaches: a module too expensive to answer under that stipend
    ///      is attached as nothing, silently and an hour later, so it is refused
    ///      here instead.
    function _validateModule(ModuleTerms memory h) internal view returns (Manifest memory declared) {
        if (h.target == address(0)) {
            // Configuration for a module that is not there. Nothing would read it,
            // and it would silently go live the day a module attaches without its own.
            if (h.settings.length != 0) revert InvalidModule();
            return declared;
        }
        declared = _readManifest(h);
        (bool affordable, ) = _tryReadManifest(h);
        if (!affordable) revert ManifestTooExpensive();
    }
}
