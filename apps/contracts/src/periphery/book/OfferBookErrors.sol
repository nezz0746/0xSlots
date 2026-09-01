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
error NotAdmin();
error ZeroAdmin();
