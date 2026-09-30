// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SlotMath} from "../libraries/SlotMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SlotAccounting} from "./SlotAccounting.sol";
import {
    TaxTerms,
    ModuleTerms,
    ModuleFee,
    Terms,
    Pending,
    InstalledModule
} from "../types/SlotTypes.sol";
import {ModuleLib} from "../libraries/ModuleLib.sol";
import {Occupancy} from "./SlotStorage.sol";
import {TermsLib} from "../libraries/TermsLib.sol";

/**
 * @title SlotViews
 * @notice Everything you can ask a slot without changing it.
 *
 * @dev Split out because reads are the half of this contract that other
 *      people build against, and they were buried among the transitions that
 *      move the state they report. Nothing here writes; if a function in this
 *      file is not `view`, it is in the wrong file.
 *
 *      One getter per field. `SlotLens` puts them together: a whole slot, many
 *      slots, or the constants, in one call.
 */
abstract contract SlotViews is SlotAccounting {
    using TermsLib for Pending;
    using ModuleLib for InstalledModule;

    // ─── governance ─────────────────────────────────────────────────────────

    function currency() public view returns (IERC20) {
        return _governance().currency;
    }

    function manager() public view returns (address) {
        return _governance().manager;
    }

    function mutableTax() external view returns (bool) {
        return _governance().mutableTax;
    }

    function mutableRecipient() external view returns (bool) {
        return _governance().mutableRecipient;
    }

    function mutableModule() external view returns (bool) {
        return _governance().mutableModule;
    }

    // ─── terms ──────────────────────────────────────────────────────────────

    /// @notice Every term in force.
    function terms() public view returns (Terms memory) {
        return Terms({taxTerms: _taxTerms(), moduleTerms: _module().terms()});
    }

    function taxTerms() external view returns (TaxTerms memory) {
        return _taxTerms();
    }

    function moduleTerms() external view returns (ModuleTerms memory) {
        return _module().terms();
    }

    /// @notice What is queued. Only the fields named by `mask` are meaningful.
    function pending() public view returns (Pending memory) {
        return _pending();
    }

    function recipient() external view returns (address) {
        return _taxTerms().recipient;
    }

    function taxRateBps() external view returns (uint256) {
        return _taxTerms().rateBps;
    }

    function minRunwaySeconds() external view returns (uint256) {
        return _taxTerms().minRunwaySeconds;
    }

    function module() external view returns (address) {
        return _module().module;
    }

    /// @notice The module's fee as this slot accepted it. What payouts use.
    function fee() external view returns (ModuleFee memory) {
        return _module().fee;
    }

    // ─── occupancy ──────────────────────────────────────────────────────────

    function occupant() public view returns (address) {
        return _occupancy().occupant;
    }

    function price() public view returns (uint256) {
        return _occupancy().price;
    }

    function deposit() public view returns (uint256) {
        return _occupancy().deposit;
    }

    function occupiedSince() external view returns (uint64) {
        return _occupancy().occupiedSince;
    }

    function tenureId() external view returns (uint64) {
        return _occupancy().tenureId;
    }

    function lastSettled() external view returns (uint64) {
        return _occupancy().lastSettled;
    }

    // ─── money ──────────────────────────────────────────────────────────────

    function collectedTax() external view returns (uint256) {
        return _ledger().collectedTax;
    }

    function claimableOf(address account) external view returns (uint256) {
        return _ledger().claimableOf[account];
    }

    /// @notice Tax the occupant's deposit could not cover, still owed this
    ///         tenure. Zero for anyone not seated: debt ends with the seat.
    function debtOf(address account) external view returns (uint256) {
        return _ledger().debtOf[account];
    }

    function isVacant() public view returns (bool) {
        return _occupancy().occupant == address(0);
    }

    /// @notice True when the deposit can no longer cover what is owed.
    function isInsolvent() public view returns (bool) {
        Occupancy storage o = _occupancy();
        return o.occupant != address(0) && taxOwed() >= o.deposit;
    }

    /// @notice Seconds until the deposit runs out. `type(uint256).max` if never.
    function secondsUntilLiquidation() public view returns (uint256) {
        Occupancy storage o = _occupancy();
        if (o.occupant == address(0)) return type(uint256).max;
        uint256 rate = _taxTerms().rateBps;
        (uint256 owed, uint256 carry) =
            SlotMath.accrue(o.price, rate, block.timestamp - o.lastSettled, o.taxCarry);
        if (owed >= o.deposit) return 0;
        // Inverted from the same numerator space a settle uses, carry
        // included, rather than via a per-second rate, which floors to zero
        // and reads "never" for a position that is insolvent inside the month.
        return SlotMath.secondsUntilOwed(o.deposit - owed, carry, o.price, rate);
    }

    /**
     * @notice The escrow floor at `price_` under the terms in force: what
     *         `selfAssess` and `withdraw` enforce against a sitting occupant.
     *
     * @dev Queued terms are ignored, unlike {minDepositForBuy}: neither call
     *      applies them.
     */
    function minDepositToHold(uint256 price_) external view returns (uint256) {
        return _minDepositFor(price_);
    }

    /**
     * @notice The smallest deposit `buy` will accept at `price_`.
     *
     * @dev Uses the QUEUED tax and minimum deposit when they are ripe, because
     *      `buy` applies them before its funding check: a buyer funds the terms
     *      they are buying into, not the ones they can see today.
     */
    function minDepositForBuy(uint256 price_) public view returns (uint256) {
        TaxTerms memory r = _taxTerms();
        Pending storage q = _pending();
        uint16 ripe = q.ripe(TERMS_DELAY);
        if (ripe & TermsLib.TAX_RATE != 0) r.rateBps = q.taxTerms.rateBps;
        if (ripe & TermsLib.MIN_RUNWAY != 0) r.minRunwaySeconds = q.taxTerms.minRunwaySeconds;
        return SlotMath.depositFor(price_, r.rateBps, r.minRunwaySeconds);
    }

    /**
     * @notice What `buy` will charge for `depositAmount`.
     *
     * @dev A taker pays the sitting occupant's price plus their own deposit;
     *      a taker of a vacant slot pays only the deposit. For a native slot
     *      this is exactly the `msg.value` to send.
     *
     *      The first argument is the account to seat. It no longer changes the
     *      answer, since a buyer never carries debt in, and is kept so existing
     *      callers keep working.
     */
    function quoteBuy(address, uint256 depositAmount) public view returns (uint256) {
        Occupancy storage o = _occupancy();
        return (o.occupant == address(0) ? 0 : o.price) + depositAmount;
    }
}
