import { type Context, ponder } from "ponder:registry";
import {
  account,
  accountSlot,
  boughtEvent,
  depositedEvent,
  liquidatedEvent,
  module,
  moduleFeePaidEvent,
  moduleUpdateProposedEvent,
  pendingUpdateCancelledEvent,
  pendingUpdateEvent,
  priceUpdatedEvent,
  releasedEvent,
  settledEvent,
  slot,
  taxCollectedEvent,
  taxUpdateProposedEvent,
  withdrawnEvent,
} from "ponder:schema";
import type { Hex } from "viem";
import {
  evtId,
  getOrCreateAccount,
  getOrCreateAccountSlot,
  getOrCreateModule,
  lower,
  ZERO_ADDR,
} from "./helpers";

async function loadSlot(context: Context, addr: Hex) {
  const row = await context.db.find(slot, { id: lower(addr) });
  if (!row) throw new Error(`Slot ${addr} not found in store`);
  return row;
}

async function clearOccupant(
  context: Context,
  slotAddr: Hex,
  prevOccupant: Hex,
  blockTime: bigint,
) {
  const prev = lower(prevOccupant);
  if (prev === ZERO_ADDR) return;

  const accSlot = await context.db.find(accountSlot, {
    account: prev,
    slot: slotAddr,
  });
  let held = 0n;
  if (accSlot?.lastOccupiedAt != null) {
    held = blockTime - accSlot.lastOccupiedAt;
  }
  if (accSlot) {
    await context.db
      .update(accountSlot, { account: prev, slot: slotAddr })
      .set({
        holdTime: accSlot.holdTime + held,
        lastOccupiedAt: null,
        lastInteractedAt: blockTime,
      });
  }
  await context.db.update(account, { id: prev }).set((row) => ({
    occupiedCount: row.occupiedCount - 1,
    totalHoldTime: row.totalHoldTime + held,
  }));
}

