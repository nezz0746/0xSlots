// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {VersionedUUPS} from "../../VersionedUUPS.sol";

/**
 * @title OfferBookStorage
 * @notice What the book remembers, and nothing else.
 *
 * @dev The storage base exists so that every layer above it is code. Solidity
 *      allocates base storage before derived, so keeping every state variable
 *      here means the layers can be reordered, split or extended without
 *      moving a single slot — which matters more than usual now the book is
 *      behind a proxy.
 *
 *      APPEND ONLY, below the marked line.
 */
abstract contract OfferBookStorage is VersionedUUPS {
    /// @notice Who may upgrade this book. Not a privilege over anyone's funds:
    ///         the book never holds any, and an offer settles against the slot
    ///         with the bidder's own signature.
    address public admin; // slot 0

    struct Offer {
        address bidder;
        /// @dev What the bidder pays the occupant. Also the price they will
        ///      then hold the slot at.
        uint256 price;
        /// @dev Escrow they will post to cover their own tax.
        uint256 deposit;
        uint64 expiry;
        bool cancelled;
        /// @dev The bidder's nonce on the slot, and their signature over
        ///      (slot, bidder, price, deposit, nonce, expiry). Held together
        ///      because `Slot.sell` needs both, and because storing the terms
        ///      apart from the signature is what would let them drift.
        uint256 nonce;
        bytes signature;
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

    event AdminTransferred(address indexed from, address indexed to);

    // ═══════════════════════════════════════════════════════════════════════
    // APPEND BELOW THIS LINE ONLY.
    // ═══════════════════════════════════════════════════════════════════════

    /// @dev Room to add state without disturbing anything a proxy already
    ///      holds. Consumed from the top as fields are added.
    uint256[45] private __gap;
}
