// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SlotViews} from "./slot/SlotViews.sol";
import {SlotOccupancy} from "./slot/SlotOccupancy.sol";
import {SlotEscrow} from "./slot/SlotEscrow.sol";
import {SlotAdmin} from "./slot/SlotAdmin.sol";
import "./errors/SlotErrors.sol";
import {Versioned} from "./utils/Versioned.sol";
import {SlotInit, Manifest} from "./types/SlotTypes.sol";
import {ISlotApp} from "./interfaces/ISlotApp.sol";
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
 *         always be evicted, by anyone, and nothing — no app, no recipient, no
 *         currency — may prevent it. Every capped call and swallowed revert in
 *         this codebase exists for that sentence.
 *
 *         The ONE exception is an app that declared `strict`, whose `after`
 *         callbacks are uncapped and fatal so it can do work that must land.
 *         A slot attaching one is only as evictable as that app. The flag is
 *         copied at attach and readable from {SlotInfo}'s `scopes`, so
 *         which kind of slot this is can be told before committing to it.
 *
 *      2. Terms do not move under an occupant. Rent and app changes, and new
 *         scopes a manager accepts from the app, land at the next buy —
 *         or sooner if the occupant lands them themselves with `applyTerms` —
 *         so what you bought into holds for as long as you hold the slot. An app's fee may move sooner: it splits the rent
 *         between recipient and app and never changes what an occupant pays.
 *
 *      ── Extension ───────────────────────────────────────────────────────
 *
 *      One `app`, and one capped call into it per callback. `before` decides
 *      and may refuse; `after` records and cannot. A slot wanting several
 *      behaviours points at an app that implements all of them, so there is no
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
        bool anyMutable = p.mutableTax || p.mutableRecipient || p.mutableApp;
        if (anyMutable != (p.manager != address(0))) revert InvalidManager();

        _validateRent(p.taxTerms, TermsLib.ALL);
        Manifest memory offer = _validateApp(p.appTerms);

        Settings storage st = _settings();
        st.currency = p.currency;
        st.manager = p.manager;
        st.mutableTax = p.mutableTax;
        st.mutableRecipient = p.mutableRecipient;
        st.mutableApp = p.mutableApp;

        _taxTerms().recipient = p.taxTerms.recipient;
        _taxTerms().rateBps = p.taxTerms.rateBps;
        _taxTerms().minRunwaySeconds = p.taxTerms.minRunwaySeconds;

        _appTerms().target = p.appTerms.target;
        _appTerms().settings = p.appTerms.settings;

        Manifest storage accepted = _manifest();
        accepted.scopes = offer.scopes;
        accepted.feeBps = offer.feeBps;
        accepted.feeRecipient = offer.feeRecipient;

        _occupancy().lastSettled = uint64(block.timestamp);

        // The app is attached; tell it, if it asked to be told. Honoured
        // strictly when it declared `strict`: refusing here fails the creation,
        // which is the creator's own transaction and nobody else's problem.
        _after(
            F_ON_INSTALL,
            abi.encodeCall(ISlotApp.onInstall, (_ctx(msg.sender, address(0), 0, 0)))
        );

        emit Initialized(
            address(p.currency),
            p.manager,
            p.mutableTax,
            p.mutableRecipient,
            p.mutableApp,
            p.taxTerms,
            p.appTerms
        );
    }

    receive() external payable {
        revert InvalidValue();
    }
}
