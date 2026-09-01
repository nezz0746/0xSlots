// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// File-level so both the slot and the factory revert with the same names, and
// so a client decoding an error never has to know which contract produced it.

error NotManager();
error NotOccupant();
error NotOccupantOrOperator();
error AlreadyInitialized();

error InvalidPrice();
error InvalidTax();
error InvalidRecipient();
error InvalidCurrency();
error InvalidDeposit();
error InvalidValue();
error InvalidHook();

error Occupied();
error Vacant();
error NotInsolvent();
error CannotBuyFromYourself();
error NothingToWithdraw();
error NothingToCollect();
error NothingToClaim();
error TransferFailed();

error NotMutable();
error NoPendingUpdate();

error SellNeedsErc20();
error OrderExpired();
error OrderWrongSlot();
error OrderUsed();
error OrderBadSignature();
error PaymentAboveMax();
