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

/**
 * Rows out of a ponder plural field.
 *
 * These used to be bare arrays; ponder returns `{ items, totalCount, pageInfo }`,
 * and `for...of` over the page object throws "object is not iterable" rather
 * than yielding nothing. Accepts either shape so a half-migrated caller still
 * renders.
 */
function rows(field: any): any[] {
  if (!field) return [];
  return Array.isArray(field) ? field : (field.items ?? []);
}

export function normalizeEvents(data: any): UnifiedEvent[] {
  if (!data) return [];
  const events: UnifiedEvent[] = [];

  const getDecimals = (e: any) => e.currencyRef?.decimals ?? 6;
  const getSymbol = (e: any) => e.currencyRef?.symbol ?? "";
  const getSlot = (e: any) => e.slot?.id ?? e.slot ?? undefined;

  for (const e of rows(data.slotDeployedEvents)) {
    events.push({
      id: e.id,
      type: "Deploy",
      slot: getSlot(e),
      actor: e.deployer,
      detail: `→ ${truncateAddress(e.recipient)}`,
      timestamp: Number(e.timestamp),
      tx: e.tx,
    });
  }
  for (const e of rows(data.boughtEvents)) {
    const d = getDecimals(e);
    const s = getSymbol(e);
    events.push({
      id: e.id,
      type: "Buy",
      slot: getSlot(e),
      actor: e.buyer,
      detail:
        e.previousOccupant === "0x0000000000000000000000000000000000000000"
          ? `claimed @ ${formatPrice(e.selfAssessedPrice, d)} ${s}`
          : `force-bought @ ${formatPrice(e.price, d)} → ${formatPrice(e.selfAssessedPrice, d)} ${s}`,
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
    events.push({
      id: e.id,
      type: "Liquidate",
      slot: getSlot(e),
      actor: e.liquidator,
      detail: `bounty ${formatPrice(e.bounty, getDecimals(e))} ${getSymbol(e)}`,
      timestamp: Number(e.timestamp),
      tx: e.tx,
    });
  }
  for (const e of rows(data.priceUpdatedEvents)) {
    const d = getDecimals(e);
    const s = getSymbol(e);
    events.push({
      id: e.id,
      type: "Price",
      slot: getSlot(e),
      actor: "",
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
      actor: e.depositor,
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
  for (const e of rows(data.taxUpdateProposedEvents)) {
    events.push({
      id: e.id,
      type: "Tax Proposed",
      slot: getSlot(e),
      actor: "",
      detail: `→ ${(Number(e.newPercentage) / 100).toFixed(1)}%/mo`,
      timestamp: Number(e.timestamp),
      tx: e.tx,
    });
  }
  for (const e of rows(data.moduleUpdateProposedEvents)) {
    events.push({
      id: e.id,
      type: "Module Proposed",
      slot: getSlot(e),
      actor: "",
      detail: truncateAddress(e.newModule),
      timestamp: Number(e.timestamp),
      tx: e.tx,
    });
  }
  for (const e of rows(data.pendingUpdateCancelledEvents)) {
    events.push({
      id: e.id,
      type: "Update Cancelled",
      slot: getSlot(e),
      actor: "",
      detail: "",
      timestamp: Number(e.timestamp),
      tx: e.tx,
    });
  }

  return events.sort((a, b) => b.timestamp - a.timestamp);
}
