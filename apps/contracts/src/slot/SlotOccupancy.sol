// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ScopesLib} from "../libraries/ScopesLib.sol";
import {ISlotModule} from "../interfaces/ISlotModule.sol";
import {
    InvalidPrice,
    InvalidRecipient,
    InvalidValue,
    Vacant,
    NotInsolvent,
    CannotBuyFromYourself,
    PaymentAboveMax
} from "../errors/SlotErrors.sol";
import {SlotViews} from "./SlotViews.sol";
import {Occupancy} from "./SlotStorage.sol";
import {TermsLib} from "../libraries/TermsLib.sol";
import {Pending} from "../types/SlotTypes.sol";

/**
 * @title SlotOccupancy
 * @notice Who holds the slot, and every way that changes hands.
 *
 * @dev `buy`, `release`, `liquidate` — the three transitions, and the only
 *      places the occupant moves. They share one shape: settle, apply queued
 *      terms, ask the module, take the money, seat, notify.
 */
abstract contract SlotOccupancy is SlotViews {
    using TermsLib for Pending;

    // ─── occupancy ──────────────────────────────────────────────────────────

    /**
     * @notice Take the slot, naming your own price.
     *
     * @dev `account` is seated; `msg.sender` pays. Those are deliberately
     *      separable — it is what lets a contract acquire a slot on someone's
     *      behalf without any protocol scope. It is also why nothing a tenure
     *      owes outlives it: an account can be seated without asking.
     *
     *      Price before deposit, like every other price/deposit pair in the
     *      protocol. Swapped, the two `uint256`s would not revert.
     */
    function buy(
        address account,
        uint256 selfAssessedPrice,
        uint256 depositAmount,
        uint256 maxPayment
    ) external payable nonReentrant {
        if (selfAssessedPrice == 0 || selfAssessedPrice > MAX_PRICE) {
            revert InvalidPrice();
        }
        if (account == address(0)) revert InvalidRecipient();

        _settle();

        Occupancy storage o = _occupancy();
        address prev = o.occupant;
        if (account == prev) revert CannotBuyFromYourself();

        uint256 owedToPrev = prev == address(0) ? 0 : o.price;
        uint256 owed = owedToPrev + depositAmount;

        // The price is read at execution, not at quote time, so without a
        // ceiling the sitting occupant could raise it between a buyer's
        // simulation and inclusion and take their whole allowance.
        if (maxPayment != 0 && owed > maxPayment) revert PaymentAboveMax();

        if (_isNative()) {
            if (msg.value != owed) revert InvalidValue();
        } else {
            if (msg.value != 0) revert InvalidValue();
            _pull(msg.sender, owed);
        }

        uint256 refund = o.deposit + owedToPrev;

        // The outgoing occupant's own debt comes out of what they are paid. A
        // defaulter bought out before anyone liquidated them would otherwise
        // take the whole price and leave the recipient's tax behind. Whatever
        // the price cannot cover ends with their tenure, as it would at a
        // liquidation.
        if (prev != address(0)) {
            refund -= _repayDebt(prev, refund);
            delete _ledger().debtOf[prev];
        }

        // A module change landing at this buy is judged TWICE. First by the
        // module that governs the sitting occupant, under its own settings:
        // this buy ends that tenure, and whatever the occupant paid that module
        // to protect — a minimum tenure, say — must be able to refuse it.
        // Judged only by the incoming module, a manager could strip a paid-for
        // window with one day's notice by queueing a detach — or by accepting
        // new scopes from the same module that no longer ask to judge a buy.
        // Only when somebody is being displaced; a vacant slot has nobody to
        // protect.
        if (prev != address(0) && _pending().ripe(TERMS_DELAY) & TermsLib.MODULE_TERMS != 0) {
            _before(
                ScopesLib.BEFORE_BUY,
                abi.encodeCall(
                    ISlotModule.beforeBuy,
                    (_ctx(msg.sender, account, selfAssessedPrice, depositAmount))
                )
            );
        }

        // Terms land only now: debt repaid above was owed under the outgoing
        // terms, and applying pays collected tax out under those terms first.
        // They land BEFORE the second question, so the module the buyer will
        // live under judges the terms they are actually seated under.
        bool attached = _applyPending();
        _requireFunded(depositAmount, selfAssessedPrice);

        _before(
            ScopesLib.BEFORE_BUY,
            abi.encodeCall(
                ISlotModule.beforeBuy, (_ctx(msg.sender, account, selfAssessedPrice, depositAmount))
            )
        );

        o.occupant = account;
        unchecked {
            ++o.tenureId;
        }
        o.price = selfAssessedPrice;
        o.deposit = depositAmount;
        o.occupiedSince = uint64(block.timestamp);
        o.lastSettled = uint64(block.timestamp);
        // The outgoing tenure's fraction of a unit ends with it.
        o.taxCarry = 0;

        if (prev != address(0)) _payOrCredit(prev, refund);

        emit Bought(account, prev, selfAssessedPrice, depositAmount, owedToPrev);

        // A module that landed above meets the seat it inherited before it hears
        // about the buy that filled it.
        if (attached) _onInstall(account, selfAssessedPrice, depositAmount);

        _after(
            ScopesLib.AFTER_BUY,
            abi.encodeCall(
                ISlotModule.afterBuy, (_ctx(msg.sender, account, selfAssessedPrice, depositAmount))
            )
        );
    }

    /// @notice Give up the slot and take back what is left of your deposit.
    function release() external nonReentrant onlyOccupant {
        _settle();

        Occupancy storage o = _occupancy();
        address prev = o.occupant;
        uint256 refund = o.deposit;

        _vacate();

        if (refund > 0) _payOrCredit(prev, refund);
        _flush();

        emit Released(prev, refund);
        _after(
            ScopesLib.AFTER_RELEASE,
            abi.encodeCall(ISlotModule.afterRelease, (_ctx(msg.sender, prev, 0, 0)))
        );
    }

    /**
     * @notice Evict an occupant whose deposit is empty. Anyone may call.
     *
     * @dev No bounty. The reward is the slot: this leaves it vacant, and a
     *      vacant slot costs only the taker's own deposit. On an ERC-20 slot
     *      whoever wants it can evict and take it in one transaction via
     *      `multicall`. On a native slot they cannot: `multicall` is not
     *      payable, so the `buy` has to follow separately.
     */
    function liquidate() external nonReentrant {
        Occupancy storage o = _occupancy();
        if (o.occupant == address(0)) revert Vacant();
        _settle();
        if (o.deposit > 0) revert NotInsolvent();

        address prev = o.occupant;

        _vacate();
        _flush();

        emit Liquidated(msg.sender, prev);
        _after(
            ScopesLib.AFTER_LIQUIDATE,
            abi.encodeCall(ISlotModule.afterLiquidate, (_ctx(msg.sender, prev, 0, 0)))
        );
    }
}
