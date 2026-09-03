"use client";

import { MAX_PRICE, MAX_TAX_BPS } from "@0xslots/sdk/slots";
import { useMemo } from "react";

/**
 * The slot's arithmetic bounds.
 *
 * `MAX_PRICE` and `MAX_TAX_BPS` exist so `price * taxBps * elapsed`
 * cannot be driven to overflow — which would revert `_settle()`, and with it
 * every entry point including `liquidate()`, bricking a slot permanently. The
 * UI reads them so a price over the ceiling is caught beside the field rather
 * than discovered as an `InvalidPrice` revert after a wallet prompt.
 *
 * ── Why this no longer reads the chain ──────────────────────────────────
 *
 * The previous protocol exposed `maxPrice()` and `maxTaxBps()` as view
 * functions, and this hook read them on principle: a constant copied into a
 * client rots the day the contract changes, and this codebase had already paid
 * for that once when a stale `IUTILITY_INTERFACE_ID` quietly failed every
 * genuine utility's ERC-165 check.
 *
 * The hook-based `Slot` does not expose them at all — they are compile-time
 * constants in `SlotStorage.sol` with no getters — so there is nothing left to
 * read. The SDK mirrors them as `MAX_PRICE` / `MAX_TAX_BPS` and is versioned
 * alongside the ABIs, which is now the only place the value can come from and
 * the place a drift would be caught.
 *
 * The signature is unchanged so call sites keep treating the result as
 * advisory, with the contract as the real backstop.
 */
export function useSlotBounds(_slotAddress?: `0x${string}`) {
  return useMemo(() => ({ maxPrice: MAX_PRICE, maxTaxBps: MAX_TAX_BPS }), []);
}
