// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {SellOrder} from "../../SlotOrders.sol";
import {ISellableSlot} from "./ISellableSlot.sol";
import {OfferBookStorage} from "./OfferBookStorage.sol";

/**
 * @title OfferBookInternals
 * @notice The three questions the board asks about a bid.
 *
 * @dev Separated because they are the whole correctness of this contract and
 *      they are easy to confuse. `_fundable` asks only whether the bidder can
 *      pay. `_signed` asks whether the stored signature authorises the stored
 *      terms. `_live` is the conjunction plus everything time- and
 *      state-dependent — and it is the only one a list may filter on. A UI
 *      filtering on `_fundable` renders a filled order as acceptable, which is
 *      a button that lies.
 */
abstract contract OfferBookInternals is OfferBookStorage {
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
        // The slot burns a nonce when it fills an order. Checking it here is
        // what makes a filled offer dead ON ITS OWN, rather than merely hidden
        // while its author happens to be the occupant — no cleanup call, no
        // window in which it could come back.
        if (ISellableSlot(slot).orderUsed(o.bidder, o.nonce)) return false;
        if (!_signed(slot, o)) return false;
        return _fundable(slot, o);
    }

    /**
     * @dev Whether the stored signature actually authorises the stored terms.
     *
     *      The predicate checked funding, expiry, cancellation and the burnt
     *      nonce — every precondition of `Slot.sell` except the only one that
     *      decides whether it can execute. `offer` stores the signature and
     *      the terms from separate arguments and never binds them, so a funded
     *      bidder could post the top of the board with a garbage signature:
     *      `bestOrder` handed the occupant an order that reverts, and the real
     *      best bid stayed hidden underneath it.
     *
     *      Checked here rather than in `offer` so a signature that stops being
     *      valid later — a contract wallet changing its mind under ERC-1271 —
     *      also drops out of the board.
     */
    function _signed(address slot, Offer storage o) internal view returns (bool) {
        SellOrder memory order = SellOrder({
            slot: slot,
            buyer: o.bidder,
            price: o.price,
            deposit: o.deposit,
            nonce: o.nonce,
            deadline: o.expiry
        });
        try ISellableSlot(slot).sellOrderHash(order) returns (bytes32 digest) {
            return
                SignatureChecker.isValidSignatureNow(
                    o.bidder,
                    digest,
                    o.signature
                );
        } catch {
            return false;
        }
    }

    function _fundable(address slot, Offer storage o) internal view returns (bool) {
        address currency = ISellableSlot(slot).currency();
        // A native slot cannot be sold into at all — `Slot.sell` reverts with
        // `SellNeedsErc20`, because there is no allowance to pull against.
        if (currency == address(0)) return false;

        // Guarded, because `offer` puts no ceiling on either number and this
        // predicate sits on every read path. A single free offer at
        // `price = type(uint256).max` made the checked addition panic, and
        // `best`, `bestOrder`, `board`, `liveCount` and `isLive` reverted for
        // that slot for ever — the array has no removal path and `cancel` is
        // bidder-only, so nobody could clear it.
        uint256 owed;
        unchecked { owed = o.price + o.deposit; }
        if (owed < o.price) return false;

        return
            IERC20(currency).balanceOf(o.bidder) >= owed &&
            IERC20(currency).allowance(o.bidder, slot) >= owed;
    }
}