ponder.on("Slot:Bought", async ({ event, context }) => {
  const chainId = context.chain.id;
  const slotAddr = lower(event.log.address);
  const s = await loadSlot(context, slotAddr);

  if (s.occupant) {
    await clearOccupant(context, slotAddr, s.occupant, event.block.timestamp);
  }

  const buyer = await getOrCreateAccount(context, event.args.buyer, true);
  await context.db
    .update(account, { id: buyer.id })
    .set((row) => ({ occupiedCount: row.occupiedCount + 1 }));

  await getOrCreateAccountSlot(
    context,
    event.args.buyer,
    event.log.address,
    event.block.timestamp,
    chainId,
  );
  await context.db
    .update(accountSlot, { account: lower(event.args.buyer), slot: slotAddr })
    .set({
      lastOccupiedAt: event.block.timestamp,
      lastInteractedAt: event.block.timestamp,
    });

  await context.db.update(slot, { id: slotAddr }).set({
    occupant: lower(event.args.buyer),
    occupantAccount: buyer.id,
    price: event.args.selfAssessedPrice,
    deposit: event.args.deposit,
    updatedAt: event.block.timestamp,
  });

  await context.db.insert(boughtEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId,
    slot: slotAddr,
    currency: s.currency,
    buyer: lower(event.args.buyer),
    previousOccupant: lower(event.args.previousOccupant),
    price: event.args.price,
    deposit: event.args.deposit,
    selfAssessedPrice: event.args.selfAssessedPrice,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

ponder.on("Slot:Released", async ({ event, context }) => {
  const chainId = context.chain.id;
  const slotAddr = lower(event.log.address);
  const s = await loadSlot(context, slotAddr);
  if (s.occupant) {
    await clearOccupant(context, slotAddr, s.occupant, event.block.timestamp);
  }
  await context.db.update(slot, { id: slotAddr }).set({
    occupant: null,
    occupantAccount: null,
    price: 0n,
    deposit: 0n,
    collectedTax: 0n,
    updatedAt: event.block.timestamp,
  });
  await context.db.insert(releasedEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId,
    slot: slotAddr,
    currency: s.currency,
    occupant: lower(event.args.occupant),
    refund: event.args.refund,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

ponder.on("Slot:Liquidated", async ({ event, context }) => {
  const chainId = context.chain.id;
  const slotAddr = lower(event.log.address);
  const s = await loadSlot(context, slotAddr);
  if (s.occupant) {
    await clearOccupant(context, slotAddr, s.occupant, event.block.timestamp);
  }
  await context.db.update(slot, { id: slotAddr }).set({
    occupant: null,
    occupantAccount: null,
    price: 0n,
    deposit: 0n,
    collectedTax: 0n,
    updatedAt: event.block.timestamp,
  });
  await context.db.insert(liquidatedEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId,
    slot: slotAddr,
    currency: s.currency,
    liquidator: lower(event.args.liquidator),
    occupant: lower(event.args.occupant),
    bounty: event.args.bounty,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

ponder.on("Slot:PriceUpdated", async ({ event, context }) => {
  const chainId = context.chain.id;
  const slotAddr = lower(event.log.address);
  const s = await loadSlot(context, slotAddr);
  await context.db.update(slot, { id: slotAddr }).set({
    price: event.args.newPrice,
    updatedAt: event.block.timestamp,
  });
  await context.db.insert(priceUpdatedEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId,
    slot: slotAddr,
    currency: s.currency,
    oldPrice: event.args.oldPrice,
    newPrice: event.args.newPrice,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

ponder.on("Slot:Deposited", async ({ event, context }) => {
  const chainId = context.chain.id;
  const slotAddr = lower(event.log.address);
  const s = await loadSlot(context, slotAddr);
  await context.db.update(slot, { id: slotAddr }).set((row) => ({
    deposit: row.deposit + event.args.amount,
    updatedAt: event.block.timestamp,
  }));
  await context.db.insert(depositedEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId,
    slot: slotAddr,
    currency: s.currency,
    depositor: lower(event.args.depositor),
    amount: event.args.amount,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

ponder.on("Slot:Withdrawn", async ({ event, context }) => {
  const chainId = context.chain.id;
  const slotAddr = lower(event.log.address);
  const s = await loadSlot(context, slotAddr);
  await context.db.update(slot, { id: slotAddr }).set((row) => ({
    deposit: row.deposit - event.args.amount,
    updatedAt: event.block.timestamp,
  }));
  await context.db.insert(withdrawnEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId,
    slot: slotAddr,
    currency: s.currency,
    occupant: lower(event.args.occupant),
    amount: event.args.amount,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

ponder.on("Slot:Settled", async ({ event, context }) => {
  const chainId = context.chain.id;
  const slotAddr = lower(event.log.address);
  const s = await loadSlot(context, slotAddr);
  await context.db.update(slot, { id: slotAddr }).set({
    deposit: event.args.depositRemaining,
    updatedAt: event.block.timestamp,
  });

  if (s.occupant) {
    await getOrCreateAccountSlot(
      context,
      s.occupant,
      event.log.address,
      event.block.timestamp,
      chainId,
    );
    await context.db
      .update(accountSlot, { account: s.occupant, slot: slotAddr })
      .set((row) => ({
        taxPaid: row.taxPaid + event.args.taxPaid,
        lastInteractedAt: event.block.timestamp,
      }));
  }

  await context.db.insert(settledEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId,
    slot: slotAddr,
    currency: s.currency,
    taxOwed: event.args.taxOwed,
    taxPaid: event.args.taxPaid,
    depositRemaining: event.args.depositRemaining,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

ponder.on("Slot:TaxCollected", async ({ event, context }) => {
  const chainId = context.chain.id;
  const slotAddr = lower(event.log.address);
  const s = await loadSlot(context, slotAddr);
  await context.db.update(slot, { id: slotAddr }).set((row) => ({
    collectedTax: 0n,
    totalCollected: row.totalCollected + event.args.amount,
    updatedAt: event.block.timestamp,
  }));
  await context.db.insert(taxCollectedEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId,
    slot: slotAddr,
    currency: s.currency,
    recipient: lower(event.args.recipient),
    amount: event.args.amount,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

ponder.on("Slot:TaxUpdateProposed", async ({ event, context }) => {
  await context.db.insert(taxUpdateProposedEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId: context.chain.id,
    slot: lower(event.log.address),
    newPercentage: event.args.newPercentage,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

ponder.on("Slot:ModuleUpdateProposed", async ({ event, context }) => {
  await context.db.insert(moduleUpdateProposedEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId: context.chain.id,
    slot: lower(event.log.address),
    newModule: lower(event.args.newUtility),
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

ponder.on("Slot:PendingUpdateCancelled", async ({ event, context }) => {
  await context.db.insert(pendingUpdateCancelledEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId: context.chain.id,
    slot: lower(event.log.address),
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

ponder.on("Slot:PendingUpdateApplied", async ({ event, context }) => {
  const chainId = context.chain.id;
  const slotAddr = lower(event.log.address);
  const s = await loadSlot(context, slotAddr);
  const newModule = lower(event.args.newUtility);
  if (newModule === ZERO_ADDR) {
    await context.db.update(slot, { id: slotAddr }).set({
      taxPercentage: event.args.newTaxPercentage,
      module: null,
      updatedAt: event.block.timestamp,
    });
  } else {
    await getOrCreateModule(context, newModule, s.factory, chainId);
    await context.db.update(slot, { id: slotAddr }).set({
      taxPercentage: event.args.newTaxPercentage,
      module: newModule,
      updatedAt: event.block.timestamp,
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PER-KIND PENDING UPDATES
//
// A slot holds at most one pending update per dimension — tax, utility, policy
// — and each can now be proposed, cancelled and applied on its own. These three
// handlers maintain the live pending columns on `slot` and append to the log.
//
// The live values (`taxPercentage`, `module`) are deliberately NOT written
// here. `PendingUpdateApplied` and `PolicyUpdateApplied` fire in the same
// transaction and already own that write; these only clear what is no longer
// queued.
// ═══════════════════════════════════════════════════════════════════════════

const UPDATE_KIND = { TAX: 0, UTILITY: 1, POLICY: 2 } as const;

/** The `bytes32` an update event carries, read back as an address. */
function valueAsAddress(value: Hex): Hex {
  return lower(`0x${value.slice(-40)}` as Hex);
}

/**
 * The pending columns for one kind, set to `value` or cleared with `null`.
 *
 * Every kind clears BOTH of its columns together, so a row can never carry a
 * proposed value with no timestamp or the reverse.
 */
function pendingColumns(
  kind: number,
  value: Hex | null,
  proposedAt: bigint | null,
) {
  if (kind === UPDATE_KIND.TAX) {
    return {
      pendingTaxPercentage: value === null ? null : BigInt(value),
      taxProposedAt: proposedAt,
    };
  }
  if (kind === UPDATE_KIND.UTILITY) {
    return {
      pendingUtility: value === null ? null : valueAsAddress(value),
      utilityProposedAt: proposedAt,
    };
  }
  return {
    pendingPolicy: value === null ? null : valueAsAddress(value),
    policyProposedAt: proposedAt,
  };
}

ponder.on("Slot:UpdateProposed", async ({ event, context }) => {
  const slotAddr = lower(event.log.address);
  const kind = Number(event.args.kind);

  await context.db.update(slot, { id: slotAddr }).set({
    ...pendingColumns(kind, event.args.value, event.args.proposedAt),
    updatedAt: event.block.timestamp,
  });

  await context.db.insert(pendingUpdateEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId: context.chain.id,
    slot: slotAddr,
    kind,
    action: "proposed",
    value: event.args.value,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

ponder.on("Slot:UpdateCancelled", async ({ event, context }) => {
  const slotAddr = lower(event.log.address);
  const kind = Number(event.args.kind);

  await context.db.update(slot, { id: slotAddr }).set({
    ...pendingColumns(kind, null, null),
    updatedAt: event.block.timestamp,
  });

  await context.db.insert(pendingUpdateEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId: context.chain.id,
    slot: slotAddr,
    kind,
    action: "cancelled",
    value: null,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

ponder.on("Slot:UpdateApplied", async ({ event, context }) => {
  const slotAddr = lower(event.log.address);
  const kind = Number(event.args.kind);

  await context.db.update(slot, { id: slotAddr }).set({
    ...pendingColumns(kind, null, null),
    updatedAt: event.block.timestamp,
  });

  await context.db.insert(pendingUpdateEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId: context.chain.id,
    slot: slotAddr,
    kind,
    action: "applied",
    value: event.args.value,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

ponder.on("Slot:LiquidationBountyUpdated", async ({ event, context }) => {
  await context.db.update(slot, { id: lower(event.log.address) }).set({
    liquidationBountyBps: event.args.newBps,
    updatedAt: event.block.timestamp,
  });
});

ponder.on("Slot:ModuleFeePaid", async ({ event, context }) => {
  const chainId = context.chain.id;
  const slotAddr = lower(event.log.address);
  const s = await loadSlot(context, slotAddr);
  const moduleId = lower(event.args.utility);

  const mod = await context.db.find(module, { id: moduleId });
  if (mod) {
    await context.db.update(module, { id: moduleId }).set((row) => ({
      totalFeesCollected: row.totalFeesCollected + event.args.amount,
    }));
  }

  await context.db.insert(moduleFeePaidEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId,
    slot: slotAddr,
    currency: s.currency,
    module: moduleId,
    amount: event.args.amount,
    feeBps: event.args.feeBps,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});
