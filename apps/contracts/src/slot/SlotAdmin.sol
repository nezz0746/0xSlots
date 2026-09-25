// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {
    NotOccupant,
    InvalidTax,
    InvalidRecipient,
    InvalidRunway,
    InvalidManager,
    InvalidModule,
    ModuleTooExpensive,
    ScopesChanged,
    FeeChanged,
    NothingToAccept,
    ModuleChangeQueued,
    NotMutable,
    NoPendingTerms,
    NothingProposed,
    UnknownTerms
} from "../errors/SlotErrors.sol";
import {SlotEscrow} from "./SlotEscrow.sol";
import {TaxTerms, ModuleTerms, ModuleFee, Pending, InstalledModule} from "../types/SlotTypes.sol";
import {ModuleLib} from "../libraries/ModuleLib.sol";
import {Governance} from "./SlotStorage.sol";
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
    using TermsLib for Pending;
    using ModuleLib for InstalledModule;

    /**
     * @notice Queue a change to any of the slot's terms.
     *
     * @param taxTerms Only the fields named by `mask` are read.
     * @param moduleTerms Read as a whole when `mask` includes `TERM_MODULE`. Its
     *        scopes and fee are whatever the module declares, never chosen here.
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
        uint16 mask
    ) external nonReentrant onlyManager {
        if (mask == 0) revert NothingProposed();
        if (mask & ~TermsLib.PROPOSABLE != 0) revert UnknownTerms();
        _requireMutable(mask);

        _validateRent(taxTerms, mask);
        uint16 reviewedScopes;
        ModuleFee memory reviewedFee;
        if (mask & TermsLib.MODULE != 0) {
            (reviewedScopes, reviewedFee) = _validateModule(moduleTerms);
            // A module fee sends part of the rent somewhere the slot's
            // `recipient` is not, so attaching one that charges is a change of
            // destination — the power `mutableRecipient` governs. A slot that
            // promised a fixed recipient keeps that promise whole: the fee may
            // be anything, up to all of it, on a slot whose recipient can move.
            if (reviewedFee.bps != 0 && !_governance().mutableRecipient) {
                revert NotMutable();
            }
        }

        Pending storage p = _pending();
        p.propose(taxTerms, moduleTerms, mask);
        // Kept, so the module that attaches when this lands is the one read
        // here. Without it the apply-time re-read installs whatever the module
        // says by then — including a fee and `afterCallbacksMustSucceed` nobody accepted.
        if (mask & TermsLib.MODULE != 0) {
            p.nextModule.scopes = reviewedScopes;
            p.nextModule.fee = reviewedFee;
        }
        emit TermsProposed(taxTerms, moduleTerms, mask);
    }

    /**
     * @notice Drop queued changes.
     * @dev Clears whichever of `mask` is queued and leaves the rest standing,
     *      so one party retracting their change never erases another's.
     *      Reverts only when none of `mask` was queued.
     */
    function cancelTerms(uint16 mask) external nonReentrant onlyManager {
        if (mask == 0) revert NothingProposed();
        uint16 dropped = _pending().cancel(mask);
        if (dropped == 0) revert NoPendingTerms();
        emit TermsCancelled(dropped);
    }

    /**
     * @notice Accept the fee the attached module declares today.
     *
     * @param expected The fee the manager reviewed. Reverts if the module now
     *        declares anything else, so it cannot change between a manager
     *        signing and the transaction landing.
     *
     * @dev Applies at once, on any slot: it only changes how collected tax is
     *      split between the recipient and the module, never what an occupant
     *      pays. Tax collected so far is paid out under the old fee first.
     *      Raising it needs `mutableRecipient`, the same authority as moving
     *      the recipient: more of the rent leaves by a different door.
     *      Lowering it always lands.
     */
    function acceptFee(ModuleFee calldata expected) external nonReentrant onlyManager {
        InstalledModule storage m = _module();
        if (m.module == address(0)) revert InvalidModule();
        (, ModuleFee memory offered) = _readModule(m.terms());
        if (!ModuleLib.sameFee(offered, expected)) revert FeeChanged();
        if (ModuleLib.sameFee(offered, m.fee)) revert NothingToAccept();
        if (offered.bps > m.fee.bps && !_governance().mutableRecipient) revert NotMutable();

        _settle();
        _flush();
        m.fee.bps = offered.bps;
        m.fee.recipient = offered.recipient;
        emit FeeAccepted(offered);
    }

    /**
     * @notice Accept the scopes the attached module declares today.
     *
     * @param expected The scopes the manager reviewed. Reverts if the module
     *        now declares anything else.
     *
     * @dev New scopes change what the module may do to an occupant, so they
     *      queue like any term and land at the next buy, and only on a slot
     *      whose module is mutable. Refused while a new module is queued: the
     *      one declaring these scopes is on its way out.
     */
    function acceptScopes(uint16 expected) external nonReentrant onlyManager {
        if (!_governance().mutableModule) revert NotMutable();
        InstalledModule storage m = _module();
        if (m.module == address(0)) revert InvalidModule();
        Pending storage p = _pending();
        if (p.mask & TermsLib.MODULE != 0) revert ModuleChangeQueued();

        (uint16 offered,) = _readModule(m.terms());
        if (offered != expected) revert ScopesChanged();
        if (offered == m.scopes) revert NothingToAccept();
        if (p.mask & TermsLib.SCOPES != 0 && p.nextModule.scopes == offered) {
            revert NothingToAccept();
        }

        p.queueScopes(offered);
        emit ScopesAccepted(offered);
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
            _onInstall(_occupancy().occupant, _occupancy().price, _occupancy().deposit);
        }
    }

    /**
     * @notice Hand the slot to another manager, immediately.
     * @dev One step, no acceptance. Anything already queued stays queued; the
     *      new manager may cancel it.
     */
    function setManager(address next) external nonReentrant onlyManager {
        if (next == address(0)) revert InvalidManager();
        emit ManagerSet(_governance().manager, next);
        _governance().manager = next;
    }

    // ─── validation ─────────────────────────────────────────────────────────

    function _validateRent(TaxTerms memory taxTerms, uint16 mask) internal pure {
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
    function _requireMutable(uint16 mask) internal view {
        Governance storage st = _governance();
        if (mask & (TermsLib.TAX_RATE | TermsLib.MIN_RUNWAY) != 0 && !st.mutableTax) {
            revert NotMutable();
        }
        if (mask & TermsLib.RECIPIENT != 0 && !st.mutableRecipient) revert NotMutable();
        if (mask & TermsLib.MODULE != 0 && !st.mutableModule) revert NotMutable();
    }

    /// @dev Returns the module's scopes and fee, as it declares them.
    ///
    ///      Read twice, for two different answers. `_readModule` is uncapped and
    ///      bubbles the module's own revert, so a module refusing its settings
    ///      says why. `_tryReadModule` is the read the slot will actually use
    ///      when the module attaches: a module too expensive to answer under
    ///      that stipend is attached as nothing, silently and later, so it is
    ///      refused here instead.
    function _validateModule(ModuleTerms memory h)
        internal
        view
        returns (uint16 scopes_, ModuleFee memory fee_)
    {
        if (h.module == address(0)) {
            // Settings for a module that is not there. Nothing would read them,
            // and they would silently go live the day a module attaches without its own.
            if (h.settings.length != 0) revert InvalidModule();
            return (0, fee_);
        }
        (scopes_, fee_) = _readModule(h);
        (bool affordable,,) = _tryReadModule(h);
        if (!affordable) revert ModuleTooExpensive();
    }
}
