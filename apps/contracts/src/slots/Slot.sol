// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SellOrder} from "./SlotOrders.sol";
import {SlotAdmin} from "./SlotAdmin.sol";
import {ISlotHook, SlotContext} from "./ISlotHook.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {MAX_PRICE, MAX_TAX_BPS, MONTH, BASIS_POINTS} from "./SlotStorage.sol";
import "./SlotErrors.sol";

/// @notice Everything a slot needs at birth.
struct SlotInit {
    address recipient;
    IERC20 currency;
    address manager;
    address hook;
    uint256 taxPercentage;
    uint256 minDepositSeconds;
    bool mutableTax;
    bool mutableHook;
}

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
 *      2. Terms do not move under an occupant. Tax and hook changes are
 *         proposed by the manager and land at the next occupancy transition, so
 *         what you bought into holds for as long as you hold the slot.
 *
 *      ── Extension ───────────────────────────────────────────────────────
 *
 *      One `hook`. `before` decides and may refuse; `after` records and cannot.
 *      A slot wanting several behaviours points at a composite that fans out,
 *      which keeps the loop in userland and out of the eviction path.
 */
contract Slot is SlotAdmin {
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(SlotInit calldata p) external initializer {
        if (p.recipient == address(0)) revert InvalidRecipient();
        if (p.taxPercentage == 0 || p.taxPercentage > MAX_TAX_BPS)
            revert InvalidTax();
        if (address(p.currency) != address(0) && address(p.currency).code.length == 0)
            revert InvalidCurrency();
        // A manager is required exactly when something is mutable, and
        // forbidden otherwise — so "immutable" is a fact about the slot rather
        // than a promise about somebody's restraint.
        if (p.mutableTax || p.mutableHook) {
            if (p.manager == address(0)) revert NotManager();
        } else if (p.manager != address(0)) {
            revert NotManager();
        }

        recipient = p.recipient;
        currency = p.currency;
        manager = p.manager;
        taxPercentage = p.taxPercentage;
        minDepositSeconds = p.minDepositSeconds;
        mutableTax = p.mutableTax;
        mutableHook = p.mutableHook;
        lastSettled = uint64(block.timestamp);

        if (p.hook != address(0)) {
            _hookFlags = _readHookFlags(p.hook);
            hook = p.hook;
        }

        emit Initialized(p.recipient, address(p.currency));
    }

    // ─── internals ──────────────────────────────────────────────────────────



    receive() external payable {
        revert InvalidValue();
    }
}
