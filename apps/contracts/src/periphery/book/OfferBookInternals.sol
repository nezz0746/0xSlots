// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ISellableSlot} from "./ISellableSlot.sol";
import {OfferBookStorage} from "./OfferBookStorage.sol";

/**
 * @title OfferBookInternals
 * @notice The two questions the board asks about a bid.
 *
 * @dev Separated because they are the whole correctness of this contract and
 *      they are easy to confuse. `_fundable` asks only whether the bidder can
 *      pay. `_live` is that plus everything time- and state-dependent — and it
 *      is the only one a list may filter on. A UI filtering on `_fundable`
 *      renders a filled offer as acceptable, which is a button that lies.
 *
 *      There used to be a third, `_signed`, because `Slot.sell` required the
 *      bidder's EIP-712 signature over the exact terms and `offer` stored the
 *      signature and the terms from separate arguments without binding them.
 *      The book fills offers itself now, and `offer()` is already a transaction
 *      FROM the bidder — so posting IS the consent, and there is no second
 *      artefact that can disagree with the terms beside it.
 */
abstract contract OfferBookInternals is OfferBookStorage {
    function _live(address slot, Offer storage o, address occupant)
        internal
        view
        returns (bool)
    {
        if (o.cancelled || o.filled) return false;
        if (o.expiry <= block.timestamp) return false;
        // Unusable: `buy` refuses `CannotBuyFromYourself`. Offered as an exit
        // it would be a button that lies.
        if (o.bidder == occupant) return false;
        return _fundable(slot, o);
    }

    /**
     * @dev Whether the bidder can actually pay, right now.
     *
     *      Allowance is checked against THIS BOOK, not against the slot. The
     *      book pulls the payment and then spends it on `buy`, because `buy`
     *      charges `msg.sender` — and on a fill `msg.sender` is the book, not
     *      the bidder. Before `sell` was removed the allowance went to the slot
     *      instead; an offer posted under the old arrangement reads as unfunded
     *      here, which is the correct answer rather than a stale one.
     */
    function _fundable(address slot, Offer storage o)
        internal
        view
        returns (bool)
    {
        address currency = ISellableSlot(slot).currency();
        // Native slots cannot be filled: the occupant sends the transaction, so
        // there is no way to reach the bidder's ETH.
        if (currency == address(0)) return false;

        // Guarded, because `offer` puts no ceiling on either number and this
        // predicate sits on every read path. A single free offer at
        // `price = type(uint256).max` made the checked addition panic, and
        // `best`, `board`, `liveCount` and `isLive` reverted for that slot for
        // ever — the array has no removal path and `cancel` is bidder-only, so
        // nobody could clear it.
        uint256 owed;
        unchecked { owed = o.price + o.deposit; }
        if (owed < o.price) return false;

        return
            IERC20(currency).balanceOf(o.bidder) >= owed &&
            IERC20(currency).allowance(o.bidder, address(this)) >= owed;
    }
}
