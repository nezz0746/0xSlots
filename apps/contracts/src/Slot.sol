// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SlotViews} from "./slot/SlotViews.sol";
import {SlotOccupancy} from "./slot/SlotOccupancy.sol";
import {SlotEscrow} from "./slot/SlotEscrow.sol";
import {SlotAdmin} from "./slot/SlotAdmin.sol";
import "./errors/SlotErrors.sol";
import {Versioned} from "./utils/Versioned.sol";
import {SlotInit, HookOffer} from "./types/SlotTypes.sol";
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
 *         always be evicted, by anyone, and nothing — no hook, no recipient, no
 *         currency — may prevent it. Every capped call and swallowed revert in
 *         this codebase exists for that sentence.
 *
 *         The ONE exception is a hook that declared `strict`, whose `after`
 *         callbacks are uncapped and fatal so it can do work that must land.
 *         A slot attaching one is only as evictable as that hook. The flag is
 *         copied at attach and readable from {SlotInfo}'s `hookPermissions`, so
 *         which kind of slot this is can be told before committing to it.
 *
 *      2. Terms do not move under an occupant. Rent and hook changes, and new
 *         permissions a manager accepts from the hook, land at the next
 *         occupancy transition, so what you bought into holds for as long as
 *         you hold the slot. A hook's fee may move sooner: it splits the rent
 *         between recipient and hook and never changes what an occupant pays.
 *
 *      ── Extension ───────────────────────────────────────────────────────
 *
 *      One `hook`, and one capped call into it per callback. `before` decides
 *      and may refuse; `after` records and cannot. A slot wanting several
 *      behaviours points at a hook that implements all of them, so there is no
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

    function initialize(SlotInit calldata p) external initializer {
        if (
            address(p.currency) != address(0) &&
            address(p.currency).code.length == 0
        ) revert InvalidCurrency();

        // A manager is required exactly when something is mutable, and
        // forbidden otherwise, so "immutable" is a fact about the slot rather
        // than a promise about somebody's restraint.
        bool anyMutable = p.mutableTax || p.mutableRecipient || p.mutableHook;
        if (anyMutable != (p.manager != address(0))) revert InvalidManager();

        _validateRent(p.taxTerms, TermsLib.ALL);
        HookOffer memory offer = _validateHook(p.hookTerms);

        Settings storage st = _settings();
        st.currency = p.currency;
        st.manager = p.manager;
        st.mutableTax = p.mutableTax;
        st.mutableRecipient = p.mutableRecipient;
        st.mutableHook = p.mutableHook;

        _taxTerms().recipient = p.taxTerms.recipient;
        _taxTerms().rateBps = p.taxTerms.rateBps;
        _taxTerms().minRunwaySeconds = p.taxTerms.minRunwaySeconds;

        _hookTerms().target = p.hookTerms.target;
        _hookTerms().config = p.hookTerms.config;

        HookOffer storage accepted = _hookOffer();
        accepted.permissions = offer.permissions;
        accepted.feeBps = offer.feeBps;
        accepted.feeRecipient = offer.feeRecipient;

        _occupancy().lastSettled = uint64(block.timestamp);

        emit Initialized(
            address(p.currency),
            p.manager,
            p.mutableTax,
            p.mutableRecipient,
            p.mutableHook,
            p.taxTerms,
            p.hookTerms
        );
    }

    receive() external payable {
        revert InvalidValue();
    }
}
