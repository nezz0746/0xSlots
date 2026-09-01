// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ISlotHook} from "./ISlotHook.sol";
import {SellOrder} from "./SlotOrders.sol";
import "./SlotErrors.sol";
import {SlotViews} from "./SlotViews.sol";

/**
 * @title SlotOccupancy
 * @notice Who holds the slot, and every way that changes hands.
 *
 * @dev `buy`, `sell`, `release`, `liquidate` — the four transitions, and the
 *      only places `_occupant` moves. They share one shape: settle, apply
 *      queued terms, ask the hook, take the money, seat, notify. Reading them
 *      side by side is the point of the file; they were previously separated
 *      by the holding and payout functions.
 */
abstract contract SlotOccupancy is SlotViews {
    // ─── occupancy ──────────────────────────────────────────────────────────

    /**
     * @notice Take the slot, naming your own price.
     *
     * @dev `account` is seated; `msg.sender` pays. Those are deliberately
     *      separable — it is what lets a contract acquire a slot on someone's
     *      behalf without any protocol permission.
     */
    function buy(
        address account,
        uint256 depositAmount,
        uint256 selfAssessedPrice,
        uint256 maxPayment
    ) external payable nonReentrant {
        _buy(account, depositAmount, selfAssessedPrice, maxPayment);
    }

    function _buy(
        address account,
        uint256 depositAmount,
        uint256 selfAssessedPrice,
        uint256 maxPayment
    ) internal {
        if (selfAssessedPrice == 0 || selfAssessedPrice > MAX_PRICE)
            revert InvalidPrice();
        if (account == address(0)) revert InvalidRecipient();

        _settle();

        address prev = _occupant;
        if (account == prev) revert CannotBuyFromYourself();

        uint256 owedToPrev = prev == address(0) ? 0 : _price;

        // Terms land BEFORE the hook is asked, not after.
        //
        // The hook was previously handed `_ctx` built from the outgoing
        // configuration and the slot then charged the incoming one, so any
        // hook sizing a requirement from `ctx.taxPercentage` under-charged by
        // the full ratio of the two rates. Asking a policy to judge terms the
        // same transaction is about to discard is not a policy check.
        _applyPending();
        _requireFunded(depositAmount, selfAssessedPrice);

        _before(
            F_BEFORE_BUY,
            abi.encodeCall(
                ISlotHook.beforeBuy,
                (_ctx(msg.sender, account, selfAssessedPrice, depositAmount))
            )
        );

        // Arrears follow the account, not the seat. Settling can only take
        // what the deposit held; the rest is charged here, so running a
        // deposit dry and retaking the vacated seat costs what staying would
        // have.
        uint256 debt = arrearsOf[account];
        if (debt != 0) {
            arrearsOf[account] = 0;
            collectedTax += debt;
        }

        uint256 owed = owedToPrev + depositAmount + debt;

        // The price is read at execution, not at quote time, so without a
        // ceiling the sitting occupant can raise it between a buyer's
        // simulation and inclusion and take their whole allowance. Native is
        // incidentally protected by the exact-value check below; ERC-20 was
        // not protected at all.
        if (maxPayment != 0 && owed > maxPayment) revert PaymentAboveMax();

        if (_isNative()) {
            if (msg.value != owed) revert InvalidValue();
        } else {
            if (msg.value != 0) revert InvalidValue();
            _pull(msg.sender, owed);
        }

        uint256 refund = _deposit + owedToPrev;

        _occupant = account;
        unchecked { ++tenureId; }
        _price = selfAssessedPrice;
        _deposit = depositAmount;
        occupiedSince = uint64(block.timestamp);
        lastSettled = uint64(block.timestamp);

        if (prev != address(0)) _payOrCredit(prev, refund);

        emit Bought(account, prev, selfAssessedPrice, depositAmount, owedToPrev);
        _after(
            F_AFTER_BUY,
            abi.encodeCall(
                ISlotHook.afterBuy,
                (_ctx(msg.sender, account, selfAssessedPrice, depositAmount))
            )
        );
    }

    /**
     * @notice Hand the slot to a buyer on terms that buyer signed.
     *
     * @dev The missing half of `buy`. `buy` is "anyone may take this at the
     *      price the occupant set"; `sell` is "the occupant may hand it to a
     *      buyer who agreed to these terms". Without it the only exits were
     *      being bought at your own asking price, or walking away with nothing.
     *
     *      ERC-20 only: payment is pulled on the buyer's allowance, and native
     *      ETH has none.
     */
    function sell(SellOrder calldata order, bytes calldata signature)
        external
        nonReentrant
        onlyOccupant
    {
        if (_isNative()) revert SellNeedsErc20();
        if (order.price == 0 || order.price > MAX_PRICE) revert InvalidPrice();
        if (order.buyer == address(0)) revert InvalidRecipient();

        _consumeOrder(order, signature);
        _settle();

        address prev = _occupant;
        if (order.buyer == prev) revert CannotBuyFromYourself();

        // Applied before the hook is asked, for the same reason as `buy`.
        _applyPending();
        _requireFunded(order.deposit, order.price);

        _before(
            F_BEFORE_SELL,
            abi.encodeCall(
                ISlotHook.beforeSell,
                (_ctx(msg.sender, order.buyer, order.price, order.deposit))
            )
        );

        uint256 debt = arrearsOf[order.buyer];
        if (debt != 0) {
            arrearsOf[order.buyer] = 0;
            collectedTax += debt;
        }

        _pull(order.buyer, order.price + order.deposit + debt);

        uint256 proceeds = _deposit + order.price;

        _occupant = order.buyer;
        unchecked { ++tenureId; }
        _price = order.price;
        _deposit = order.deposit;
        occupiedSince = uint64(block.timestamp);
        lastSettled = uint64(block.timestamp);

        _payOrCredit(prev, proceeds);

        emit Sold(prev, order.buyer, order.price, order.deposit);
        // `Bought` as well, deliberately: the occupancy transition IS a buy and
        // every indexer and feed already reads it that way. Emitting only
        // `Sold` would make slots silently vanish from anything watching.
        emit Bought(order.buyer, prev, order.price, order.deposit, order.price);
        _after(
            F_AFTER_SELL,
            abi.encodeCall(
                ISlotHook.afterSell,
                (_ctx(msg.sender, order.buyer, order.price, order.deposit))
            )
        );
    }

    /// @notice Give up the slot and take back what is left of your deposit.
    function release() external nonReentrant onlyOccupant {
        _settle();

        address prev = _occupant;
        uint256 refund = _deposit;

        // Cached before the swap: this callback belongs to the hook that
        // governed the tenure now ending, not to whatever replaces it.
        address outgoing = hook;
        uint8 outgoingFlags = _hookFlags;

        _vacate();
        _applyPending();

        if (refund > 0) _payOrCredit(prev, refund);
        _flush();

        emit Released(prev, refund);
        _afterOn(
            outgoing,
            outgoingFlags,
            F_AFTER_RELEASE,
            abi.encodeCall(ISlotHook.afterRelease, (_ctx(msg.sender, prev, 0, 0)))
        );
    }

    /**
     * @notice Evict an occupant whose deposit is empty. Anyone may call.
     *
     * @dev No bounty. The reward is the slot: this leaves it vacant, and a
     *      vacant slot costs only the taker's own deposit — so whoever actually
     *      wants it can evict and take it in one transaction — via the
     *      inherited `multicall` on an ERC-20 slot, or via a periphery taker
     *      that forwards value on a native one. Neither belongs in the core:
     *      "evict, then buy" is a composition of two public entry points, and
     *      baking it in bought one currency's convenience at the cost of a
     *      second seating path to keep correct.
     *      Paying keepers out of the recipient's accrued tax funded the
     *      incentive from the wrong pocket, and across tenures that were not
     *      even the defaulter's.
     */
    function liquidate() external nonReentrant {
        _liquidate();
    }

    function _liquidate() internal {
        if (_occupant == address(0)) revert Vacant();
        _settle();
        if (_deposit > 0) revert NotInsolvent();

        address prev = _occupant;
        address outgoing = hook;
        uint8 outgoingFlags = _hookFlags;

        _vacate();
        _applyPending();
        _flush();

        emit Liquidated(msg.sender, prev);
        _afterOn(
            outgoing,
            outgoingFlags,
            F_AFTER_LIQUIDATE,
            abi.encodeCall(ISlotHook.afterLiquidate, (_ctx(msg.sender, prev, 0, 0)))
        );
    }


}
