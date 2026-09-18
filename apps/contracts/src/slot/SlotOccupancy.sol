// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ISlotHook} from "../interfaces/ISlotHook.sol";
import "../errors/SlotErrors.sol";
import {SlotViews} from "./SlotViews.sol";
import {Occupancy, Ledger} from "./SlotStorage.sol";

/**
 * @title SlotOccupancy
 * @notice Who holds the slot, and every way that changes hands.
 *
 * @dev `buy`, `release`, `liquidate` — the three transitions, and the only
 *      places the occupant moves. They share one shape: settle, apply queued
 *      terms, ask the hook, take the money, seat, notify.
 */
abstract contract SlotOccupancy is SlotViews {
    // ─── occupancy ──────────────────────────────────────────────────────────

    /**
     * @notice Take the slot, naming your own price.
     *
     * @dev `account` is seated; `msg.sender` pays. Those are deliberately
     *      separable — it is what lets a contract acquire a slot on someone's
     *      behalf without any protocol permission.
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
        _buy(account, selfAssessedPrice, depositAmount, maxPayment);
    }

    function _buy(
        address account,
        uint256 selfAssessedPrice,
        uint256 depositAmount,
        uint256 maxPayment
    ) internal {
        if (selfAssessedPrice == 0 || selfAssessedPrice > MAX_PRICE)
            revert InvalidPrice();
        if (account == address(0)) revert InvalidRecipient();

        _settle();

        Occupancy storage o = _occupancy();
        address prev = o.occupant;
        if (account == prev) revert CannotBuyFromYourself();

        uint256 owedToPrev = prev == address(0) ? 0 : o.price;

        // Debt follows the account, not the seat, so running a deposit dry and
        // retaking the vacated seat costs what staying would have.
        Ledger storage l = _ledger();
        uint256 debt = l.debtOf[account];
        if (debt != 0) {
            l.debtOf[account] = 0;
            l.collectedTax += debt;
            emit DebtRepaid(account, debt);
        }

        uint256 owed = owedToPrev + depositAmount + debt;

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
        // take the whole price and leave the recipient's tax behind.
        refund -= _repayDebt(prev, refund);

        // Terms land only now: debt repaid above was owed under the outgoing
        // terms, and applying pays collected tax out under those terms first.
        // They still land BEFORE the hook is asked, so the hook judges the
        // terms the buyer is actually seated under.
        bool attached = _applyPending();
        _requireFunded(depositAmount, selfAssessedPrice);

        _before(
            F_BEFORE_BUY,
            abi.encodeCall(
                ISlotHook.beforeBuy,
                (_ctx(msg.sender, account, selfAssessedPrice, depositAmount))
            )
        );

        o.occupant = account;
        unchecked { ++o.tenureId; }
        o.price = selfAssessedPrice;
        o.deposit = depositAmount;
        o.since = uint64(block.timestamp);
        o.lastSettled = uint64(block.timestamp);

        if (prev != address(0)) _payOrCredit(prev, refund);

        emit Bought(account, prev, selfAssessedPrice, depositAmount, owedToPrev);

        // A hook that landed above meets the seat it inherited before it hears
        // about the buy that filled it.
        if (attached) _afterAttach(account, selfAssessedPrice, depositAmount);

        _after(
            F_AFTER_BUY,
            abi.encodeCall(
                ISlotHook.afterBuy,
                (_ctx(msg.sender, account, selfAssessedPrice, depositAmount))
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
            F_AFTER_RELEASE,
            abi.encodeCall(ISlotHook.afterRelease, (_ctx(msg.sender, prev, 0, 0)))
        );
    }

    /**
     * @notice Evict an occupant whose deposit is empty. Anyone may call.
     *
     * @dev No bounty. The reward is the slot: this leaves it vacant, and a
     *      vacant slot costs only the taker's own deposit, so whoever wants it
     *      can evict and take it in one transaction via `multicall`.
     */
    function liquidate() external nonReentrant {
        _liquidate();
    }

    function _liquidate() internal {
        Occupancy storage o = _occupancy();
        if (o.occupant == address(0)) revert Vacant();
        _settle();
        if (o.deposit > 0) revert NotInsolvent();

        address prev = o.occupant;

        _vacate();
        _flush();

        emit Liquidated(msg.sender, prev);
        _after(
            F_AFTER_LIQUIDATE,
            abi.encodeCall(ISlotHook.afterLiquidate, (_ctx(msg.sender, prev, 0, 0)))
        );
    }
}
