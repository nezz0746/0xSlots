import { formatPrice, truncateAddress } from "@/utils";

export type UnifiedEvent = {
  id: string;
  type: string;
  slot?: string;
  actor: string;
  detail: string;
  timestamp: number;
  tx: string;
};

const ZERO = "0x0000000000000000000000000000000000000000";

/**
 * Rows out of a ponder plural field.
 *
 * These used to be bare arrays; ponder returns `{ items, totalCount, pageInfo }`,
 * and `for...of` over the page object throws "object is not iterable" rather
 * than yielding nothing. Accepts either shape so a half-migrated caller still
 * renders.
 */
// biome-ignore lint/suspicious/noExplicitAny: rows are untyped indexer JSON
function rows(field: any): any[] {
  if (!field) return [];
  return Array.isArray(field) ? field : (field.items ?? []);
}

/**
 * Every event table, flattened into one sortable stream.
 *
 * The SHAPE and the display craft below are the original's; the inputs are all
 * that changed. The mapping onto the hook-based protocol, event by event:
 *
 *   * `Buy` reads `boughtEvent`. `from` is the previous occupant — zero when
 *     the slot was vacant, which is the "claimed" wording rather than a
 *     buy-out. `paid` is what actually went to that occupant and `price` is
 *     the buyer's own new assessment; showing both is the point of the row.
 *   * `Sell` is NEW. `sell` emits `Sold` and then `Bought` in one call, so a
 *     negotiated hand-over produces two rows and `viaSell` on the buy says so
 *     — without it the pair reads as two unrelated transitions.
 *   * `Liquidate` no longer carries a bounty. There ISN'T one in this
 *     protocol, so the row shows how long the evicted occupant had held it.
 *   * `Tax Proposed` and `Hook Proposed` both come from ONE
 *     `termsProposedEvent`, split back apart on its `changeTax`/`changeHook`
 *     flags. They stay two rows because they are two decisions with different
 *     consequences, and a manager may propose either alone.
 *   * `Update Cancelled` reads `termsCancelledEvent`, and `Terms Applied`
 *     `termsAppliedEvent` — the latter had no row at all before, so an applied
 *     change appeared in the feed as a proposal that silently came true.
 *   * `Credit` and `Claim` are new and worth their space: a credit means a
 *     push payment could not reach somebody and nothing on chain will ever
 *     tell them.
 *   * `Hook Failed` is an `after` callback that reverted and was swallowed. A
 *     hook accumulating these is broken in a way its users cannot otherwise
 *     see.
 *
 * Dropped, with nothing to map onto: `LiquidationBountyUpdated` (bounties are
 * gone from the protocol) and `ModuleProposed` in its module sense (there are
 * no modules — the hook dimension of `termsProposedEvent` replaces it).
 */
