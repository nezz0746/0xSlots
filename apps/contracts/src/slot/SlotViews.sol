// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SlotMath} from "../libraries/SlotMath.sol";
import "../errors/SlotErrors.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Scopes} from "../interfaces/ISlotApp.sol";
import {SlotAccounting} from "./SlotAccounting.sol";
import {TaxTerms, AppTerms, Manifest, Terms, PendingTerms} from "../types/SlotTypes.sol";
import {Settings, Occupancy} from "./SlotStorage.sol";
import {TermsLib, TermsQueue} from "../libraries/TermsLib.sol";

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
    bool mutableApp;
    Terms terms;
    Scopes scopes;
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
    PendingTerms pending;
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
    uint256 appGas;
    uint256 payoutGas;
    uint64 termsDelay;
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
    using TermsLib for TermsQueue;

    /// @notice The whole slot, in one call.
    function getSlotInfo() external view returns (SlotInfo memory info) {
        Settings storage st = _settings();
        info.currency = st.currency;
        info.manager = st.manager;
        info.mutableTax = st.mutableTax;
        info.mutableRecipient = st.mutableRecipient;
        info.mutableApp = st.mutableApp;

        info.terms = terms();
        info.scopes = scopes();

        Occupancy storage o = _occupancy();
        info.occupant = o.occupant;
        info.price = o.price;
        info.deposit = o.deposit;
        info.occupiedSince = o.since;
        info.tenureId = o.tenureId;
        info.lastSettled = o.lastSettled;

        info.taxOwed = taxOwed();
        info.collectedTax = _ledger().collectedTax;
        info.isVacant = isVacant();
        info.isInsolvent = isInsolvent();
        info.secondsUntilLiquidation = secondsUntilLiquidation();

        info.pending = pendingTerms();
    }

    /// @notice Every protocol constant, in one call.
    function getSlotConstants()
        external
        pure
        returns (SlotConstantsInfo memory c)
    {
        c.maxPrice = MAX_PRICE;
        c.maxTaxBps = MAX_TAX_BPS;
        c.basisPoints = BASIS_POINTS;
        c.month = MONTH;
        c.appGas = APP_GAS;
        c.payoutGas = PAYOUT_GAS;
        c.termsDelay = TERMS_DELAY;
    }

    // ─── governance ─────────────────────────────────────────────────────────

    function currency() public view returns (IERC20) {
        return _settings().currency;
    }

    function manager() public view returns (address) {
        return _settings().manager;
    }

    function mutableTax() external view returns (bool) {
        return _settings().mutableTax;
    }

    function mutableRecipient() external view returns (bool) {
        return _settings().mutableRecipient;
    }

    function mutableApp() external view returns (bool) {
        return _settings().mutableApp;
    }

    // ─── terms ──────────────────────────────────────────────────────────────

    /// @notice Every term in force.
    function terms() public view returns (Terms memory) {
        return Terms(_taxTerms(), _appTerms(), _manifest());
    }

    function taxTerms() external view returns (TaxTerms memory) {
        return _taxTerms();
    }

    function appTerms() external view returns (AppTerms memory) {
        return _appTerms();
    }

    /// @notice What is queued. Only the fields named by `mask` are meaningful.
    function pendingTerms() public view returns (PendingTerms memory) {
        TermsQueue storage q = _queue();
        return PendingTerms(_nextTaxTerms(), _nextAppTerms(), q.scopes, q.mask, q.proposedAt, hasRipeTerms());
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

    function app() external view returns (address) {
        return _appTerms().target;
    }

    /// @notice The app's offer as this slot accepted it. What payouts and
    ///         callbacks use.
    function manifest() external view returns (Manifest memory) {
        return _manifest();
    }

    /**
     * @notice The slot's accepted offer beside what the app offers today.
     *
     * @return accepted The slot's copy.
     * @return offered The app's current answer.
     * @return feeDiffers Accepting would change the fee now.
     * @return scopesDiffer Accepting would queue new scopes. Always false on a
     *         slot whose app is immutable, and when those scopes are queued.
     *
     * @dev Pending by comparison rather than by storage: the app publishes,
     *      and a difference is an offer waiting for the manager. Never reverts;
     *      an app that will not answer, or answers out of range, reads as
     *      offering exactly what is accepted.
     */
    function grantStatus()
        external
        view
        returns (Manifest memory accepted, Manifest memory offered, bool feeDiffers, bool scopesDiffer)
    {
        accepted = _manifest();
        offered = accepted;
        (bool ok, Manifest memory o) = _tryReadManifest(_appTerms());
        if (!ok) return (accepted, offered, false, false);
        offered = o;
        (feeDiffers, scopesDiffer) = _manifestChanges(o);
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
        return _occupancy().since;
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

    function withdrawableOf(address account) external view returns (uint256) {
        return _ledger().withdrawableOf[account];
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
        TermsQueue storage q = _queue();
        if (q.isRipe(TERMS_DELAY)) {
            TaxTerms storage next = _nextTaxTerms();
            if (q.mask & TermsLib.TAX_RATE != 0) r.rateBps = next.rateBps;
            if (q.mask & TermsLib.MIN_RUNWAY != 0) r.minRunwaySeconds = next.minRunwaySeconds;
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
    function quoteBuy(address account, uint256 depositAmount)
        public
        view
        returns (uint256)
    {
        Occupancy storage o = _occupancy();
        return
            (o.occupant == address(0) ? 0 : o.price) +
            depositAmount +
            _ledger().debtOf[account];
    }
}
