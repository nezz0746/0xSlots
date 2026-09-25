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
/// @dev A minimum runway past `MAX_MIN_RUNWAY`. The escrow floor scales with
///      it, and unbounded it priced every entrant — and every sale through the
///      offer book — out of a slot at up to ~1,657x its price.
error InvalidRunway();
error InvalidManager();
error InvalidCurrency();
error InvalidDeposit();
error InvalidValue();
error InvalidModule();
/// @dev A module fee with no one to receive it, or above 100% of the rent.
error InvalidModuleFee();
/// @dev The module answers, but not within the stipend the slot reads it under,
///      so attaching it would attach nothing.
error ModuleTooExpensive();
/// @dev The module's scopes are not the ones the manager reviewed.
error ScopesChanged();
/// @dev The module's fee is not the one the manager reviewed.
error FeeChanged();
/// @dev The module declares nothing this slot could take.
error NothingToAccept();
/// @dev A new module is queued, so the current one's scopes are moot.
error ModuleChangeQueued();

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
