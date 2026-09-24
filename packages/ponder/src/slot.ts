import { type Context, ponder } from "ponder:registry";
import {
  account,
  accountSlot,
  boughtEvent,
  cancelledOrder,
  claimedEvent,
  creditedEvent,
  depositedEvent,
  module,
  moduleCallFailedEvent,
  liquidatedEvent,
  operatorSetEvent,
  priceSetEvent,
  releasedEvent,
  settledEvent,
  slot,
  slotCredit,
  slotOperator,
  taxCollectedEvent,
  taxPaidEvent,
  termsAppliedEvent,
  termsCancelledEvent,
  termsProposedEvent,
  debtRepaidEvent,
  moduleFeePaidEvent,
  withdrawnEvent,
} from "ponder:schema";
import type { Hex } from "viem";
import {
  bumpAccountChain,
  bumpModuleSlotCount,
  evtId,
  getOrCreateAccount,
  getOrCreateAccountSlot,
  scopeColumns,
  lower,
  unpackScopes,
  ZERO_ADDR,
  NO_SETTINGS,
} from "./helpers";

// ═══════════════════════════════════════════════════════════════════════════
// ONE REGISTRATION PER EVENT
//
// The previous indexer registered every handler TWICE, because two live
// `SlotDeployed` signatures forced two `factory()` sources. There is now one
// creation function and one `SlotCreated`, so there is one `Slot` source and
// one `ponder.on` per event. Do not reintroduce a second one.
//
// ── The two ordering facts every handler below depends on ──────────────────
//
//   1. EVERY entry point settles FIRST. `Settled` — and `TaxPaid` when money
//      actually moved — precede the event that names the action, and they are
//      attributed to the occupant on record at that moment. So a buy charges
//      the OUTGOING occupant for their own tenure, and the handlers here see
//      the pre-transition slot row when they run. That is correct and load
//      bearing: `Bought` is what moves occupancy, nothing before it.
//
//   2. `sell` emits `Sold` and then `Bought`, deliberately — the transition IS
//      a buy and every consumer already reads it that way. `Bought` is
//      therefore the ONLY occupancy handler; `Sold` records the seller's side
//      and touches no occupancy state. Doing otherwise double-counts every
//      negotiated sale.
// ═══════════════════════════════════════════════════════════════════════════

async function loadSlot(context: Context, addr: Hex) {
  const row = await context.db.find(slot, {
    id: lower(addr),
    chainId: context.chain.id,
  });
  if (!row) throw new Error(`Slot ${addr} not found in store`);
  return row;
}

/**
 * End a tenure: hold time, counters, and the recipient's occupied count.
 *
 * @param recipient The slot's recipient, so their `occupiedAsRecipient` falls
 *        with the occupancy. Passed in rather than re-read; every caller
 *        already holds the slot row.
 */
