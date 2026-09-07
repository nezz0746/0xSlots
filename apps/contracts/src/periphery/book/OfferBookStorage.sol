// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Versioned} from "../../Versioned.sol";

/**
 * @title OfferBookStorage
 * @notice What the book remembers, and nothing else.
 *
 * @dev The storage base exists so that every layer above it is code, which
 *      keeps the layers free to be reordered or split.
 *
 *      NOT behind a proxy, and that is deliberate. Occupants make this book
 *      their slot's operator, and an operator may reprice — enough, at a dust
 *      price, to lose the slot. An upgradeable book would mean every occupant
 *      who ever approved it had granted that power to whatever its admin later
 *      deployed. Immutable, the code they approved is the code that runs. It
 *      has no admin at all for the same reason.
 */
abstract contract OfferBookStorage is Versioned {
    struct Offer {
        address bidder;
        /// @dev What the bidder pays the occupant. Also the price they will
        ///      then hold the slot at.
        uint256 price;
        /// @dev Escrow they will post to cover their own tax.
        uint256 deposit;
        uint64 expiry;
        bool cancelled;
        /// @dev Set when the offer has been accepted. Distinct from
        ///      `cancelled`: the bidder withdrew that one, this one was
        ///      consumed, and an indexer conflating them cannot tell an
        ///      abandoned bid from a filled one.
        bool filled;
    }

    // A nonce and an EIP-712 signature used to sit in `Offer`, because
    // `Slot.sell` demanded the bidder's signature over the exact terms. The
    // book now fills the offer itself, and `offer()` is already a transaction
    // FROM the bidder — posting it is the consent. Both fields, the signature
    // check and the slot's nonce storage all went with `sell`.

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
    event Cancelled(
        address indexed slot,
        address indexed bidder,
        uint256 indexed id
    );

    /// @notice A bid was accepted: the occupant repriced to it and the bidder
    ///         was seated.
    event Filled(
        address indexed slot,
        address indexed bidder,
        uint256 indexed id,
        address seller,
        uint256 price,
        uint256 deposit
    );
}
