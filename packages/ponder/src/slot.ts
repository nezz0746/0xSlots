import type { Virtual } from "ponder";
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
  operatorSetEvent,
  pendingUpdateCancelledEvent,
  pendingUpdateEvent,
  policyUpdateAppliedEvent,
  policyUpdateProposedEvent,
  priceUpdatedEvent,
  refundClaimedEvent,
  refundCreditedEvent,
  releasedEvent,
  settledEvent,
  slot,
  slotOperator,
  slotRefund,
  taxCollectedEvent,
  taxPaidEvent,
  taxUpdateProposedEvent,
  withdrawnEvent,
} from "ponder:schema";
import type { Hex } from "viem";
import type ponderConfig from "../ponder.config";
import type * as ponderSchema from "../ponder.schema";
import {
  evtId,
  getOrCreateAccount,
  getOrCreateAccountSlot,
  getOrCreateModule,
  lower,
  ZERO_ADDR,
} from "./helpers";

// ═══════════════════════════════════════════════════════════════════════════
// DUAL-ERA REGISTRATION
//
// Slots born under either `SlotDeployed` signature run the same beacon
// implementation, so both emit the identical event set — only the factory
// event that birthed them differs, and that forced two `factory()` sources
// (see ponder.config.ts). Every handler therefore has to be registered twice
// or the 301 pre-occupancy-layer slots index nothing at all.
//
// The two sources share one ABI, so their handler argument types are
// structurally identical; `Slot:` is used as the type witness and the cast is
// confined to the registration boundary, leaving handler bodies fully typed.
// ═══════════════════════════════════════════════════════════════════════════

type EventName = Virtual.EventNames<typeof ponderConfig>;

type SlotArgs<name extends string> = Virtual.IndexingFunctionArgs<
  typeof ponderConfig,
  typeof ponderSchema,
  `Slot:${name}` & EventName
>;

function onSlot<name extends string>(
  eventName: name,
  handler: (args: SlotArgs<name>) => Promise<void>,
) {
  ponder.on(`Slot:${eventName}` as EventName, handler as never);
  ponder.on(`SlotLegacy:${eventName}` as EventName, handler as never);
}

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

/** Occupancy cleared the same way by both release and liquidation. */
const VACANT = {
  occupant: null,
  occupantAccount: null,
  isOccupied: false,
  occupiedSince: 0n,
  price: 0n,
  deposit: 0n,
  collectedTax: 0n,
} as const;

