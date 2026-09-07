// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// File-level so the book, its internals and any integrator revert with the
// same names. An error declared inside one contract is a different error to a
// caller decoding it.

error NotBidder();
error AlreadyCancelled();
error BadExpiry();
error ZeroPrice();
error NoSuchOffer();

// ─── filling ────────────────────────────────────────────────────────────────

/// @dev Only the sitting occupant may accept a bid on their own slot.
error NotOccupant();
/// @dev The book must be the slot's operator to reprice it. The occupant grants
///      this with `setOperator(book, true)`, and it lapses with their tenure.
error NotOperator();
/// @dev The offer is cancelled, expired, or the bidder is the occupant.
error OfferNotLive();
/// @dev Native slots cannot be filled here: a bid is funded by the bidder's
///      ERC-20 allowance, and the occupant — not the bidder — sends the
///      transaction, so there is no value to forward.
error NativeSlotNotSupported();
/// @dev Accepting a higher bid raises the declared price, and `selfAssess`
///      enforces the escrow floor at the NEW price. Reported with the shortfall
///      rather than left to revert as a bare `InvalidDeposit` from the slot.
error TopUpRequired(uint256 shortfall);
/// @dev The fill did not seat the bidder. Cannot happen against a canonical
///      slot; asserted because the book is repricing somebody else's position.
error FillFailed();
