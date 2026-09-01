// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Multicall} from "@openzeppelin/contracts/utils/Multicall.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IUtility} from "../interfaces/IUtility.sol";
import {IOccupancyPolicy, OccupancyContext} from "../interfaces/IOccupancyPolicy.sol";
import {SlotConfig, SlotInitParams, PendingUpdate, PendingPolicyUpdate, PendingTransfer, UpdateKind, SlotInfo, ISlotEvents, EVT_BOUGHT, EVT_RELEASED, EVT_LIQUIDATED, EVT_PRICE_UPDATED, EVT_DEPOSITED, EVT_WITHDRAWN, EVT_TAX_COLLECTED, EVT_SETTLED, MAX_PRICE, MAX_TAX_BPS} from "../interfaces/ISlot.sol";
// Errors live in their own file so the contract body reads as behaviour. They
// are file-level (free) declarations — importing them makes the bare names
// available to `revert`, and the selectors are unchanged. See `SlotErrors.sol`.
import "../interfaces/SlotErrors.sol";
import {SlotFactory} from "../SlotFactory.sol";

import {SlotAccounting} from "./SlotAccounting.sol";
import {SlotSellOrder} from "./SlotSellOrder.sol";

/**
 * @title SlotOccupancy
 * @notice Taking, pricing and giving up a seat.
 *
 * @dev `buy`, `sell`, `release`, `selfAssess`, `topUp`, `setOperator`.
 *
 *      Each settles first, then mutates occupancy, then notifies — in that
 *      order, so a module never observes a half-applied transition.
 */