async function clearOccupant(
  context: Context,
  slotAddr: Hex,
  prevOccupant: Hex,
  blockTime: bigint,
  recipient: Hex,
) {
  const prev = lower(prevOccupant);
  if (prev === ZERO_ADDR) return;

  await bumpAccountChain(context, recipient, context.chain.id, {
    occupiedAsRecipient: -1,
  });

  const accSlot = await context.db.find(accountSlot, {
    account: prev,
    slot: slotAddr,
    chainId: context.chain.id,
  });
  let held = 0n;
  if (accSlot?.lastOccupiedAt != null) {
    held = blockTime - accSlot.lastOccupiedAt;
  }
  if (accSlot) {
    await context.db
      .update(accountSlot, {
        account: prev,
        slot: slotAddr,
        chainId: context.chain.id,
      })
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
  await bumpAccountChain(context, prev, context.chain.id, {
    occupiedCount: -1,
  });
}

/**
 * Occupancy cleared the same way by both release and liquidation.
 *
 * `tenureId` is deliberately absent: `_vacate()` does not touch the chain's
 * counter, so the last tenure's number persists through the vacancy and the
 * next seating increments from it. What expires an operator approval across a
 * release is `isOccupied`, not the counter — see `slotOperator`.
 */
const VACANT = {
  occupant: null,
  occupantAccount: null,
  isOccupied: false,
  occupiedSince: 0n,
  price: 0n,
  deposit: 0n,
} as const;

// ─── occupancy ─────────────────────────────────────────────────────────────

ponder.on("Slot:Bought", async ({ event, context }) => {
  const chainId = context.chain.id;
  const slotAddr = lower(event.log.address);
  const s = await loadSlot(context, slotAddr);

  if (s.occupant) {
    await clearOccupant(
      context,
      slotAddr,
      s.occupant,
      event.block.timestamp,
      s.recipient,
    );
  }

  // `buy(account, …)` seats one address while another pays, so the buyer is
  // not reliably `tx.from` — but when it is, that is the DELEGATED signal.
  const buyer = await getOrCreateAccount(
    context,
    event.args.buyer,
    lower(event.args.buyer) === lower(event.transaction.from),
  );
  await context.db
    .update(account, { id: buyer.id })
    .set((row) => ({ occupiedCount: row.occupiedCount + 1 }));
  await bumpAccountChain(context, event.args.buyer, chainId, {
    occupiedCount: 1,
  });
  // …and the RECIPIENT now has one more of their slots occupied. A different
  // account and a different column: the buyer occupies, the recipient collects.
  // `clearOccupant` above already decremented it on a hand-over, so that nets
  // to zero.
  await bumpAccountChain(context, s.recipient, chainId, {
    occupiedAsRecipient: 1,
  });

  await getOrCreateAccountSlot(
    context,
    event.args.buyer,
    event.log.address,
    event.block.timestamp,
    chainId,
  );
  await context.db
    .update(accountSlot, {
      account: lower(event.args.buyer),
      slot: slotAddr,
      chainId: context.chain.id,
    })
    .set({
      lastOccupiedAt: event.block.timestamp,
      lastInteractedAt: event.block.timestamp,
    });

  // The chain increments `tenureId` at the moment it seats somebody, just
  // before this event, so mirroring it here keeps the two in step. Counted
  // rather than read back: it advances on exactly the transitions that emit
  // `Bought` and on nothing else, and an eth_call per buy to learn a number we
  // can add one to would be the expensive way to be no more correct.
  //
  // Not derived from `occupiedSince`, deliberately. Release and reseat can land
  // in one block, and two tenures sharing a timestamp is exactly the collision
  // the counter exists to avoid.
  const tenure = s.tenureId + 1n;

  await context.db
    .update(slot, { id: slotAddr, chainId: context.chain.id })
    .set({
      occupant: lower(event.args.buyer),
      occupantAccount: buyer.id,
      isOccupied: true,
      occupiedSince: event.block.timestamp,
      tenureId: tenure,
      price: event.args.price,
      deposit: event.args.deposit,
      // Re-planted, not inherited. The `Settled` that preceded this buy was
      // attributed to the OUTGOING occupant (see the ordering note at the top
      // of this file), so leaving the old anchor in place would bill the new
      // occupant for their predecessor's tenure from the first second.
      lastSettled: event.block.timestamp,
      updatedAt: event.block.timestamp,
    });

  await context.db.insert(boughtEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId,
    slot: slotAddr,
    currency: s.currency,
    buyer: lower(event.args.buyer),
    from: lower(event.args.from),
    price: event.args.price,
    deposit: event.args.deposit,
    paid: event.args.paid,
    tenure,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

/*
 * `Slot:Sold` USED TO BE HANDLED HERE.
 *
 * The core no longer has `sell`, so it no longer emits `Sold`. A consensual
 * sale is `selfAssess` then `buy`, performed by the OfferBook — the `Bought`
 * handler above already records the occupancy, and the seller's side is the
 * book's `Filled(slot, bidder, id, seller, price, deposit)`.
 *
 * That event is NOT indexed yet: the book is not in `ponder.config.ts` at all.
 * Adding it is what restores a queryable sale history.
 */

ponder.on("Slot:Released", async ({ event, context }) => {
  const slotAddr = lower(event.log.address);
  const s = await loadSlot(context, slotAddr);

  await clearOccupant(
    context,
    slotAddr,
    event.args.occupant,
    event.block.timestamp,
    s.recipient,
  );

  await context.db
    .update(slot, { id: slotAddr, chainId: context.chain.id })
    .set({
      ...VACANT,
      updatedAt: event.block.timestamp,
    });

  await context.db.insert(releasedEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId: context.chain.id,
    slot: slotAddr,
    currency: s.currency,
    occupant: lower(event.args.occupant),
    refund: event.args.refund,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

/**
 * Eviction for insolvency. No bounty field, because there is no bounty: the
 * reward is that the slot is now vacant and the liquidator can take it in the
 * same `multicall`.
 */
ponder.on("Slot:Liquidated", async ({ event, context }) => {
  const slotAddr = lower(event.log.address);
  const s = await loadSlot(context, slotAddr);

  // Read before `clearOccupant` wipes it. The slot row still carries the
  // tenure being ended, because `Liquidated` is emitted after `_vacate()` on
  // chain but nothing has told this indexer yet.
  const heldFor =
    s.occupiedSince > 0n ? event.block.timestamp - s.occupiedSince : 0n;

  await clearOccupant(
    context,
    slotAddr,
    event.args.occupant,
    event.block.timestamp,
    s.recipient,
  );
  await getOrCreateAccount(
    context,
    event.args.by,
    lower(event.args.by) === lower(event.transaction.from),
  );

  await context.db
    .update(slot, { id: slotAddr, chainId: context.chain.id })
    .set({
      ...VACANT,
      updatedAt: event.block.timestamp,
    });

  await context.db.insert(liquidatedEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId: context.chain.id,
    slot: slotAddr,
    currency: s.currency,
    by: lower(event.args.by),
    occupant: lower(event.args.occupant),
    heldFor,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

// ─── holding ───────────────────────────────────────────────────────────────

ponder.on("Slot:PriceSet", async ({ event, context }) => {
  const slotAddr = lower(event.log.address);
  const s = await loadSlot(context, slotAddr);

  await context.db
    .update(slot, { id: slotAddr, chainId: context.chain.id })
    .set({
      price: event.args.newPrice,
      updatedAt: event.block.timestamp,
    });

  await context.db.insert(priceSetEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId: context.chain.id,
    slot: slotAddr,
    currency: s.currency,
    by: lower(event.args.by),
    // The caller may be an operator rather than the occupant, and it is the
    // occupant who pays the tax on the new price. Both are recorded.
    occupant: s.occupant ?? ZERO_ADDR,
    oldPrice: event.args.oldPrice,
    newPrice: event.args.newPrice,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

/** Anyone may fund a slot, so `by` is not necessarily the occupant. */
ponder.on("Slot:Deposited", async ({ event, context }) => {
  const chainId = context.chain.id;
  const slotAddr = lower(event.log.address);
  const s = await loadSlot(context, slotAddr);

  await context.db
    .update(slot, { id: slotAddr, chainId: context.chain.id })
    .set({
      deposit: event.args.total,
      updatedAt: event.block.timestamp,
    });

  await getOrCreateAccount(
    context,
    event.args.by,
    lower(event.args.by) === lower(event.transaction.from),
  );
  await getOrCreateAccountSlot(
    context,
    event.args.by,
    event.log.address,
    event.block.timestamp,
    chainId,
  );
  await context.db
    .update(accountSlot, {
      account: lower(event.args.by),
      slot: slotAddr,
      chainId: context.chain.id,
    })
    .set({ lastInteractedAt: event.block.timestamp });

  await context.db.insert(depositedEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId,
    slot: slotAddr,
    currency: s.currency,
    by: lower(event.args.by),
    amount: event.args.amount,
    total: event.args.total,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

ponder.on("Slot:Withdrawn", async ({ event, context }) => {
  const slotAddr = lower(event.log.address);
  const s = await loadSlot(context, slotAddr);

  await context.db
    .update(slot, { id: slotAddr, chainId: context.chain.id })
    .set({
      deposit: event.args.left,
      updatedAt: event.block.timestamp,
    });

  await context.db.insert(withdrawnEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId: context.chain.id,
    slot: slotAddr,
    currency: s.currency,
    occupant: lower(event.args.occupant),
    amount: event.args.amount,
    left: event.args.left,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

// ─── money ─────────────────────────────────────────────────────────────────

/**
 * Tax realised out of the deposit.
 *
 * Fires from every entry point and even when nothing moved, so this is by far
 * the highest-frequency table. `depositLeft` is authoritative for the slot's
 * escrow — no arithmetic here reconstructs it.
 *
 * `collectedTax` is accumulated HERE and not from `TaxPaid`, which is emitted
 * only when `paid > 0`. Doing both would double it.
 */
ponder.on("Slot:Settled", async ({ event, context }) => {
  const slotAddr = lower(event.log.address);
  const s = await loadSlot(context, slotAddr);

  await context.db
    .update(slot, { id: slotAddr, chainId: context.chain.id })
    .set((row) => ({
      deposit: event.args.depositLeft,
      collectedTax: row.collectedTax + event.args.paid,
      // The accrual anchor. `Settled` is the only event that means "tax has
      // been realised up to here", which is why it is written here and not
      // alongside every `updatedAt` — see the column's note in the schema.
      lastSettled: event.block.timestamp,
      updatedAt: event.block.timestamp,
    }));

  await context.db.insert(settledEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId: context.chain.id,
    slot: slotAddr,
    currency: s.currency,
    owed: event.args.owed,
    paid: event.args.paid,
    depositLeft: event.args.depositLeft,
    insolvent: event.args.owed > event.args.paid,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

/**
 * Tax attributed to the occupant who owed it.
 *
 * `paid` is the number that means money moved; `owed` can exceed it when the
 * deposit ran dry. Anything reconstructing contributions from price × time
 * over-credits.
 */
ponder.on("Slot:TaxPaid", async ({ event, context }) => {
  const chainId = context.chain.id;
  const slotAddr = lower(event.log.address);
  const payer = lower(event.args.payer);

  await context.db
    .update(slot, { id: slotAddr, chainId: context.chain.id })
    .set((row) => ({
      taxPaidTotal: row.taxPaidTotal + event.args.paid,
      updatedAt: event.block.timestamp,
    }));

  const s = await loadSlot(context, slotAddr);

  await getOrCreateAccount(context, payer);
  await context.db
    .update(account, { id: payer })
    .set((row) => ({ taxPaidTotal: row.taxPaidTotal + event.args.paid }));

  await getOrCreateAccountSlot(
    context,
    payer,
    event.log.address,
    event.block.timestamp,
    chainId,
  );
  await context.db
    .update(accountSlot, {
      account: payer,
      slot: slotAddr,
      chainId: context.chain.id,
    })
    .set((row) => ({
      taxPaid: row.taxPaid + event.args.paid,
      lastInteractedAt: event.block.timestamp,
    }));

  await context.db.insert(taxPaidEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId,
    slot: slotAddr,
    currency: s.currency,
    payer,
    owed: event.args.owed,
    paid: event.args.paid,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

/** Accrued tax flushed to the recipient. Nothing is carved out of it. */
ponder.on("Slot:TaxCollected", async ({ event, context }) => {
  const slotAddr = lower(event.log.address);
  const s = await loadSlot(context, slotAddr);

  await context.db
    .update(slot, { id: slotAddr, chainId: context.chain.id })
    .set((row) => ({
      collectedTax: 0n,
      totalCollected: row.totalCollected + event.args.amount,
      updatedAt: event.block.timestamp,
    }));

  await getOrCreateAccount(context, event.args.recipient);

  await context.db.insert(taxCollectedEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId: context.chain.id,
    slot: slotAddr,
    currency: s.currency,
    recipient: lower(event.args.recipient),
    amount: event.args.amount,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

/**
 * A payout that could not be pushed.
 *
 * Rare by construction — every payout tries a direct transfer first — and each
 * occurrence is a counterparty the slot cannot pay: a reverting `receive()`, a
 * blocklisting currency, or a recipient whose fallback costs more than the 30k
 * stipend. Worth surfacing loudly, because nothing on chain will.
 */
ponder.on("Slot:Credited", async ({ event, context }) => {
  const chainId = context.chain.id;
  const slotAddr = lower(event.log.address);
  const s = await loadSlot(context, slotAddr);
  const acct = lower(event.args.account);

  await getOrCreateAccount(context, acct);

  await context.db
    .update(slot, { id: slotAddr, chainId: context.chain.id })
    .set((row) => ({
      creditedTotal: row.creditedTotal + event.args.amount,
      updatedAt: event.block.timestamp,
    }));

  await context.db
    .insert(slotCredit)
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

  await context.db.insert(creditedEvent).values({
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

/** Anyone may claim on anyone's behalf; the funds always go to `account`. */
ponder.on("Slot:Claimed", async ({ event, context }) => {
  const chainId = context.chain.id;
  const slotAddr = lower(event.log.address);
  const s = await loadSlot(context, slotAddr);
  const acct = lower(event.args.account);

  await getOrCreateAccount(context, acct);

  await context.db
    .insert(slotCredit)
    .values({
      slot: slotAddr,
      account: acct,
      chainId,
      currency: s.currency,
      credited: 0n,
      claimed: event.args.amount,
      balance: 0n,
      updatedAt: event.block.timestamp,
    })
    .onConflictDoUpdate((row) => ({
      claimed: row.claimed + event.args.amount,
      // A claim always empties the balance — `claim` reads `withdrawableOf`
      // and zeroes it — so this subtracts to zero rather than tracking a
      // partial withdrawal that the contract does not offer.
      balance:
        row.balance > event.args.amount ? row.balance - event.args.amount : 0n,
      updatedAt: event.block.timestamp,
    }));

  await context.db.insert(claimedEvent).values({
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

// ─── delegation ────────────────────────────────────────────────────────────

/**
 * Repricing rights, scoped to one tenure.
 *
 * `_operatorOf` is keyed by `tenureId` on chain, so the row written here is
 * valid for THIS tenure and dies unannounced at the next seating. The tenure
 * goes in the primary key so that expiry is a fact about the row rather than
 * something a reader has to remember — see the note on `slotOperator` for the
 * exact liveness predicate, which also has to test `slot.isOccupied` because a
 * release vacates without advancing the counter.
 *
 * `setOperator` is `onlyOccupant`, so `setBy` is the holder of `tenure`.
 */
ponder.on("Slot:OperatorSet", async ({ event, context }) => {
  const chainId = context.chain.id;
  const slotAddr = lower(event.log.address);
  const s = await loadSlot(context, slotAddr);
  const operator = lower(event.args.operator);
  const tenure = s.tenureId;
  const setBy = s.occupant ?? lower(event.transaction.from);

  await getOrCreateAccount(context, operator);

  await context.db
    .insert(slotOperator)
    .values({
      slot: slotAddr,
      tenure,
      operator,
      chainId,
      approved: event.args.allowed,
      setBy,
      updatedAt: event.block.timestamp,
    })
    .onConflictDoUpdate(() => ({
      approved: event.args.allowed,
      setBy,
      updatedAt: event.block.timestamp,
    }));

  await context.db.insert(operatorSetEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId,
    slot: slotAddr,
    occupant: setBy,
    operator,
    allowed: event.args.allowed,
    tenure,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

// ─── deferred terms ────────────────────────────────────────────────────────

const TERM_TAX = 1;
const TERM_RECIPIENT = 2;
const TERM_MIN_DEPOSIT = 4;
const TERM_MODULE = 8;
const TERM_SCOPES = 16;

/**
 * Terms queued by the manager. Only the masked fields are written; anything
 * already queued under another bit stays, as it does on chain.
 */
ponder.on("Slot:TermsProposed", async ({ event, context }) => {
  const slotAddr = lower(event.log.address);
  const s = await loadSlot(context, slotAddr);
  const { taxTerms, moduleTerms: h, mask } = event.args;
  const tax = (mask & TERM_TAX) !== 0;
  const rec = (mask & TERM_RECIPIENT) !== 0;
  const min = (mask & TERM_MIN_DEPOSIT) !== 0;
  const hk = (mask & TERM_MODULE) !== 0;

  await context.db
    .update(slot, { id: slotAddr, chainId: context.chain.id })
    .set((row) => ({
      pendingMask: row.pendingMask | mask,
      pendingHasTaxRate: tax || row.pendingHasTaxRate,
      pendingTaxRateBps: tax ? BigInt(taxTerms.rateBps) : row.pendingTaxRateBps,
      pendingHasRecipient: rec || row.pendingHasRecipient,
      pendingRecipient: rec ? lower(taxTerms.recipient) : row.pendingRecipient,
      pendingHasMinRunway: min || row.pendingHasMinRunway,
      pendingMinRunwaySeconds: min
        ? BigInt(taxTerms.minRunwaySeconds)
        : row.pendingMinRunwaySeconds,
      pendingHasModule: hk || row.pendingHasModule,
      pendingModule: hk ? lower(h.target) : row.pendingModule,
      pendingModuleSettings: hk ? lower(h.settings) : row.pendingModuleSettings,
      pendingProposedAt: event.block.timestamp,
      updatedAt: event.block.timestamp,
    }));

  await context.db.insert(termsProposedEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId: context.chain.id,
    slot: slotAddr,
    manager: s.manager ?? lower(event.transaction.from),
    mask,
    changeTax: tax,
    changeRecipient: rec,
    changeMinDeposit: min,
    changeModule: hk,
    taxRateBps: BigInt(taxTerms.rateBps),
    recipient: lower(taxTerms.recipient),
    minRunwaySeconds: BigInt(taxTerms.minRunwaySeconds),
    module: lower(h.target),
    settings: lower(h.settings),
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

/**
 * Queued terms landed, at a buy or at `applyTerms`. The event carries the
 * terms now in force, manifest included.
 */
ponder.on("Slot:TermsApplied", async ({ event, context }) => {
  const chainId = context.chain.id;
  const slotAddr = lower(event.log.address);
  const s = await loadSlot(context, slotAddr);
  const { taxTerms, moduleTerms: h, manifest: offer, mask } = event.args;

  const nextModule = lower(h.target);
  const nextModuleSettings = lower(h.settings);
  const nextRecipient = lower(taxTerms.recipient);
  const prevModule = s.module;
  const prevModuleSettings = s.settings ?? NO_SETTINGS;
  const moduleChanged = (prevModule ?? ZERO_ADDR) !== nextModule;
  const settingsChanged = prevModuleSettings !== nextModuleSettings;
  const taxChanged = s.taxRateBps !== BigInt(taxTerms.rateBps);
  const recipientChanged = s.recipient !== nextRecipient;

  const scopes = unpackScopes(offer.scopes);

  if (moduleChanged) {
    if (prevModule) {
      await bumpModuleSlotCount(context, prevModule, event.block.timestamp, -1);
    }
    if (nextModule !== ZERO_ADDR) {
      await bumpModuleSlotCount(context, nextModule, event.block.timestamp, 1);
    }
  }

  // The slot, and its occupancy if seated, move to the new recipient.
  let recipientAccount = s.recipientAccount;
  if (recipientChanged) {
    const seated = s.occupant != null && s.occupant !== ZERO_ADDR;
    const next = await getOrCreateAccount(context, taxTerms.recipient);
    recipientAccount = next.id;
    await context.db
      .update(account, { id: s.recipient })
      .set((row) => ({ slotCount: row.slotCount - 1 }));
    await context.db
      .update(account, { id: next.id })
      .set((row) => ({ slotCount: row.slotCount + 1 }));
    await bumpAccountChain(context, s.recipient as Hex, chainId, {
      slotCount: -1,
      occupiedAsRecipient: seated ? -1 : 0,
    });
    await bumpAccountChain(context, taxTerms.recipient, chainId, {
      slotCount: 1,
      occupiedAsRecipient: seated ? 1 : 0,
    });
  }

  const noModule = nextModule === ZERO_ADDR;
  await context.db.update(slot, { id: slotAddr, chainId }).set({
    taxRateBps: BigInt(taxTerms.rateBps),
    recipient: nextRecipient,
    recipientAccount,
    minRunwaySeconds: BigInt(taxTerms.minRunwaySeconds),
    module: noModule ? null : nextModule,
    settings: noModule ? null : nextModuleSettings,
    moduleFeeBps: offer.feeBps,
    moduleFeeRecipient: offer.feeBps === 0 ? null : lower(offer.feeRecipient),
    ...scopeColumns(scopes),
    pendingMask: 0,
    pendingHasTaxRate: false,
    pendingTaxRateBps: null,
    pendingHasRecipient: false,
    pendingRecipient: null,
    pendingHasMinRunway: false,
    pendingMinRunwaySeconds: null,
    pendingHasModule: false,
    pendingModule: null,
    pendingModuleSettings: null,
    pendingHasScopes: false,
    pendingScopes: null,
    pendingProposedAt: null,
    updatedAt: event.block.timestamp,
  });

  await context.db.insert(termsAppliedEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId,
    slot: slotAddr,
    mask,
    taxRateBps: BigInt(taxTerms.rateBps),
    recipient: nextRecipient,
    minRunwaySeconds: BigInt(taxTerms.minRunwaySeconds),
    module: nextModule,
    settings: nextModuleSettings,
    scopes: offer.scopes,
    moduleFeeBps: offer.feeBps,
    moduleFeeRecipient: lower(offer.feeRecipient),
    previousTaxPercentage: s.taxRateBps,
    previousRecipient: s.recipient,
    previousModule: prevModule ?? ZERO_ADDR,
    previousModuleSettings: prevModuleSettings,
    taxChanged,
    recipientChanged,
    moduleChanged,
    settingsChanged,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

/**
 * Queued terms retracted. The event's mask is what was actually dropped, so
 * only those columns clear; whatever else is queued keeps its clock.
 */
ponder.on("Slot:TermsCancelled", async ({ event, context }) => {
  const slotAddr = lower(event.log.address);
  const s = await loadSlot(context, slotAddr);
  const { mask } = event.args;
  const tax = (mask & TERM_TAX) !== 0;
  const rec = (mask & TERM_RECIPIENT) !== 0;
  const min = (mask & TERM_MIN_DEPOSIT) !== 0;
  const hk = (mask & TERM_MODULE) !== 0;
  const hf = (mask & TERM_SCOPES) !== 0;
  const left = s.pendingMask & ~mask;

  await context.db
    .update(slot, { id: slotAddr, chainId: context.chain.id })
    .set({
      pendingMask: left,
      pendingHasTaxRate: tax ? false : s.pendingHasTaxRate,
      pendingTaxRateBps: tax ? null : s.pendingTaxRateBps,
      pendingHasRecipient: rec ? false : s.pendingHasRecipient,
      pendingRecipient: rec ? null : s.pendingRecipient,
      pendingHasMinRunway: min ? false : s.pendingHasMinRunway,
      pendingMinRunwaySeconds: min ? null : s.pendingMinRunwaySeconds,
      pendingHasModule: hk ? false : s.pendingHasModule,
      pendingModule: hk ? null : s.pendingModule,
      pendingModuleSettings: hk ? null : s.pendingModuleSettings,
      pendingHasScopes: hf ? false : s.pendingHasScopes,
      pendingScopes: hf ? null : s.pendingScopes,
      pendingProposedAt: left === 0 ? null : s.pendingProposedAt,
      updatedAt: event.block.timestamp,
    });

  await context.db.insert(termsCancelledEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId: context.chain.id,
    slot: slotAddr,
    manager: s.manager ?? lower(event.transaction.from),
    mask,
    cancelTax: tax,
    cancelRecipient: rec,
    cancelMinDeposit: min,
    cancelModule: hk,
    cancelledTaxPercentage: tax ? s.pendingTaxRateBps : null,
    cancelledRecipient: rec ? s.pendingRecipient : null,
    cancelledModule: hk ? s.pendingModule : null,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

/** The module's share of a payout. Emitted just before `TaxCollected`. */
ponder.on("Slot:ModuleFeePaid", async ({ event, context }) => {
  const slotAddr = lower(event.log.address);
  const s = await loadSlot(context, slotAddr);

  await context.db
    .update(slot, { id: slotAddr, chainId: context.chain.id })
    .set((row) => ({
      moduleFeesTotal: row.moduleFeesTotal + event.args.amount,
      updatedAt: event.block.timestamp,
    }));

  await getOrCreateAccount(context, event.args.recipient);

  await context.db.insert(moduleFeePaidEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId: context.chain.id,
    slot: slotAddr,
    module: lower(event.args.module),
    recipient: lower(event.args.recipient),
    currency: s.currency,
    amount: event.args.amount,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

/** Debt repaid into collected tax, by a rebuy, a buyout or a top-up. */
ponder.on("Slot:DebtRepaid", async ({ event, context }) => {
  const slotAddr = lower(event.log.address);
  const s = await loadSlot(context, slotAddr);

  await context.db
    .update(slot, { id: slotAddr, chainId: context.chain.id })
    .set((row) => ({
      debtRepaidTotal: row.debtRepaidTotal + event.args.amount,
      updatedAt: event.block.timestamp,
    }));

  await getOrCreateAccount(context, event.args.account);

  await context.db.insert(debtRepaidEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId: context.chain.id,
    slot: slotAddr,
    account: lower(event.args.account),
    currency: s.currency,
    amount: event.args.amount,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

/*
 * `Slot:OrderCancelled` USED TO BE HANDLED HERE.
 *
 * It reported a buyer burning a signed sell-order nonce. There are no signed
 * orders any more: a bid is an on-chain row in the OfferBook, and retracting it
 * is `OfferBook.cancel`, which the book emits `Cancelled` for.
 */

// ─── modules ─────────────────────────────────────────────────────────────────

/**
 * An `after` callback reverted and was swallowed.
 *
 * The protocol's only observability into a broken module: nothing reverts,
 * nothing retries, and the action the module was watching succeeded anyway. If
 * this is not indexed, a module that has stopped working is completely silent.
 *
 * Never emitted for the `before` side — a failing `before` reverts the whole
 * transaction and never reaches here.
 */
ponder.on("Slot:ModuleCallFailed", async ({ event, context }) => {
  const chainId = context.chain.id;
  const slotAddr = lower(event.log.address);
  const moduleAddr = lower(event.args.module);

  await bumpModuleSlotCount(context, moduleAddr, event.block.timestamp, 0);
  await context.db.update(module, { id: moduleAddr, chainId }).set((row) => ({
    failedCallCount: row.failedCallCount + 1,
    updatedAt: event.block.timestamp,
  }));

  await context.db.insert(moduleCallFailedEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId,
    slot: slotAddr,
    module: moduleAddr,
    selector: event.args.selector,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

ponder.on("Slot:ManagerSet", async ({ event, context }) => {
  await getOrCreateAccount(context, event.args.next);
  await context.db
    .update(slot, { id: lower(event.log.address), chainId: context.chain.id })
    .set({ manager: lower(event.args.next), updatedAt: event.block.timestamp });
});

/**
 * The manager granted the module's current manifest. A new fee applies now; new
 * scopes queue for the next buy, restarting the queue's clock.
 */
ponder.on("Slot:ScopesGranted", async ({ event, context }) => {
  const { manifest, feeApplied, scopesQueued } = event.args;
  const slotAddr = lower(event.log.address);
  const s = await loadSlot(context, slotAddr);
  await context.db.update(slot, { id: slotAddr, chainId: context.chain.id }).set({
    ...(feeApplied
      ? {
          moduleFeeBps: manifest.feeBps,
          moduleFeeRecipient:
            manifest.feeBps === 0 ? null : lower(manifest.feeRecipient),
        }
      : {}),
    ...(scopesQueued
      ? {
          pendingMask: s.pendingMask | TERM_SCOPES,
          pendingHasScopes: true,
          pendingScopes: manifest.scopes,
          pendingProposedAt: event.block.timestamp,
        }
      : {}),
    updatedAt: event.block.timestamp,
  });
});
