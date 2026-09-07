// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ISellableSlot} from "./ISellableSlot.sol";
import {OfferBookInternals} from "./OfferBookInternals.sol";
import {Versioned} from "../../Versioned.sol";
import "./OfferBookErrors.sol";

/// @title OfferBook — standing bids, and the fill that settles them
///
/// @notice Anyone may post "I will take that slot at this price". The occupant
///         reads the best one and calls {acceptOffer}, which reprices the slot
///         to that bid and seats the bidder in one transaction.
///
/// @dev ── WHY THE BOOK PERFORMS THE FILL ──────────────────────────────────
///
///      The core used to carry `sell`: an occupant submitted a bidder's
///      EIP-712 order and the slot seated them. That made a SECOND seating
///      path — it reset `occupiedSince` like `buy` but ran `beforeSell`
///      instead of `beforeBuy`, so every hook author had two doors to police
///      and two audit findings were the same mistake of policing one.
///
///      It is gone. A consensual sale is now two calls the core already had:
///
///          slot.selfAssess(price)   // the occupant's own price, restated
///          slot.buy(bidder, …)      // the ordinary market path
///
///      In one transaction, so nothing can be sniped between them. The
///      economics are unchanged: `buy` already refunds the outgoing occupant
///      their deposit plus the price. What changed is that there is one seating
///      path, one set of hook checks, and no order machinery in the slot.
///
///      ── WHAT THE OCCUPANT GRANTS, AND WHY THIS IS NOT A PROXY ──────────
///
///      `selfAssess` is `onlyOccupantOrOperator`, so the occupant must make
///      this book their operator first — `slot.setOperator(book, true)`. That
///      grant is keyed by tenure on the far side, so it lapses by itself when
///      the slot changes hands and cannot be inherited by the next occupant.
///
///      It is still a real power: repricing to dust would let anyone take the
///      slot cheaply. Which is exactly why THIS CONTRACT IS NOT UPGRADEABLE.
///      Behind a proxy, every occupant who ever approved it would have granted
///      that power to whatever its admin deployed next. Immutable, the code
///      they approved is the code that runs. It has no admin and no owner.
///
///      Within this code the grant is narrower still: {acceptOffer} is the only
///      function that touches a slot, it reprices only to a live offer's price,
///      and it reverts unless `msg.sender` is the occupant — so the book never
///      acts except inside a transaction the occupant sent.
///
///      ── WHY OFFERS ARE ALLOWANCE-BACKED, NOT ESCROWED ──────────────────
///
///      The obvious design escrows the bidder's price + deposit here. It is not
///      needed: the book pulls the payment during the fill and spends it in the
///      same transaction, so an allowance is as strong a guarantee at the only
///      moment it matters. If the funds are gone when the occupant accepts, the
///      `transferFrom` reverts and the seller loses gas and nothing else.
///
///      The cost is that one allowance can back offers on many slots —
///      first-come-first-served, same as any limit order. {isFundable} lets a
///      client grey out an offer whose backing has evaporated.
///
///      Note the allowance is to the BOOK, not to the slot. `buy` charges
///      `msg.sender`, and on a fill that is this contract.
///
///      ── NO SIGNATURE ───────────────────────────────────────────────────
///
///      An offer used to carry the bidder's EIP-712 signature, because
///      `Slot.sell` demanded one and `offer` stored the terms and the signature
///      without binding them. `offer()` is a transaction FROM the bidder:
///      posting it is the consent, and there is no second artefact left to
///      disagree with the terms beside it.
contract OfferBook is OfferBookInternals {
    using SafeERC20 for IERC20;


    /// @inheritdoc Versioned
    /// @dev Bump in the same commit as any change to this contract's code.
    function version() public pure virtual override returns (uint64) {
        return 2;
    }

    function offer(
        address slot,
        uint256 price,
        uint256 deposit,
        uint64 expiry
    ) external returns (uint256 id) {
        if (price == 0) revert ZeroPrice();
        if (expiry <= block.timestamp) revert BadExpiry();

        uint256 existing = _offerIdOf[slot][msg.sender];
        if (existing != 0) {
            id = existing - 1;
            Offer storage o = _offers[slot][id];
            o.price = price;
            o.deposit = deposit;
            o.expiry = expiry;
            o.cancelled = false;
            // Reposting revives a FILLED offer too. The bidder held the slot
            // and lost it; wanting back in is an ordinary intention, and the
            // alternative is one dead array entry per bidder per tenure.
            o.filled = false;
        } else {
            id = _offers[slot].length;
            _offers[slot].push(
                Offer({
                    bidder: msg.sender,
                    price: price,
                    deposit: deposit,
                    expiry: expiry,
                    cancelled: false,
                    filled: false
                })
            );
            _offerIdOf[slot][msg.sender] = id + 1;
        }

        emit Offered(slot, msg.sender, id, price, deposit, expiry);
    }

    // ─── the fill ───────────────────────────────────────────────────────────

    /**
     * @notice Accept a standing bid: reprice the slot to it and seat the
     *         bidder. Occupant only.
     *
     * @dev The whole of this book's authority over a slot, in one function.
     *
     *      Two core calls, in this order and in one transaction:
     *
     *        1. `selfAssess(price)` — the occupant's own declared price,
     *           restated to what they have agreed to sell at. Needs the
     *           operator grant.
     *        2. `buy(bidder, price, deposit, price + deposit + arrears)` — the
     *           ordinary market path. It pays the outgoing occupant their
     *           deposit plus the price, which is exactly what `sell` used to.
     *
     *      Atomic, so nothing can take the slot between the reprice and the
     *      fill. If step 2 reverts, step 1 rolls back with it and the occupant
     *      is left at the price they started at.
     *
     *      The hooks a slot has attached still get their say — `beforeSelfAssess`
     *      on the reprice and `beforeBuy` on the seating — and either may veto.
     *      That is the point of routing a sale through the market path rather
     *      than around it: there is no second door for a hook to have missed.
     */
    function acceptOffer(address slot, uint256 id) external {
        Offer storage o = _offers[slot][id];
        if (o.bidder == address(0)) revert NoSuchOffer();

        address seller = ISellableSlot(slot).occupant();
        if (msg.sender != seller) revert NotOccupant();
        if (!ISellableSlot(slot).isOperator(address(this)))
            revert NotOperator();
        if (!_live(slot, o, seller)) revert OfferNotLive();

        address currency = ISellableSlot(slot).currency();
        if (currency == address(0)) revert NativeSlotNotSupported();

        uint256 price = o.price;
        uint256 dep = o.deposit;
        address bidder = o.bidder;

        // Raising the declared price raises the escrow floor with it, and
        // `selfAssess` enforces that floor against the deposit ALREADY in the
        // slot — the seller's, not the bidder's. Reported here, with the number
        // needed, rather than surfacing from the slot as a bare
        // `InvalidDeposit` that names neither the cause nor the cure.
        uint256 floor_ = ISellableSlot(slot).minDepositForBuy(price);
        uint256 held = ISellableSlot(slot).deposit();
        if (held < floor_) revert TopUpRequired(floor_ - held);

        // Marked before any external call. The book is about to hand control to
        // the slot, its hooks and an ERC-20, and a re-entrant `acceptOffer` on
        // a half-filled row is not a state worth reasoning about.
        o.filled = true;

        // Reprice FIRST, then quote. `quoteBuy` charges the sitting price, so
        // asking before the reprice quotes the price being replaced — which on
        // a higher bid is too little, and `buy` then refuses its own
        // `maxPayment` with `PaymentAboveMax`.
        ISellableSlot(slot).selfAssess(price);

        // Pull from the bidder, spend it on their behalf, leave nothing behind.
        // `buy` charges `msg.sender`, and on a fill that is this book — which
        // is why the allowance `_fundable` checks is to the book, not the slot.
        uint256 owed = ISellableSlot(slot).quoteBuy(bidder, dep);
        IERC20(currency).safeTransferFrom(bidder, address(this), owed);
        IERC20(currency).forceApprove(slot, owed);

        ISellableSlot(slot).buy(bidder, price, dep, owed);

        // Never leave an allowance standing between calls.
        IERC20(currency).forceApprove(slot, 0);

        // Cannot happen against a canonical slot. Asserted because this book is
        // repricing somebody else's position, and a silent no-op here would
        // leave the seller repriced and not paid.
        if (ISellableSlot(slot).occupant() != bidder) revert FillFailed();

        emit Filled(slot, bidder, id, seller, price, dep);
    }

    /// @notice A bidder's standing offer on a slot, if any.
    /// @dev The client needs this to say "replace your 70" rather than "make an
    ///      offer" — otherwise replacement looks like a bug the first time it
    ///      happens.
    function offerOf(address slot, address bidder)
        external
        view
        returns (bool has, uint256 id, Offer memory o)
    {
        uint256 stored = _offerIdOf[slot][bidder];
        if (stored == 0) return (false, 0, o);
        id = stored - 1;
        o = _offers[slot][id];
        has = !o.cancelled && o.expiry > block.timestamp;
    }

    /// @notice Withdraw your offer. Revoking the allowance also works, but this
    ///         takes it off the board so nobody wastes gas on it.
    /// @dev The `_offerIdOf` pointer is deliberately kept: posting again reuses
    ///      this array entry rather than growing the board with a fresh one.
    function cancel(address slot, uint256 id) external {
        Offer[] storage list = _offers[slot];
        if (id >= list.length) revert NoSuchOffer();
        Offer storage o = list[id];
        if (o.bidder != msg.sender) revert NotBidder();
        if (o.cancelled) revert AlreadyCancelled();
        o.cancelled = true;
        emit Cancelled(slot, msg.sender, id);
    }


    // ═══════════════════════════════════════════════════════════
    // READS
    // ═══════════════════════════════════════════════════════════

    /// @notice The highest live, funded offer on `slot`.
    ///
    /// @dev Sorted at read time rather than on insert. Posting an offer is the
    ///      frequent action and should stay cheap; the occupant reads this once
    ///      when they decide to sell. A stored ordering would also go stale the
    ///      moment a bidder's balance moved, since "best" here means best
    ///      *fundable*, not merely best quoted.
    ///
    ///      Returns `found == false` rather than reverting on an empty board —
    ///      no offers is an ordinary state, not an error.
    function best(address slot)
        public
        view
        returns (bool found, uint256 id, Offer memory o)
    {
        Offer[] storage list = _offers[slot];
        address occupant = ISellableSlot(slot).occupant();
        uint256 bestPrice;
        for (uint256 i; i < list.length; ++i) {
            Offer storage c = list[i];
            // Price first: `_live` reads three foreign slots, so skipping a
            // loser before asking is worth the extra branch.
            if (c.price <= bestPrice) continue;
            if (!_live(slot, c, occupant)) continue;
            found = true;
            bestPrice = c.price;
            id = i;
        }
        if (found) o = list[id];
    }

    /// @notice Is this offer backed by the money it promises?
    /// @dev Balance AND allowance, plus its own cancelled/expired state — but
    ///      NOT occupancy. A funded offer from the current occupant still
    ///      cannot execute, so this is a narrower question than "can I sell
    ///      into it": ask `board` for that.
    function isFundable(address slot, uint256 id) external view returns (bool) {
        Offer[] storage list = _offers[slot];
        if (id >= list.length) return false;
        Offer storage o = list[id];
        if (o.cancelled || o.expiry <= block.timestamp) return false;
        return _fundable(slot, o);
    }

    function offerCount(address slot) external view returns (uint256) {
        return _offers[slot].length;
    }

    /// @notice Whether one offer could actually be accepted right now.
    ///
    /// @dev The distinction `isFundable` does NOT make. `isFundable` asks only
    ///      whether the bidder can pay; this also refuses a cancelled or
    ///      expired offer, one whose author is already the occupant, and one
    ///      whose nonce the slot has burned by filling it. A client listing
    ///      offers wants this — showing a filled order as fundable is a button
    ///      that lies, which is the same failure `_live` was written to avoid
    ///      inside `best`.
    function isLive(address slot, uint256 id) external view returns (bool) {
        Offer[] storage list = _offers[slot];
        if (id >= list.length) return false;
        return _live(slot, list[id], ISellableSlot(slot).occupant());
    }

    /// @notice How many offers on `slot` could be accepted right now.
    /// @dev The number to render beside "Orders". `offerCount` includes
    ///      cancelled, expired and already-filled bids, so counting with it
    ///      overstates the book and never goes back down.
    function liveCount(address slot) external view returns (uint256 n) {
        Offer[] storage list = _offers[slot];
        address occupant = ISellableSlot(slot).occupant();
        for (uint256 i; i < list.length; ++i) {
            if (_live(slot, list[i], occupant)) ++n;
        }
    }

    function offerAt(address slot, uint256 id) external view returns (Offer memory) {
        return _offers[slot][id];
    }

    /// @notice The whole board, for a client that wants to render it.
    /// @dev Prefer `board`, which also says which of these are actually live.
    function offers(address slot) external view returns (Offer[] memory) {
        return _offers[slot];
    }

    /// @notice The board plus, per entry, whether it can execute right now.
    ///
    /// @dev The liveness rule ships WITH the data because a client that
    ///      reimplements it drifts from it. That is not hypothetical: rendering
    ///      raw `offers()` and trusting `cancelled` showed a filled offer as a
    ///      live one, because being filled sets no flag — the bidder simply
    ///      became the occupant. One predicate, one answer, used by `best` and
    ///      by the board alike.
    function board(address slot)
        external
        view
        returns (Offer[] memory list, bool[] memory live)
    {
        list = _offers[slot];
        live = new bool[](list.length);
        address occupant = ISellableSlot(slot).occupant();
        Offer[] storage stored = _offers[slot];
        for (uint256 i; i < list.length; ++i) {
            live[i] = _live(slot, stored[i], occupant);
        }
    }

    /// @dev Can this offer be executed against `slot` right now? Cancelled and
    ///      expired are its own state; occupancy and funding are the world's.
}
