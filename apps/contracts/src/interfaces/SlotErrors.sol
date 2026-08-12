// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ═══════════════════════════════════════════════════════════
// SLOT ERRORS
// ═══════════════════════════════════════════════════════════
//
// File-level (free) error declarations for `Slot`. Lifted out of the contract
// body so the core reads as behaviour, not boilerplate. Selectors are derived
// from the signature, not the declaration site, so moving them here changes
// nothing on the wire — the reverts a caller decodes are identical.
//
// Declared free rather than inside an interface so `Slot` can `revert Xxx()`
// against the bare name. `SlotFactory` keeps its OWN contract-scoped copies of
// the few names it shares (`InvalidTaxPercentage`, `InvalidModule_NoCode`);
// those never meet these, because this file is imported only by `Slot`.

// ── Access / role ───────────────────────────────────────────
error NotManager();
error NotOccupant();

/// @dev Currently unreferenced. Kept to hold its place in the ABI rather than
///      silently dropping a name integrators may already decode; safe to remove
///      in the next deliberate ABI revision.
error NotFactory();

// ── Buy / occupancy ─────────────────────────────────────────
error CannotBuyFromYourself();
error InvalidPrice();
error InvalidRecipient();
error NotInsolvent();

// ── Escrow / tax ────────────────────────────────────────────
error InvalidTaxPercentage();
error InsufficientDeposit();
error NothingToCollect();
error NothingToClaim();
error InvalidLiquidationBounty();

// ── Mutability gates ────────────────────────────────────────
error TaxNotMutable();
error ModuleNotMutable();
error PolicyNotMutable();
error NoPendingUpdate();

// ── Configuration ───────────────────────────────────────────
error InvalidCurrency();
error InvalidModule_NoCode();

/// @notice `msg.value` did not match what this slot's currency mode expects.
/// @dev Native slots require exact value; ERC-20 slots require none. The
///      ERC-20 direction is what stops ETH being stranded in a token slot.
error InvalidValue();

/// @notice An uncapped native send failed in `withdraw` or `claim`.
error TransferFailed();