// biome-ignore lint/suspicious/noExplicitAny: rows are untyped indexer JSON
export function normalizeEvents(data: any): UnifiedEvent[] {
  if (!data) return [];
  const events: UnifiedEvent[] = [];

  /**
   * Event tables carry a bare `currency` address and no currency relation, so
   * decimals arrive through the slot. The fallback is 18 rather than the old
   * 6: a slot may be denominated in native ETH, which the previous protocol
   * could not do, and 18 is now the commoner of the two guesses.
   */
  // biome-ignore lint/suspicious/noExplicitAny: rows are untyped indexer JSON
  const getDecimals = (e: any) => e.slotRef?.currencyRef?.decimals ?? 18;
  // biome-ignore lint/suspicious/noExplicitAny: rows are untyped indexer JSON
  const getSymbol = (e: any) => e.slotRef?.currencyRef?.symbol ?? "";
  // biome-ignore lint/suspicious/noExplicitAny: rows are untyped indexer JSON
  const getSlot = (e: any) => e.slot?.id ?? e.slot ?? undefined;

  for (const e of rows(data.slotCreatedEvents)) {
    events.push({
      id: e.id,
      type: "Deploy",
      slot: getSlot(e),
      actor: e.creator ?? e.deployer,
      detail: `→ ${truncateAddress(e.recipient)}`,
      timestamp: Number(e.timestamp),
      tx: e.tx,
    });
  }

  for (const e of rows(data.boughtEvents)) {
    const d = getDecimals(e);
    const s = getSymbol(e);
    const vacant = !e.from || e.from === ZERO;
    events.push({
      id: e.id,
      type: "Buy",
      slot: getSlot(e),
      actor: e.buyer,
      detail: vacant
        ? `claimed @ ${formatPrice(e.price, d)} ${s}`
        : `${e.viaSell ? "bought" : "force-bought"} @ ${formatPrice(e.paid, d)} → ${formatPrice(e.price, d)} ${s}`,
      timestamp: Number(e.timestamp),
      tx: e.tx,
    });
  }

  for (const e of rows(data.soldEvents)) {
    events.push({
      id: e.id,
      type: "Sell",
      slot: getSlot(e),
      actor: e.seller,
      detail: `→ ${truncateAddress(e.buyer)} @ ${formatPrice(e.price, getDecimals(e))} ${getSymbol(e)}`,
      timestamp: Number(e.timestamp),
      tx: e.tx,
    });
  }

  for (const e of rows(data.releasedEvents)) {
    events.push({
      id: e.id,
      type: "Release",
      slot: getSlot(e),
      actor: e.occupant,
      detail: `refund ${formatPrice(e.refund, getDecimals(e))} ${getSymbol(e)}`,
      timestamp: Number(e.timestamp),
      tx: e.tx,
    });
  }

  for (const e of rows(data.liquidatedEvents)) {
    const hours = Math.round(Number(e.heldFor ?? 0) / 3600);
    events.push({
      id: e.id,
      type: "Liquidate",
      slot: getSlot(e),
      // The LIQUIDATOR, matching every other row's "who did this".
      actor: e.by,
      detail: `evicted ${truncateAddress(e.occupant)} after ${hours}h`,
      timestamp: Number(e.timestamp),
      tx: e.tx,
    });
  }

  for (const e of rows(data.priceSetEvents)) {
    const d = getDecimals(e);
    const s = getSymbol(e);
    events.push({
      id: e.id,
      type: "Price",
      slot: getSlot(e),
      // `by` can be an operator repricing for the occupant, so it is not
      // always the occupant and the two are different facts.
      actor: e.by ?? "",
      detail: `${formatPrice(e.oldPrice, d)} → ${formatPrice(e.newPrice, d)} ${s}`,
      timestamp: Number(e.timestamp),
      tx: e.tx,
    });
  }

  for (const e of rows(data.depositedEvents)) {
    events.push({
      id: e.id,
      type: "Deposit",
      slot: getSlot(e),
      actor: e.by,
      detail: `+${formatPrice(e.amount, getDecimals(e))} ${getSymbol(e)}`,
      timestamp: Number(e.timestamp),
      tx: e.tx,
    });
  }

  for (const e of rows(data.withdrawnEvents)) {
    events.push({
      id: e.id,
      type: "Withdraw",
      slot: getSlot(e),
      actor: e.occupant,
      detail: `-${formatPrice(e.amount, getDecimals(e))} ${getSymbol(e)}`,
      timestamp: Number(e.timestamp),
      tx: e.tx,
    });
  }

  for (const e of rows(data.settledEvents)) {
    const d = getDecimals(e);
    const s = getSymbol(e);
    events.push({
      id: e.id,
      type: "Settle",
      slot: getSlot(e),
      actor: "",
      // `insolvent` is the whole reason this row is worth showing: it means
      // the deposit could not cover what was owed, and the slot is now
      // liquidatable by anyone.
      detail: e.insolvent
        ? `INSOLVENT — owed ${formatPrice(e.owed, d)}, paid ${formatPrice(e.paid, d)} ${s}`
        : `${formatPrice(e.paid, d)} ${s} · ${formatPrice(e.depositLeft, d)} left`,
      timestamp: Number(e.timestamp),
      tx: e.tx,
    });
  }

  for (const e of rows(data.taxCollectedEvents)) {
    events.push({
      id: e.id,
      type: "Collect",
      slot: getSlot(e),
      actor: e.recipient,
      detail: `${formatPrice(e.amount, getDecimals(e))} ${getSymbol(e)}`,
      timestamp: Number(e.timestamp),
      tx: e.tx,
    });
  }

  for (const e of rows(data.creditedEvents)) {
    events.push({
      id: e.id,
      type: "Credit",
      slot: getSlot(e),
      actor: e.account,
      detail: `${formatPrice(e.amount, getDecimals(e))} ${getSymbol(e)} could not be paid out`,
      timestamp: Number(e.timestamp),
      tx: e.tx,
    });
  }

  for (const e of rows(data.claimedEvents)) {
    events.push({
      id: e.id,
      type: "Claim",
      slot: getSlot(e),
      actor: e.account,
      detail: `${formatPrice(e.amount, getDecimals(e))} ${getSymbol(e)}`,
      timestamp: Number(e.timestamp),
      tx: e.tx,
    });
  }

  for (const e of rows(data.operatorSetEvents)) {
    events.push({
      id: e.id,
      type: "Operator",
      slot: getSlot(e),
      actor: e.occupant,
      detail: `${e.allowed ? "approved" : "revoked"} ${truncateAddress(e.operator)}`,
      timestamp: Number(e.timestamp),
      tx: e.tx,
    });
  }

  // One event, up to two rows. `changeTax` and `changeHook` are independent
  // dimensions of one proposal, and folding them into a single row would hide
  // which of the two a manager actually moved.
  for (const e of rows(data.termsProposedEvents)) {
    if (e.changeTax) {
      events.push({
        id: `${e.id}-tax`,
        type: "Tax Proposed",
        slot: getSlot(e),
        actor: e.manager,
        detail: `→ ${(Number(e.taxBps) / 100).toFixed(1)}%/mo`,
        timestamp: Number(e.timestamp),
        tx: e.tx,
      });
    }
    if (e.changeHook) {
      events.push({
        id: `${e.id}-hook`,
        type: "Hook Proposed",
        slot: getSlot(e),
        actor: e.manager,
        // The zero address is a real proposal — "detach the hook" — not an
        // absent one, so it is named rather than shown as a bare 0x0000…
        detail:
          !e.hook || e.hook === ZERO ? "detach hook" : truncateAddress(e.hook),
        timestamp: Number(e.timestamp),
        tx: e.tx,
      });
    }
  }

  for (const e of rows(data.termsAppliedEvents)) {
    const changes: string[] = [];
    if (e.taxChanged)
      changes.push(
        `tax ${(Number(e.previousTaxPercentage) / 100).toFixed(1)}% → ${(Number(e.taxBps) / 100).toFixed(1)}%/mo`,
      );
    if (e.hookChanged)
      changes.push(
        `hook → ${!e.hook || e.hook === ZERO ? "none" : truncateAddress(e.hook)}`,
      );
    events.push({
      id: e.id,
      type: "Terms Applied",
      slot: getSlot(e),
      actor: "",
      detail: changes.join(" · "),
      timestamp: Number(e.timestamp),
      tx: e.tx,
    });
  }

  for (const e of rows(data.proposalCancelledEvents)) {
    const cancelled = [
      e.cancelTax ? "tax" : null,
      e.cancelHook ? "hook" : null,
    ].filter(Boolean);
    events.push({
      id: e.id,
      type: "Update Cancelled",
      slot: getSlot(e),
      actor: e.manager,
      detail: cancelled.length > 0 ? cancelled.join(" + ") : "",
      timestamp: Number(e.timestamp),
      tx: e.tx,
    });
  }

  for (const e of rows(data.orderCancelledEvents)) {
    events.push({
      id: e.id,
      type: "Order Cancelled",
      slot: getSlot(e),
      actor: e.buyer,
      detail: `nonce ${e.nonce}`,
      timestamp: Number(e.timestamp),
      tx: e.tx,
    });
  }

  for (const e of rows(data.hookCallFailedEvents)) {
    events.push({
      id: e.id,
      type: "Hook Failed",
      slot: getSlot(e),
      actor: e.hook,
      detail: `reverted in ${e.selector}`,
      timestamp: Number(e.timestamp),
      tx: e.tx,
    });
  }

  return events.sort((a, b) => b.timestamp - a.timestamp);
}
