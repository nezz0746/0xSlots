// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SellOrder} from "../../SlotOrders.sol";
import {ISellableSlot} from "./ISellableSlot.sol";
import {OfferBookInternals} from "./OfferBookInternals.sol";
import {Versioned} from "../../Versioned.sol";
import "./OfferBookErrors.sol";

/// @title OfferBook — standing bids an occupant can sell into
///
/// @dev Ported to the hook-based protocol. The port is an interface rename and
///      an import: `SellOrder` is field-for-field identical across the two, and
///      the slot's nonce accessors lost their `sell` prefix. Nothing in the
///      book's own logic is protocol-specific — it stores bids and reads
///      allowances, and the core still knows nothing about it.
///
///      Worth stating plainly, because it was nearly deleted as retired: a
///      SIGNED ORDER IS NOT AN OFFER BOOK. The signature is the settlement
///      mechanism; this is the discovery mechanism. Without it an order is a
///      blob a buyer has to hand to an occupant out of band, nobody can see
///      what a slot has been bid, and there is no best to accept.
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
///
///      ── WHY AN OFFER CARRIES A SIGNATURE ───────────────────────────────
///      An allowance says "you may spend up to this much". It never said "at a
///      price my counterparty chooses", and `Slot.sell` used to read it as
///      though it did — so an occupant could take a bidder's whole approval,
///      or take the exact approval and rebook the escrow half as their own
///      proceeds, seating the bidder insolvent.
///
///      `Slot.sell` now requires the buyer's EIP-712 signature over the exact
///      terms, so an offer here is that signed order plus a place to publish
///      it. The bidder signs off-chain for free; it costs them a wallet popup
///      and no gas.
///
///      A consequence worth noticing: because the order is self-authenticating,
///      this book is no longer load-bearing. The same signature works if it is
///      handed to the occupant directly, or published anywhere else. This
///      contract is now a convenience, not a dependency.
///
/// @dev ── Upgradeable, and what that is and is not ────────────────────────
///
///      Behind a UUPS proxy so a board can be fixed in place. That matters
///      here specifically: a bug in this contract strands a slot's discovery
///      surface, and before the overflow guard one free offer could brick
///      every read path for a slot with no way to clear it. Redeploying would
///      have meant abandoning every standing bid.
///
///      The admin's power stops at the code. The book never holds funds and
///      never moves a slot: an offer settles when the OCCUPANT submits the
///      bidder's own signature to the slot, which validates it against its own
///      domain. An admin who replaced this contract with something hostile
///      could lie about what is on the board; they could not spend a bidder's
///      allowance or seat anybody. Discovery is upgradeable, settlement is
///      not.
contract OfferBook is OfferBookInternals {

    /// @inheritdoc Versioned
    /// @dev Bump in the same commit as any change to this contract's code.
    function version() public pure virtual override returns (uint64) {
        return 2;
    }

    /// @notice Which migration has run against THIS proxy's storage.
    /// @dev OpenZeppelin already tracks this and already refuses to run a
    ///      `reinitializer(N)` twice or out of order — so an upgrade that
    ///      needs new state gets its monotonicity enforced by the library
    ///      rather than by a script. Exposed because it is otherwise
    ///      internal, and during an incident you want both numbers.

    function initialize(address admin_) external initializer {
        if (admin_ == address(0)) revert ZeroAdmin();
        admin = admin_;
    }

    /// @notice Hand the upgrade right to somebody else.
    function transferAdmin(address next) external {
        if (msg.sender != admin) revert NotAdmin();
        if (next == address(0)) revert ZeroAdmin();
        emit AdminTransferred(admin, next);
        admin = next;
    }

    function _authorizeUpgrade(address) internal view override {
        if (msg.sender != admin) revert NotAdmin();
    }

    function offer(
        address slot,
        uint256 price,
        uint256 deposit,
        uint64 expiry,
        uint256 nonce,
        bytes calldata signature
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
            o.nonce = nonce;
            o.signature = signature;
        } else {
            id = _offers[slot].length;
            _offers[slot].push(
                Offer({
                    bidder: msg.sender,
                    price: price,
                    deposit: deposit,
                    expiry: expiry,
                    cancelled: false,
                    nonce: nonce,
                    signature: signature
                })
            );
            _offerIdOf[slot][msg.sender] = id + 1;
        }

        emit Offered(slot, msg.sender, id, price, deposit, expiry);
    }

    /// @notice Rebuild the signed order an offer stands for.
    /// @dev The occupant needs this to call `Slot.sell`; a client needs it to
    ///      show what was actually signed.
    function orderOf(address slot, uint256 id)
        public
        view
        returns (SellOrder memory order, bytes memory signature)
    {
        Offer storage o = _offers[slot][id];
        order = SellOrder({
            slot: slot,
            buyer: o.bidder,
            price: o.price,
            deposit: o.deposit,
            nonce: o.nonce,
            deadline: o.expiry
        });
        signature = o.signature;
    }

    /// @notice The best standing offer as a ready-to-submit signed order.
    ///
    /// @dev Deliberately a VIEW, not an executor. `Slot.sell` is
    ///      `onlyOccupant`, so a book that tried to call it on the occupant's
    ///      behalf would arrive as the wrong `msg.sender` — and giving the
    ///      book standing to move somebody's slot is exactly the authority
    ///      this design refuses it.
    ///
    ///      So the occupant fetches the bidder's own signed order from here and
    ///      submits it themselves, in one transaction. The book publishes; it
    ///      never acts.
    function bestOrder(address slot)
        external
        view
        returns (
            bool found,
            uint256 id,
            SellOrder memory order,
            bytes memory signature
        )
    {
        (found, id, ) = best(slot);
        if (!found) return (false, 0, order, signature);
        (order, signature) = orderOf(slot, id);
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

    /// @notice Whether one offer could actually be accepted right now.
    ///
    /// @dev The distinction `fundable` does NOT make. `fundable` asks only
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
