// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SlotViews} from "./slot/SlotViews.sol";
import {SlotOccupancy} from "./slot/SlotOccupancy.sol";
import {SlotEscrow} from "./slot/SlotEscrow.sol";
import {SlotAdmin} from "./slot/SlotAdmin.sol";
import "./errors/SlotErrors.sol";
import {Versioned} from "./utils/Versioned.sol";
import {SlotInit, Manifest} from "./types/SlotTypes.sol";
import {ISlotModule} from "./interfaces/ISlotModule.sol";
import {Settings} from "./slot/SlotStorage.sol";
import {TermsLib} from "./libraries/TermsLib.sol";

/**
 * @title Slot
 * @notice One Harberger-taxed position. Always for sale at a price its holder
 *         sets, taxed continuously on that price.
 *
 * @dev ── The two rules everything else serves ────────────────────────────
 *
 *      1. Liquidation is unconditional. An occupant whose deposit is empty can
 *         always be evicted, by anyone, and nothing — no module, no recipient, no
 *         currency — may prevent it. Every capped call and swallowed revert in
 *         this codebase exists for that sentence.
 *
 *         The ONE exception is a module that declared `strict`, whose `after`
 *         callbacks are uncapped and fatal so it can do work that must land.
 *         A slot attaching one is only as evictable as that module. The flag is
 *         copied at attach and readable from {SlotInfo}'s `scopes`, so
 *         which kind of slot this is can be told before committing to it.
 *
 *      2. Terms do not move under an occupant. Rent and module changes, and new
 *         scopes a manager accepts from the module, land at the next buy —
 *         or sooner if the occupant lands them themselves with `applyTerms` —
 *         so what you bought into holds for as long as you hold the slot. A module's fee may move sooner: it splits the rent
 *         between recipient and module and never changes what an occupant pays.
 *
 *      ── Extension ───────────────────────────────────────────────────────
 *
 *      One `module`, and one capped call into it per callback. `before` decides
 *      and may refuse; `after` records and cannot. A slot wanting several
 *      behaviours points at a module that implements all of them, so there is no
 *      loop anywhere near the eviction path.
 */
contract Slot is SlotViews, SlotOccupancy, SlotEscrow, SlotAdmin, Versioned {
    /// @inheritdoc Versioned
    /// @dev Bump in the same commit as any change to this contract's code.
    function version() public pure virtual override returns (uint64) {
        return 1;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(SlotInit calldata p) external initializer nonReentrant {
        if (
            address(p.currency) != address(0) &&
            address(p.currency).code.length == 0
        ) revert InvalidCurrency();

        // A manager is required exactly when something is mutable, and
        // forbidden otherwise, so "immutable" is a fact about the slot rather
        // than a promise about somebody's restraint.
        bool anyMutable = p.mutableTax || p.mutableRecipient || p.mutableModule;
        if (anyMutable != (p.manager != address(0))) revert InvalidManager();

        _validateRent(p.taxTerms, TermsLib.ALL);
        Manifest memory declared = _validateModule(p.moduleTerms);

        Settings storage st = _settings();
        st.currency = p.currency;
        st.manager = p.manager;
        st.mutableTax = p.mutableTax;
        st.mutableRecipient = p.mutableRecipient;
        st.mutableModule = p.mutableModule;

        _taxTerms().recipient = p.taxTerms.recipient;
        _taxTerms().rateBps = p.taxTerms.rateBps;
        _taxTerms().minRunwaySeconds = p.taxTerms.minRunwaySeconds;

        _moduleTerms().target = p.moduleTerms.target;
        _moduleTerms().settings = p.moduleTerms.settings;

        Manifest storage accepted = _manifest();
        accepted.scopes = declared.scopes;
        accepted.feeBps = declared.feeBps;
        accepted.feeRecipient = declared.feeRecipient;

        _occupancy().lastSettled = uint64(block.timestamp);

        // The module is attached; tell it, if it asked to be told. Honoured
        // strictly when it declared `strict`: refusing here fails the creation,
        // which is the creator's own transaction and nobody else's problem.
        _after(
            F_ON_INSTALL,
            abi.encodeCall(ISlotModule.onInstall, (_ctx(msg.sender, address(0), 0, 0)))
        );

        emit Initialized(
            address(p.currency),
            p.manager,
            p.mutableTax,
            p.mutableRecipient,
            p.mutableModule,
            p.taxTerms,
            p.moduleTerms
        );
    }

    receive() external payable {
        revert InvalidValue();
    }
}
