/**
 * The kinds of event the explorer can render.
 *
 * Every name here is produced by `lib/normalize-events.ts` and backed by a real
 * table in `packages/ponder/ponder.schema.ts`. The V2 SDK names
 * (`landOpened`, `slotCreated`, `slotPurchased`, `slotReleased`,
 * `priceUpdated`) and the V3 names with no successor are gone rather than kept
 * as aliases:
 *
 *   * `LiquidationBountyUpdated` — there are no liquidation bounties.
 *   * `ModuleProposed` — there are no modules. The hook dimension of
 *     `termsProposedEvent` replaces it, and is named `Hook Proposed`.
 *   * `PriceUpdate` / `TaxCollect` — the tables are `priceSetEvent` and
 *     `taxCollectedEvent`, and the labels follow them.
 *
 * A dead name in this union is worse than a missing one: it typechecks a badge
 * for an event that can never arrive.
 */
export type EventType =
  | "Deploy"
  | "Buy"
  | "Sell"
  | "Release"
  | "Liquidate"
  | "Price"
  | "Deposit"
  | "Withdraw"
  | "Settle"
  | "Collect"
  | "Credit"
  | "Claim"
  | "Operator"
  | "Tax Proposed"
  | "Hook Proposed"
  | "Terms Applied"
  | "Update Cancelled"
  | "Order Cancelled"
  | "Hook Failed";
