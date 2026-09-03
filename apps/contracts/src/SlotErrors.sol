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