onSlot("Bought", async ({ event, context }) => {
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
    isOccupied: true,
    occupiedSince: event.block.timestamp,
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

onSlot("Released", async ({ event, context }) => {
  const chainId = context.chain.id;
  const slotAddr = lower(event.log.address);
  const s = await loadSlot(context, slotAddr);
  if (s.occupant) {
    await clearOccupant(context, slotAddr, s.occupant, event.block.timestamp);
  }
  await context.db.update(slot, { id: slotAddr }).set({
    ...VACANT,
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

onSlot("Liquidated", async ({ event, context }) => {
  const chainId = context.chain.id;
  const slotAddr = lower(event.log.address);
  const s = await loadSlot(context, slotAddr);
  if (s.occupant) {
    await clearOccupant(context, slotAddr, s.occupant, event.block.timestamp);
  }
  await context.db.update(slot, { id: slotAddr }).set({
    ...VACANT,
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

onSlot("PriceUpdated", async ({ event, context }) => {
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

onSlot("Deposited", async ({ event, context }) => {
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

onSlot("Withdrawn", async ({ event, context }) => {
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

/**
 * Settlement, balance leg only.
 *
 * Per-address attribution deliberately does NOT happen here even though
 * `Settled` carries `taxPaid`: this event does not name the payer, so crediting
 * it would have to assume the current occupant is the one who owed. `TaxPaid`
 * fires from the same `_settle()` with the payer explicit — that is where the
 * ledger is written. Doing both double-counts.
 */
onSlot("Settled", async ({ event, context }) => {
  const chainId = context.chain.id;
  const slotAddr = lower(event.log.address);
  const s = await loadSlot(context, slotAddr);
  await context.db.update(slot, { id: slotAddr }).set({
    deposit: event.args.depositRemaining,
    updatedAt: event.block.timestamp,
  });

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

/**
 * Settlement, attribution leg. Fires only when `paid > 0`.
 *
 * The payer comes from the event, never from current occupancy: `_settle()`
 * runs before a buy reassigns the slot, so the charge belongs to the OUTGOING
 * occupant. `matchedOccupant` records whether the two agreed, as a tripwire on
 * that ordering.
 */
onSlot("TaxPaid", async ({ event, context }) => {
  const chainId = context.chain.id;
  const slotAddr = lower(event.log.address);
  const s = await loadSlot(context, slotAddr);
  const payer = lower(event.args.occupant);

  await context.db.update(slot, { id: slotAddr }).set((row) => ({
    taxPaidTotal: row.taxPaidTotal + event.args.taxPaid,
    updatedAt: event.block.timestamp,
  }));

  await getOrCreateAccount(context, payer);
  await getOrCreateAccountSlot(
    context,
    payer,
    event.log.address,
    event.block.timestamp,
    chainId,
  );
  await context.db
    .update(accountSlot, { account: payer, slot: slotAddr })
    .set((row) => ({
      taxPaid: row.taxPaid + event.args.taxPaid,
      lastInteractedAt: event.block.timestamp,
    }));

  await context.db.insert(taxPaidEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId,
    slot: slotAddr,
    currency: s.currency,
    occupant: payer,
    taxOwed: event.args.taxOwed,
    taxPaid: event.args.taxPaid,
    matchedOccupant: s.occupant === payer,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

onSlot("TaxCollected", async ({ event, context }) => {
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

// ═══════════════════════════════════════════════════════════════════════════
// OPERATORS
// ═══════════════════════════════════════════════════════════════════════════

onSlot("OperatorSet", async ({ event, context }) => {
  const chainId = context.chain.id;
  const slotAddr = lower(event.log.address);
  const occupant = lower(event.args.occupant);
  const operator = lower(event.args.operator);

  await context.db
    .insert(slotOperator)
    .values({
      slot: slotAddr,
      occupant,
      operator,
      chainId,
      approved: event.args.approved,
      updatedAt: event.block.timestamp,
    })
    .onConflictDoUpdate(() => ({
      approved: event.args.approved,
      updatedAt: event.block.timestamp,
    }));

  await context.db.insert(operatorSetEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId,
    slot: slotAddr,
    occupant,
    operator,
    approved: event.args.approved,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// REFUND CREDITS
//
// `_payOrCredit` credits instead of transferring when the push fails, which is
// what keeps liquidation unconditional — an occupant the currency refuses to
// pay must not be able to veto their own forced sale. A non-zero `balance`
// therefore means the slot owes someone money.
// ═══════════════════════════════════════════════════════════════════════════

onSlot("RefundCredited", async ({ event, context }) => {
  const chainId = context.chain.id;
  const slotAddr = lower(event.log.address);
  const s = await loadSlot(context, slotAddr);
  const acct = lower(event.args.account);

  await getOrCreateAccount(context, acct);

  await context.db
    .insert(slotRefund)
    .values({
      slot: slotAddr,
      account: acct,
      chainId,
      currency: s.currency,
      credited: event.args.amount,
      claimed: 0n,
      balance: event.args.amount,
      updatedAt: event.block.timestamp,
    })
    .onConflictDoUpdate((row) => ({
      credited: row.credited + event.args.amount,
      balance: row.balance + event.args.amount,
      updatedAt: event.block.timestamp,
    }));

  await context.db.insert(refundCreditedEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId,
    slot: slotAddr,
    currency: s.currency,
    account: acct,
    amount: event.args.amount,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

onSlot("RefundClaimed", async ({ event, context }) => {
  const chainId = context.chain.id;
  const slotAddr = lower(event.log.address);
  const s = await loadSlot(context, slotAddr);
  const acct = lower(event.args.account);

  await getOrCreateAccount(context, acct);

  await context.db
    .insert(slotRefund)
    .values({
      slot: slotAddr,
      account: acct,
      chainId,
      currency: s.currency,
      credited: 0n,
      claimed: event.args.amount,
      balance: -event.args.amount,
      updatedAt: event.block.timestamp,
    })
    .onConflictDoUpdate((row) => ({
      claimed: row.claimed + event.args.amount,
      balance: row.balance - event.args.amount,
      updatedAt: event.block.timestamp,
    }));

  await context.db.insert(refundClaimedEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId,
    slot: slotAddr,
    currency: s.currency,
    account: acct,
    amount: event.args.amount,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LEGACY PENDING-UPDATE EVENTS
//
// Superseded by the per-kind UpdateProposed/Cancelled/Applied trio below, but
// still emitted and still the only record for slots that transacted before the
// refactor. Kept for historical continuity.
// ═══════════════════════════════════════════════════════════════════════════

onSlot("TaxUpdateProposed", async ({ event, context }) => {
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

onSlot("ModuleUpdateProposed", async ({ event, context }) => {
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

onSlot("PendingUpdateCancelled", async ({ event, context }) => {
  await context.db.insert(pendingUpdateCancelledEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId: context.chain.id,
    slot: lower(event.log.address),
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

onSlot("PendingUpdateApplied", async ({ event, context }) => {
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
// The live values (`taxPercentage`, `module`, `occupancyPolicy`) are
// deliberately NOT written here. `PendingUpdateApplied` and
// `PolicyUpdateApplied` fire in the same transaction and already own that
// write; these only clear what is no longer queued.
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

onSlot("UpdateProposed", async ({ event, context }) => {
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

onSlot("UpdateCancelled", async ({ event, context }) => {
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

onSlot("UpdateApplied", async ({ event, context }) => {
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

// ═══════════════════════════════════════════════════════════════════════════
// OCCUPANCY POLICY
// ═══════════════════════════════════════════════════════════════════════════

onSlot("PolicyUpdateProposed", async ({ event, context }) => {
  await context.db.insert(policyUpdateProposedEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId: context.chain.id,
    slot: lower(event.log.address),
    newPolicy: lower(event.args.newPolicy),
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

/** Owns the live `occupancyPolicy` write; `UpdateApplied` clears the queue. */
onSlot("PolicyUpdateApplied", async ({ event, context }) => {
  const slotAddr = lower(event.log.address);
  const newPolicy = lower(event.args.newPolicy);

  await context.db.update(slot, { id: slotAddr }).set({
    occupancyPolicy: newPolicy === ZERO_ADDR ? null : newPolicy,
    updatedAt: event.block.timestamp,
  });

  await context.db.insert(policyUpdateAppliedEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId: context.chain.id,
    slot: slotAddr,
    newPolicy,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

onSlot("LiquidationBountyUpdated", async ({ event, context }) => {
  await context.db.update(slot, { id: lower(event.log.address) }).set({
    liquidationBountyBps: event.args.newBps,
    updatedAt: event.block.timestamp,
  });
});

onSlot("ModuleFeePaid", async ({ event, context }) => {
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
