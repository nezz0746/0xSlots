// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ISlotHook} from "./ISlotHook.sol";
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
     *
     *      PRICE BEFORE DEPOSIT, and it used to be the other way round. Every
     *      other price/deposit pair in the protocol is price-first —
     *      `SellOrder`, `SlotContext`, `Bought`, `Offered`,
     *      `SlotMath.depositFor` — so this one function inverted the order a
     *      caller's hands already knew. Two adjacent `uint256`s, and swapped it
     *      does not revert: it buys at your deposit and escrows your price.
     *      Fixed in the redeploy that was already breaking every client, since
     *      it is the one rename an old caller survives silently.
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

        address prev = _occupant;
        if (account == prev) revert CannotBuyFromYourself();

        uint256 owedToPrev = prev == address(0) ? 0 : _price;

        // Terms land BEFORE the hook is asked, not after.
        //
        // The hook was previously handed `_ctx` built from the outgoing
        // configuration and the slot then charged the incoming one, so any
        // hook sizing a requirement from `ctx.taxBps` under-charged by
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
     * ── `sell` USED TO LIVE HERE ────────────────────────────────────────────
     *
     * It took a buyer's EIP-712 order and seated them at a price the two had
     * agreed. It is gone, and this note is here so nobody adds it back without
     * knowing why.
     *
     * It was a SECOND seating path. It reset `occupiedSince` like `buy`, but
     * routed through `beforeSell` rather than `beforeBuy` — so every hook
     * author had to police two doors, and two audit findings were the same
     * mistake of policing only one. Its `order.price` was both the payment and
     * the new declared price, so one number chosen by one party settled what
     * changed hands and what the slot was then worth; when that party signed
     * both sides, nothing was left to check.
     *
     * What it offered over the market — choosing your counterparty — is the
     * one thing this protocol is built to deny. An occupant who wants price P
     * calls `selfAssess(P)` and anybody may take it. They receive P either way.
     *
     * A consensual sale is now `selfAssess` then `buy`, in one transaction, by
     * a periphery book the occupant has made its operator for their tenure.
     * The economics are identical — `buy` already refunds the outgoing occupant
     * `_deposit + _price` — but there is one seating path, one set of hook
     * checks, and 128 lines and three storage mappings less in every slot.
     */

    /// @notice Give up the slot and take back what is left of your deposit.
    function release() external nonReentrant onlyOccupant {
        _settle();

        address prev = _occupant;
        uint256 refund = _deposit;

        // Cached before the swap: this callback belongs to the hook that
        // governed the tenure now ending, not to whatever replaces it — and to
        // the configuration that hook was attached with, not its successor's.
        address outgoing = hook;
        uint8 outgoingFlags = _hookFlags;
        bytes32 outgoingData = hookData;
        uint256 outgoingTax = taxBps;

        _vacate();
        _applyPending();

        if (refund > 0) _payOrCredit(prev, refund);
        _flush();

        emit Released(prev, refund);
        _afterOn(
            outgoing,
            outgoingFlags,
            F_AFTER_RELEASE,
            abi.encodeCall(
                ISlotHook.afterRelease,
                (_ctxFor(msg.sender, prev, 0, 0, outgoingData, outgoingTax))
            )
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
        bytes32 outgoingData = hookData;
        uint256 outgoingTax = taxBps;

        _vacate();
        _applyPending();
        _flush();

        emit Liquidated(msg.sender, prev);
        _afterOn(
            outgoing,
            outgoingFlags,
            F_AFTER_LIQUIDATE,
            abi.encodeCall(
                ISlotHook.afterLiquidate,
                (_ctxFor(msg.sender, prev, 0, 0, outgoingData, outgoingTax))
            )
        );
    }


}
