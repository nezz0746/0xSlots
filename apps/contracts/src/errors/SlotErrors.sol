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
error InvalidManager();
error InvalidCurrency();
error InvalidDeposit();
error InvalidValue();
error InvalidHook();
/// @dev A hook fee with no one to receive it, or above 100% of the rent.
error InvalidHookFee();
/// @dev The hook answers, but not within the stipend the slot reads it under,
///      so attaching it would attach nothing.
error HookReadTooExpensive();
/// @dev The hook's offer is not the one the manager reviewed.
error HookOfferChanged();
/// @dev The hook offers nothing this slot could take.
error NothingToAccept();

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
/// @dev An empty mask. The opposite mistake to `NoPendingTerms`.
error NothingProposed();
/// @dev A mask bit that names no term.
error UnknownTerms();

error PaymentAboveMax();
/// @dev The currency delivered a different amount than was transferred.
error CurrencyTakesACut(uint256 sent, uint256 received);
