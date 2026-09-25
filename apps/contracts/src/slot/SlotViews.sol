// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SlotMath} from "../libraries/SlotMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Scopes} from "../interfaces/ISlotModule.sol";
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
import {Governance, Occupancy} from "./SlotStorage.sol";
import {TermsLib} from "../libraries/TermsLib.sol";

/// @notice One slot, whole, as of one block.
///
/// @dev Everything a client needs to render a slot, in a single call, so no
///      two figures can straddle a block.
struct SlotInfo {
    // governance
    IERC20 currency;
    address manager;
    bool mutableTax;
    bool mutableRecipient;
    bool mutableModule;
    Terms terms;
    Scopes scopes;
    ModuleFee fee;
    // occupancy
    address occupant;
    uint256 price;
    uint256 deposit;
    uint64 occupiedSince;
    uint64 tenureId;
    uint64 lastSettled;
    // money, as of this block
    uint256 taxOwed;
    uint256 collectedTax;
    bool isVacant;
    bool isInsolvent;
    uint256 secondsUntilLiquidation;
    Pending pending;
    /// Whether `pending` lands at the next buy.
    bool hasRipeTerms;
}

/// @notice The protocol's fixed numbers, in one call.
///
/// @dev Same argument as `SlotInfo`: a client sizing a deposit or validating a
///      price needs several of these together, and seven separate `eth_call`s
///      to fetch numbers that never change is the kind of friction that makes
///      people hardcode them instead — which is the drift this contract exists
///      to prevent.
struct SlotConstantsInfo {
    uint256 maxPrice;
    uint256 maxTaxBps;
    uint256 basisPoints;
    uint256 month;
    uint256 moduleCallbackGasLimit;
    uint256 nativePayoutGasLimit;
    uint64 termsDelay;
    uint256 maxMinRunway;
    /// `TERM_*` bits for `proposeTerms` and `cancelTerms`.
    uint16 termTaxRate;
    uint16 termRecipient;
    uint16 termMinRunway;
    uint16 termModule;
    uint16 termScopes;
}

/**
 * @title SlotViews
 * @notice Everything you can ask a slot without changing it.
 *
 * @dev Split out because reads are the half of this contract that other
 *      people build against, and they were buried among the transitions that
 *      move the state they report. Nothing here writes; if a function in this
 *      file is not `view`, it is in the wrong file.
 */
abstract contract SlotViews is SlotAccounting {
    using TermsLib for Pending;
    using ModuleLib for InstalledModule;

    /// @notice The whole slot, in one call.
    function getSlotInfo() external view returns (SlotInfo memory info) {
        Governance storage st = _governance();
        info.currency = st.currency;
        info.manager = st.manager;
        info.mutableTax = st.mutableTax;
        info.mutableRecipient = st.mutableRecipient;
        info.mutableModule = st.mutableModule;

        info.terms = terms();
        info.scopes = scopes();
        info.fee = _module().fee;

        Occupancy storage o = _occupancy();
        info.occupant = o.occupant;
        info.price = o.price;
        info.deposit = o.deposit;
        info.occupiedSince = o.occupiedSince;
        info.tenureId = o.tenureId;
        info.lastSettled = o.lastSettled;

        info.taxOwed = taxOwed();
        info.collectedTax = _ledger().collectedTax;
        info.isVacant = isVacant();
        info.isInsolvent = isInsolvent();
        info.secondsUntilLiquidation = secondsUntilLiquidation();

        info.pending = pending();
        info.hasRipeTerms = hasRipeTerms();
    }

    /// @notice Every protocol constant, in one call.
    function getSlotConstants() external pure returns (SlotConstantsInfo memory c) {
        c.maxPrice = MAX_PRICE;
        c.maxTaxBps = MAX_TAX_BPS;
        c.basisPoints = BASIS_POINTS;
        c.month = MONTH;
        c.moduleCallbackGasLimit = MODULE_CALLBACK_GAS_LIMIT;
        c.nativePayoutGasLimit = NATIVE_PAYOUT_GAS_LIMIT;
        c.termsDelay = TERMS_DELAY;
        c.maxMinRunway = MAX_MIN_RUNWAY;
        c.termTaxRate = TERM_TAX_RATE;
        c.termRecipient = TERM_RECIPIENT;
        c.termMinRunway = TERM_MIN_RUNWAY;
        c.termModule = TERM_MODULE;
        c.termScopes = TERM_SCOPES;
    }

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
        uint256 owed = taxOwed();
        if (owed >= o.deposit) return 0;
        // Inverted from the same numerator space `taxOwed` uses rather than via
        // a per-second rate, which floors to zero and reads "never" for a
        // position that is insolvent inside the month.
        return SlotMath.secondsFor(o.deposit - owed, o.price, _taxTerms().rateBps);
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
        if (q.isRipe(TERMS_DELAY)) {
            if (q.mask & TermsLib.TAX_RATE != 0) r.rateBps = q.taxTerms.rateBps;
            if (q.mask & TermsLib.MIN_RUNWAY != 0) {
                r.minRunwaySeconds = q.taxTerms.minRunwaySeconds;
            }
        }
        return SlotMath.depositFor(price_, r.rateBps, r.minRunwaySeconds);
    }

    /**
     * @notice What `buy` will charge for `depositAmount`.
     *
     * @dev A taker pays the sitting occupant's price plus their own deposit and
     *      any debt; a taker of a vacant slot pays only the deposit. For a
     *      native slot this is exactly the `msg.value` to send.
     */
    function quoteBuy(address account, uint256 depositAmount) public view returns (uint256) {
        Occupancy storage o = _occupancy();
        return (o.occupant == address(0) ? 0 : o.price) + depositAmount + _ledger().debtOf[account];
    }
}
