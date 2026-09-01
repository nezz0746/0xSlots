// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SlotMath} from "./SlotMath.sol";
import "./SlotErrors.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {HookFlags} from "./ISlotHook.sol";
import {SlotOrders} from "./SlotOrders.sol";

/// @notice One slot, whole, as of one block.
///
/// @dev Everything a client needs to render a slot, in a single call. The
///      previous protocol had this and the rewrite lost it, so reading a slot
///      became a dozen round trips — which is not just slow: figures fetched
///      one at a time can straddle a block, so a UI could show a price from
///      one state and a solvency flag from another and draw a slot that never
///      existed. One call is one block.
///
///      Deliberately flat rather than nested. A caller decoding this should
///      not have to know which internal layer owns which field.
struct SlotInfo {
    // terms
    address recipient;
    IERC20 currency;
    address manager;
    uint256 taxPercentage;
    uint256 minDepositSeconds;
    bool mutableTax;
    bool mutableHook;
    // extension
    address hook;
    HookFlags hookFlags;
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
    // queued terms
    uint256 pendingTaxPercentage;
    address pendingHook;
    bool pendingHasTax;
    bool pendingHasHook;
    uint64 pendingProposedAt;
    bool pendingApplies;
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
    uint256 hookGas;
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
abstract contract SlotViews is SlotOrders {
    /**
     * @notice The whole slot, in one call.
     *
     * @dev Composed from the individual getters rather than reading storage
     *      again, so this can never disagree with them — a bundled view that
     *      re-derives its own answers is a second implementation to keep in
     *      step, and it will drift.
     *
     *      The individual reads stay: this is for rendering a slot, they are
     *      for asking one question cheaply.
     */
    function getSlotInfo() external view returns (SlotInfo memory info) {
        info.recipient = recipient;
        info.currency = currency;
        info.manager = manager;
        info.taxPercentage = taxPercentage;
        info.minDepositSeconds = minDepositSeconds;
        info.mutableTax = mutableTax;
        info.mutableHook = mutableHook;

        info.hook = hook;
        info.hookFlags = hookFlags();

        info.occupant = occupant();
        info.price = price();
        info.deposit = deposit();
        info.occupiedSince = occupiedSince;
        info.tenureId = tenureId;
        info.lastSettled = lastSettled;

        info.taxOwed = taxOwed();
        info.collectedTax = collectedTax;
        info.isVacant = isVacant();
        info.isInsolvent = isInsolvent();
        info.secondsUntilLiquidation = secondsUntilLiquidation();

        info.pendingTaxPercentage = pending.taxPercentage;
        info.pendingHook = pending.hook;
        info.pendingHasTax = pending.hasTax;
        info.pendingHasHook = pending.hasHook;
        info.pendingProposedAt = pending.proposedAt;
        info.pendingApplies = pendingApplies();
    }

    /// @notice Every protocol constant, in one call.
    /// @dev Reads the inherited constants rather than restating the literals,
    ///      so this cannot disagree with them.
    function getSlotConstants()
        external
        pure
        returns (SlotConstantsInfo memory c)
    {
        c.maxPrice = MAX_PRICE;
        c.maxTaxBps = MAX_TAX_BPS;
        c.basisPoints = BASIS_POINTS;
        c.month = MONTH;
        c.hookGas = HOOK_GAS;
        c.payoutGas = PAYOUT_GAS;
        c.termsDelay = TERMS_DELAY;
    }

    // ─── reads ──────────────────────────────────────────────────────────────

    function occupant() public view returns (address) {
        return _occupant;
    }

    function price() public view returns (uint256) {
        return _price;
    }

    function deposit() public view returns (uint256) {
        return _deposit;
    }

    function isVacant() public view returns (bool) {
        return _occupant == address(0);
    }

    /// @notice True when the deposit can no longer cover what is owed.
    function isInsolvent() public view returns (bool) {
        return _occupant != address(0) && taxOwed() >= _deposit;
    }

    /// @notice Seconds until the deposit runs out. `type(uint256).max` if never.
    function secondsUntilLiquidation() public view returns (uint256) {
        if (_occupant == address(0)) return type(uint256).max;
        uint256 owed = taxOwed();
        if (owed >= _deposit) return 0;
        // Inverted from the same numerator space `taxOwed` uses, rather than
        // via a per-second rate. A rate divides before it multiplies, so it
        // floors to zero for any price x tax below MONTH * BASIS_POINTS — and
        // the function then answered "never" for a position that was genuinely
        // insolvent within the month. That is the wrong direction to be wrong
        // in: it is keepers and UIs that read this.
        return SlotMath.secondsFor(_deposit - owed, _price, taxPercentage);
    }

    /**
     * @notice The smallest deposit `buy` or `sell` will accept at `price_`.
     *
     * @dev Reads the PENDING tax when one is queued, because entry is an
     *      occupancy transition and `_applyPending` runs before the funding
     *      check — so a buyer funds the terms they are buying into, not the
     *      ones they can see today. A client sizing the deposit from
     *      `taxPercentage()` underquotes through exactly that window and the
     *      buy reverts `InvalidDeposit`.
     *
     *      `selfAssess` is deliberately not covered here: it is not a
     *      transition, applies nothing, and is checked against current terms.
     */
    function minDepositForBuy(uint256 price_) public view returns (uint256) {
        if (minDepositSeconds == 0) return 0;
        uint256 tax = (pending.hasTax && pendingApplies())
            ? pending.taxPercentage
            : taxPercentage;
        return SlotMath.depositFor(price_, tax, minDepositSeconds);
    }

    /**
     * @notice What `buy` will charge for `depositAmount`.
     *
     * @dev The payment rule is not obvious and it is not stable across entry
     *      points, so the contract states it rather than leaving every client
     *      to re-derive it. A taker pays the sitting occupant's asking price
     *      plus their own deposit; a taker of a vacant slot pays only the
     *      deposit, because `_vacate` zeroes the price.
     *
     *      For a native slot this is exactly the `msg.value` to send — `buy`
     *      checks it for equality, not for sufficiency.
     */
    function quoteBuy(address account, uint256 depositAmount)
        public
        view
        returns (uint256)
    {
        return
            (_occupant == address(0) ? 0 : _price) +
            depositAmount +
            arrearsOf[account];
    }


}