abstract contract SlotOccupancy is SlotAccounting, SlotSellOrder {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════
    // CORE
    // ═══════════════════════════════════════════════════════════

    /// @notice Buy the slot. `account` becomes the new occupant, `msg.sender` pays.
    /// @param account The address that will occupy the slot
    /// @param depositAmount Deposit to fund the tax escrow
    /// @param selfAssessedPrice The new self-assessed price
    function buy(
        address account,
        uint256 depositAmount,
        uint256 selfAssessedPrice
    ) external payable nonReentrant {
        if (selfAssessedPrice == 0 || selfAssessedPrice > MAX_PRICE)
            revert InvalidPrice();
        if (account == address(0)) revert InvalidRecipient();

        // Fails fast: the ERC-20 case needs no computed amount, and letting a
        // stray-value call run the policy check first would only waste gas.
        if (!_isNative() && msg.value != 0) revert InvalidValue();

        // Settle first so the policy is asked about current, not stale, state.
        // Stage 2 relies on this ordering too — see Task 6.
        _settle();

        if (account == _occupant) revert CannotBuyFromYourself();

        if (occupancyPolicy != address(0)) {
            IOccupancyPolicy(occupancyPolicy).checkBuy(
                _occupancyCtx(account, selfAssessedPrice, depositAmount)
            );
        }

        uint256 currentPrice = _price;
        address prev = _occupant;

        _applyPendingUpdates();

        _enforceMinDeposit(depositAmount, selfAssessedPrice);

        // Pull what the buyer owes. Vacant slots cost only the deposit.
        uint256 owedByBuyer = prev == address(0)
            ? depositAmount
            : currentPrice + depositAmount;
        if (_isNative()) {
            // The value is already held by this contract; there is nothing to
            // pull. This check cannot move to the top of the function because
            // `owedByBuyer` is only known after `_settle()` and the policy.
            if (msg.value != owedByBuyer) revert InvalidValue();
        } else if (owedByBuyer > 0) {
            currency.safeTransferFrom(msg.sender, address(this), owedByBuyer);
        }

        // Epoch scheduling was removed here. A buy used to be deferred to the
        // next clock boundary when `epochSeconds > 0`, on the theory that it
        // stopped an occupant being sniped by whoever's infrastructure was
        // fastest. It did not: the first commit after a boundary locked
        // everyone else out until the next one, so a two-second latency edge
        // bought a full epoch of exclusivity at a price fixed before that
        // epoch's news — a worse dynamic than the one it replaced.
        //
        // Occupancy timing now lives entirely in IOccupancyPolicy vetoes, which
        // is where it can be expressed without a second phase — MinimumTenure
        // for "not yet", MinimumPrice for "not below this".
        //
        // A buy applies immediately. Timing lives in IOccupancyPolicy vetoes,
        // which express it without a second phase — MinimumTenure for "not
        // yet", MinimumPrice for "not below this".

        // Refund the outgoing occupant. Computed here, paid
        // after the state writes, and never allowed to revert: an outgoing
        // occupant the currency refuses to pay must not be able to veto their
        // own forced sale.
        uint256 refund = prev == address(0) ? 0 : _deposit + currentPrice;

        _occupant = account;
        _price = selfAssessedPrice;
        _deposit = depositAmount;
        occupiedSince = block.timestamp;
        lastSettled = block.timestamp;

        if (refund > 0) _payOrCredit(prev, refund);

        _notifyUtility(
            TOPIC_TRANSFER,
            "onTransfer",
            abi.encodeCall(
                IUtility.onTransfer, (0, prev, account))
        );

        emit Bought(
            account,
            prev,
            currentPrice,
            depositAmount,
            selfAssessedPrice
        );
        _emitProtocolEvent(
            EVT_BOUGHT,
            abi.encode(
                account,
                prev,
                currentPrice,
                depositAmount,
                selfAssessedPrice
            )
        );
    }

    /// @notice Hand occupancy to a buyer on terms that buyer signed.
    ///
    /// @notice The missing half of `buy()`. `buy` is "anyone may take this at
    ///         the price the occupant set"; `sell` is "the occupant may hand it
    ///         to a buyer who agreed to these terms". Together they are the
    ///         whole voluntary transfer surface — until now only the first
    ///         existed, so the only exits were being bought at your own asking
    ///         price, or walking away with nothing.
    ///
    /// @dev ── WHY THIS IS NOT AN OFFER-BOOK FUNCTION ──────────────────────
    ///      Nothing here knows what an offer book is. A book is simply a place
    ///      buyers publish signed orders, and there may be any number of them,
    ///      replaceable without touching the core. The same function serves an
    ///      OTC sale to an EOA and an auction contract.
    ///
    ///      ── WHY PULL, NOT A CALLBACK ────────────────────────────────────
    ///      Payment is pulled on `buyer`'s allowance rather than by calling into
    ///      them. A callback would hand control to the counterparty in the
    ///      middle of a transfer — the one place this contract must not yield —
    ///      and buys nothing: approving is a single transaction a contract does
    ///      once.
    ///
    ///      ── WHY A SIGNATURE, NOT JUST AN ALLOWANCE ──────────────────────
    ///      This function moves a THIRD PARTY's money, and the occupant is the
    ///      one calling it. An earlier version treated a standing allowance as
    ///      sufficient consent. It is not: an allowance authorises spending,
    ///      never a price chosen by one's counterparty. Any occupant could
    ///      drain any address that had approved the slot — which is every
    ///      address that ever intended to `buy` — and could also repartition an
    ///      exact approval, turning the buyer's intended escrow into seller
    ///      proceeds and seating them insolvent.
    ///
    ///      The buyer now signs `price` and `deposit` together, so the split is
    ///      fixed by the party whose money it is. See `SlotSellOrder`.
    ///
    ///      ── SELLING LOW IS ALLOWED ──────────────────────────────────────
    ///      No floor, no slippage guard. Both sides have agreed to the number,
    ///      so there is nothing to be sandwiched by — and a low price only ever
    ///      costs the seller.
    ///
    /// @param order The buyer's signed terms: slot, buyer, price, deposit,
    ///        nonce and deadline. The buyer must have approved this slot for
    ///        `price + deposit`.
    /// @param signature The buyer's EIP-712 signature over `order`. ERC-1271
    ///        contract wallets are accepted.
    function sell(SellOrder calldata order, bytes calldata signature)
        external
        nonReentrant
        onlyOccupant
    {
        // The buyer is not the caller, so there is no value to attach and no
        // allowance to pull from. See `SellNeedsErc20`.
        if (_isNative()) revert SellNeedsErc20();

        // The buyer's own signature over these exact terms. An allowance says
        // "you may spend"; it never said "at a price my counterparty picks",
        // and treating it as though it did let any occupant drain any approver
        // and repartition their escrow into seller proceeds. See SlotSellOrder.
        _consumeSellOrder(order, signature);

        address buyer = order.buyer;
        uint256 agreedPrice = order.price;
        uint256 depositAmount = order.deposit;

        if (agreedPrice == 0 || agreedPrice > MAX_PRICE) revert InvalidPrice();
        if (buyer == address(0)) revert InvalidRecipient();

        // Settle first so the policy is asked about current, not stale, state —
        // and so a matured pending transfer is materialised before we read the
        // occupant. Identical ordering to `buy()`.
        _settle();

        if (buyer == _occupant) revert CannotBuyFromYourself();

        // LOAD-BEARING. `sell` transfers occupancy, so it must ask the policy
        // exactly as `buy` does. Skip it and every occupancy policy silently
        // becomes a suggestion: a tenure or token-holder policy could be handed
        // a buyer it would have refused, through a door it never knew existed.
        if (occupancyPolicy != address(0)) {
            IOccupancyPolicy(occupancyPolicy).checkBuy(
                _occupancyCtx(buyer, agreedPrice, depositAmount)
            );
        }

        address prev = _occupant;

        _applyPendingUpdates();
        _enforceMinDeposit(depositAmount, agreedPrice);

        // Pull the buyer's side. `prev` is never zero here — `onlyOccupant`
        // guarantees the slot is occupied — so the buyer always owes the price
        // as well as the deposit.
        uint256 owedByBuyer = agreedPrice + depositAmount;
        if (owedByBuyer > 0) {
            currency.safeTransferFrom(buyer, address(this), owedByBuyer);
        }

        // The seller's side: their escrow back, plus what they just sold for.
        // Paid after the state writes and never allowed to revert, for the same
        // reason as `buy()` — a seller the currency refuses must not be able to
        // fail a transfer they themselves initiated.
        uint256 proceeds = _deposit + agreedPrice;

        _occupant = buyer;
        _price = agreedPrice;
        _deposit = depositAmount;
        occupiedSince = block.timestamp;
        lastSettled = block.timestamp;

        if (proceeds > 0) _payOrCredit(prev, proceeds);

        _notifyUtility(
            TOPIC_TRANSFER,
            "onTransfer",
            abi.encodeCall(
                IUtility.onTransfer, (0, prev, buyer))
        );

        // `Bought` as well as `Sold`, deliberately. The occupancy transition IS
        // a buy and every indexer, subgraph and UI already reads it that way —
        // emitting only `Sold` would make slots silently vanish from feeds.
        // `Sold` carries the half that `Bought` cannot express: who initiated.
        // That is not recoverable from `tx.origin`, which reports a bundler or
        // a Safe owner rather than the seller.
        emit Sold(prev, buyer, agreedPrice, depositAmount);
        emit Bought(buyer, prev, agreedPrice, depositAmount, agreedPrice);
        _emitProtocolEvent(
            EVT_BOUGHT,
            abi.encode(buyer, prev, agreedPrice, depositAmount, agreedPrice)
        );
    }

    /// @notice Occupant releases the slot (voluntary exit)
    function release() external nonReentrant onlyOccupant {
        _settle();

        address prev = _occupant;
        uint256 refund = _deposit;

        // Flush collected tax to recipient. Routed through `_distributeTax` so
        // a utility fee is honoured here exactly as it is in `collect()` and
        // `liquidate()` — a voluntary exit is not a fee holiday.
        uint256 pendingTax = collectedTax;
        if (pendingTax > 0) {
            collectedTax = 0;
            _distributeTax(pendingTax);
        }

        // Clear slot
        _occupant = address(0);
        _price = 0;
        occupiedSince = 0;
        _deposit = 0;
        lastSettled = block.timestamp;

        // Apply pending updates (slot is now vacant)
        _applyPendingUpdates();

        if (refund > 0) _payOrCredit(prev, refund);

        _notifyUtility(
            TOPIC_RELEASE,
            "onRelease",
            abi.encodeCall(
                IUtility.onRelease, (0, prev))
        );

        emit Released(prev, refund);
        _emitProtocolEvent(EVT_RELEASED, abi.encode(prev, refund));
    }

    /// @notice Delegate slot management to an operator (e.g. an agent).
    /// @dev Operators may selfAssess and topUp. They may NOT withdraw or
    ///      release — those move the position's principal and stay
    ///      occupant-only. Bounded authority is the point.
    function setOperator(address operator, bool approved) external {
        isOperator[msg.sender][operator] = approved;
        emit OperatorSet(msg.sender, operator, approved);
    }

    /// @notice Occupant (or an approved operator) self-assesses a new price
    function selfAssess(
        uint256 newPrice
    ) external nonReentrant onlyOccupantOrOperator {
        if (newPrice == 0 || newPrice > MAX_PRICE) revert InvalidPrice();

        // Settle first: materialises any matured transfer, so the guard below
        // only rejects a genuinely still-pending one and the policy sees
        // current state.
        _settle();

        if (occupancyPolicy != address(0)) {
            IOccupancyPolicy(occupancyPolicy).checkPriceUpdate(
                _occupancyCtx(occupant(), newPrice, deposit())
            );
        }

        uint256 oldPrice = _price;
        _price = newPrice;

        // Ensure remaining deposit still meets minimum after price change
        _enforceMinDepositExisting(newPrice);

        _notifyUtility(
            TOPIC_PRICE,
            "onPriceUpdate",
            abi.encodeCall(
                IUtility.onPriceUpdate, (0, oldPrice, newPrice))
        );

        emit PriceUpdated(oldPrice, newPrice);
        _emitProtocolEvent(EVT_PRICE_UPDATED, abi.encode(oldPrice, newPrice));
    }

}
