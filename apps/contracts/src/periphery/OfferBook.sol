// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ISellableSlot {
    function occupant() external view returns (address);
    function price() external view returns (uint256);
    function currency() external view returns (address);
}

/// @title OfferBook — standing bids an occupant can sell into
///
/// @notice Anyone may post "I will take that slot at this price". The occupant
///         reads the best one and calls `Slot.sell(bidder, price, deposit)`.
///         Nothing here is privileged: the book never holds a slot, never holds
///         funds, and the core knows nothing about it. Deploy another and it
///         competes.
///
/// @dev ── WHY OFFERS ARE ALLOWANCE-BACKED, NOT ESCROWED ─────────────────
///      The obvious design escrows the bidder's price + deposit here. It does
///      not work, and the reason is worth writing down.
///
///      `Slot.sell(buyer, …)` pulls from `buyer` and seats `buyer`. For the
///      book to hold the money, the book would have to BE the buyer — and then
///      the book occupies the slot, not the bidder. Splitting them needs a
///      `payer` parameter, and that is quietly catastrophic: an occupant could
///      then call `sell(carol, bob, …)` and spend Bob's allowance to seat
///      somebody else. Bob's approval would stop meaning "I want this slot"
///      and start meaning "anyone may spend this".
///
///      So offers are backed by an ERC-20 allowance to the SLOT, exactly as
///      every on-chain order book does it. The guarantee arrives at the only
///      moment it matters: if the funds are gone when the occupant sells, the
///      `transferFrom` reverts and the seller loses gas and nothing else.
///
///      The cost is that one allowance can back offers on many slots —
///      first-come-first-served, same as any limit order. `fundable()` below
///      lets a client grey out an offer whose backing has evaporated.
contract OfferBook {
    struct Offer {
        address bidder;
        /// @dev What the bidder pays the occupant. Also the price they will
        ///      then hold the slot at.
        uint256 price;
        /// @dev Escrow they will post to cover their own tax.
        uint256 deposit;
        uint64 expiry;
        bool cancelled;
    }

    /// @notice slot => offers. Ordering is computed, not stored — see `best`.
    mapping(address => Offer[]) internal _offers;

    /// @notice slot => bidder => id + 1. Zero means "no offer".
    ///
    /// @dev One offer per bidder per slot, enforced here rather than left to
    ///      the client. Two offers from one address are backed by the SAME
    ///      allowance, so at most one of them could ever execute — the other is
    ///      a promise that silently cannot be kept, and because `best` picks
    ///      the highest, a stale high one masks its owner's real intent.
    ///
    ///      Offset by one so a fresh mapping reads as absent without needing a
    ///      second flag, the same reason ids elsewhere start at 1.
    mapping(address => mapping(address => uint256)) internal _offerIdOf;

    event Offered(
        address indexed slot,
        address indexed bidder,
        uint256 indexed id,
        uint256 price,
        uint256 deposit,
        uint64 expiry
    );
    event Cancelled(address indexed slot, address indexed bidder, uint256 indexed id);
    /// @dev Distinct from `Cancelled`: the bidder withdrew that one, whereas
    ///      this one was consumed. An indexer that conflates them cannot tell a
    ///      filled bid from an abandoned one.
    event Retired(address indexed slot, address indexed bidder, uint256 indexed id);

    error NotBidder();
    error AlreadyCancelled();
    error NotFilled();
    error BadExpiry();
    error ZeroPrice();
    error NoSuchOffer();

    /// @notice Post a standing bid, REPLACING your previous one on this slot.
    ///
    /// @dev The bidder must separately `approve(slot, price + deposit)` on the
    ///      slot's currency. Not enforced here — an unfunded offer is legal and
    ///      simply never executes, which is cheaper than policing it.
    ///
    ///      Replacing rather than appending, and rather than reverting: raising
    ///      or lowering your bid is the ordinary thing a bidder does, and
    ///      making them cancel first would leave a window where they have no
    ///      offer standing at all. A cancelled offer is revived by the same
    ///      call, reusing its slot in the array.
    ///
    ///      A client sees the replacement as a second `Offered` with the same
    ///      `id`; last one wins, the same rule metadata updates follow.
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
        } else {
            id = _offers[slot].length;
            _offers[slot].push(
                Offer({
                    bidder: msg.sender,
                    price: price,
                    deposit: deposit,
                    expiry: expiry,
                    cancelled: false
                })
            );
            _offerIdOf[slot][msg.sender] = id + 1;
        }

        emit Offered(slot, msg.sender, id, price, deposit, expiry);
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

    /// @notice Retire an offer whose bidder now occupies the slot.
    ///
    /// @dev `Slot.sell` pulls on an allowance and tells nobody — this book is
    ///      periphery, and the core has no business knowing it exists. So a
    ///      filled offer is left sitting in storage looking alive. `best`
    ///      already refuses to return it, but "hidden" is not "gone": if the
    ///      bidder is later bought out they stop being the occupant and the
    ///      offer springs back to life, letting the NEW occupant sell into a
    ///      price its author named in a different era. Real order books do not
    ///      resurrect filled orders, and neither should this one.
    ///
    ///      Permissionless because the condition is objective — the bidder
    ///      either holds the slot right now or they do not, and anyone can
    ///      read that. There is nothing to judge and nothing to steal: the
    ///      only effect is retiring an offer that cannot execute anyway, since
    ///      `Slot.sell` would revert `CannotBuyFromYourself`.
    function retire(address slot, uint256 id) external {
        Offer storage o = _offers[slot][id];
        if (o.cancelled) revert AlreadyCancelled();
        if (ISellableSlot(slot).occupant() != o.bidder) revert NotFilled();
        o.cancelled = true;
        emit Retired(slot, o.bidder, id);
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
    function fundable(address slot, uint256 id) external view returns (bool) {
        Offer[] storage list = _offers[slot];
        if (id >= list.length) return false;
        Offer storage o = list[id];
        if (o.cancelled || o.expiry <= block.timestamp) return false;
        return _fundable(slot, o);
    }

    function offerCount(address slot) external view returns (uint256) {
        return _offers[slot].length;
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
    function _live(address slot, Offer storage o, address occupant)
        internal
        view
        returns (bool)
    {
        if (o.cancelled || o.expiry <= block.timestamp) return false;
        // Unusable: `Slot.sell` refuses `CannotBuyFromYourself`. Surfaced as an
        // exit it would be a button that lies — and after a fill this is
        // exactly the state a consumed offer lands in.
        if (o.bidder == occupant) return false;
        return _fundable(slot, o);
    }

    function _fundable(address slot, Offer storage o) internal view returns (bool) {
        address currency = ISellableSlot(slot).currency();
        // A native slot cannot be sold into at all — `Slot.sell` reverts with
        // `SellNeedsErc20`, because there is no allowance to pull against.
        if (currency == address(0)) return false;

        uint256 owed = o.price + o.deposit;
        return
            IERC20(currency).balanceOf(o.bidder) >= owed &&
            IERC20(currency).allowance(o.bidder, slot) >= owed;
    }
}
