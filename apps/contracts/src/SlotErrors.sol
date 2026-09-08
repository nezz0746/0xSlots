// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// File-level so both the slot and the factory revert with the same names, and
// so a client decoding an error never has to know which contract produced it.

error NotManager();
error NotOccupant();
error NotOccupantOrOperator();

error InvalidPrice();
error InvalidTax();
error InvalidRecipient();
error InvalidCurrency();
error InvalidDeposit();
error InvalidValue();
error InvalidHook();

error Vacant();
error NotInsolvent();
error CannotBuyFromYourself();
error NothingToWithdraw();
error NothingToCollect();

/// @dev Thrown by the factory for an address it did not create.
error NotASlot();
error NothingToClaim();
error TransferFailed();

error NotMutable();
/// @dev Nothing is queued, so there is nothing to cancel.
error NoPendingTerms();
/// @dev A proposal that proposes nothing — both flags false. The opposite
///      mistake to `NoPendingTerms`, and they were one error until an audit
///      pointed out they name different problems to different callers.
error NothingProposed();

error PaymentAboveMax();

/// @dev A buy arrived with too little gas to apply the terms it would be
///      seated under. Deferring them is how a buyer used to dodge a hook meant
///      to gate them, so the buy is refused instead. Retry with more gas.
error InsufficientGasForTerms();
