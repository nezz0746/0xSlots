import { type Context, ponder } from "ponder:registry";
import {
  account,
  accountSlot,
  boughtEvent,
  cancelledOrder,
  claimedEvent,
  creditedEvent,
  depositedEvent,
  hook,
  hookCallFailedEvent,
  liquidatedEvent,
  operatorSetEvent,
  orderCancelledEvent,
  priceSetEvent,
  proposalCancelledEvent,
  releasedEvent,
  settledEvent,
  slot,
  slotCredit,
  slotOperator,
  soldEvent,
  taxCollectedEvent,
  taxPaidEvent,
  termsAppliedEvent,
  termsProposedEvent,
  withdrawnEvent,
} from "ponder:schema";
import type { Hex } from "viem";
import {
  bumpAccountChain,
  bumpHookSlotCount,
  evtId,
  getOrCreateAccount,
  getOrCreateAccountSlot,
  hookFlagColumns,
  lower,
  NO_HOOK_FLAGS,
  readSlotTerms,
  ZERO_ADDR,
  ZERO_DATA,
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
  const row = await context.db.find(slot, { id: lower(addr) });
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
    .update(accountSlot, { account: lower(event.args.buyer), slot: slotAddr })
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

  await context.db.update(slot, { id: slotAddr }).set({
    occupant: lower(event.args.buyer),
    occupantAccount: buyer.id,
    isOccupied: true,
    occupiedSince: event.block.timestamp,
    tenureId: tenure,
    price: event.args.price,
    deposit: event.args.deposit,
    updatedAt: event.block.timestamp,
  });

  // `sell` emits `Sold` immediately before this `Bought`, in the same call,
  // so the preceding log index is an exact test for which path we are on. A
  // primary-key lookup rather than a scan.
  const viaSell =
    event.log.logIndex > 0 &&
    (await context.db.find(soldEvent, {
      id: evtId(event.transaction.hash, event.log.logIndex - 1),
    })) != null;

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
    viaSell,
    tenure,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

/**
 * The seller's side of a negotiated sale.
 *
 * Records only. The `Bought` emitted one log later does the occupancy work —
 * see the ordering note at the top of this file.
 */
ponder.on("Slot:Sold", async ({ event, context }) => {
  const slotAddr = lower(event.log.address);
  const s = await loadSlot(context, slotAddr);

  await getOrCreateAccount(
    context,
    event.args.seller,
    lower(event.args.seller) === lower(event.transaction.from),
  );
  await getOrCreateAccount(context, event.args.buyer);

  await context.db.insert(soldEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId: context.chain.id,
    slot: slotAddr,
    currency: s.currency,
    seller: lower(event.args.seller),
    buyer: lower(event.args.buyer),
    price: event.args.price,
    deposit: event.args.deposit,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

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

  await context.db.update(slot, { id: slotAddr }).set({
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

  await context.db.update(slot, { id: slotAddr }).set({
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

  await context.db.update(slot, { id: slotAddr }).set({
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

  await context.db.update(slot, { id: slotAddr }).set({
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
    .update(accountSlot, { account: lower(event.args.by), slot: slotAddr })
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

  await context.db.update(slot, { id: slotAddr }).set({
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

  await context.db.update(slot, { id: slotAddr }).set((row) => ({
    deposit: event.args.depositLeft,
    collectedTax: row.collectedTax + event.args.paid,
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

  await context.db.update(slot, { id: slotAddr }).set((row) => ({
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
    .update(accountSlot, { account: payer, slot: slotAddr })
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

  await context.db.update(slot, { id: slotAddr }).set((row) => ({
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

  await context.db.update(slot, { id: slotAddr }).set((row) => ({
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

/**
 * Terms queued by the manager.
 *
 * The event carries BOTH values on every emission regardless of which
 * dimension was touched, so `tax` / `hook_` are the only way to tell what was
 * actually proposed. Each dimension is written independently — proposing a tax
 * change does not clear a hook change already queued, and the contract's
 * `Pending` struct behaves the same way.
 */
ponder.on("Slot:TermsProposed", async ({ event, context }) => {
  const slotAddr = lower(event.log.address);
  const s = await loadSlot(context, slotAddr);
  const proposedHook = lower(event.args.hook);

  await context.db.update(slot, { id: slotAddr }).set((row) => ({
    pendingHasTax: event.args.tax || row.pendingHasTax,
    pendingTaxPercentage: event.args.tax
      ? event.args.taxPercentage
      : row.pendingTaxPercentage,
    pendingHasHook: event.args.hook_ || row.pendingHasHook,
    // The zero address is a real proposed value — "detach the hook" — which is
    // why `pendingHasHook` exists rather than testing this column for null.
    pendingHook: event.args.hook_ ? proposedHook : row.pendingHook,
    // Under the same flag as the address, because the contract queues them
    // together: a proposal that named a hook also named its configuration.
    pendingHookData: event.args.hook_
      ? lower(event.args.hookData)
      : row.pendingHookData,
    pendingProposedAt: event.block.timestamp,
    updatedAt: event.block.timestamp,
  }));

  await context.db.insert(termsProposedEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId: context.chain.id,
    slot: slotAddr,
    manager: s.manager ?? lower(event.transaction.from),
    changeTax: event.args.tax,
    changeHook: event.args.hook_,
    taxPercentage: event.args.taxPercentage,
    hook: proposedHook,
    hookData: lower(event.args.hookData),
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

/**
 * Queued terms landing at an occupancy transition.
 *
 * Reports the slot's FINAL values including the dimension that did not move,
 * so what changed is computed by diffing against the row.
 *
 * The hook flag snapshot is re-read here rather than carried over: the contract
 * calls `_readHookFlags` again at apply time precisely because the hook could
 * have been upgraded since it was proposed, and the snapshot must describe the
 * code that will actually run.
 */
ponder.on("Slot:TermsApplied", async ({ event, context }) => {
  const chainId = context.chain.id;
  const slotAddr = lower(event.log.address);
  const s = await loadSlot(context, slotAddr);

  const nextHook = lower(event.args.hook);
  const nextHookData = lower(event.args.hookData);
  const prevHook = s.hook;
  const prevHookData = s.hookData ?? ZERO_DATA;
  const hookChanged = (prevHook ?? ZERO_ADDR) !== nextHook;
  const taxChanged = s.taxPercentage !== event.args.taxPercentage;

  let flags = NO_HOOK_FLAGS;
  if (nextHook !== ZERO_ADDR) {
    if (hookChanged) {
      // A new hook: read the snapshot the slot just took.
      const terms = await readSlotTerms(context, slotAddr);
      flags = terms.flags;
    } else {
      flags = {
        beforeBuy: s.hookBeforeBuy,
        beforeSell: s.hookBeforeSell,
        beforeSelfAssess: s.hookBeforeSelfAssess,
        afterBuy: s.hookAfterBuy,
        afterSell: s.hookAfterSell,
        afterRelease: s.hookAfterRelease,
        afterLiquidate: s.hookAfterLiquidate,
        afterSettle: s.hookAfterSettle,
      };
    }
  }

  if (hookChanged) {
    if (prevHook) {
      await bumpHookSlotCount(context, prevHook, event.block.timestamp, -1);
    }
    if (nextHook !== ZERO_ADDR) {
      await bumpHookSlotCount(context, nextHook, event.block.timestamp, 1);
    }
  }

  await context.db.update(slot, { id: slotAddr }).set({
    taxPercentage: event.args.taxPercentage,
    hook: nextHook === ZERO_ADDR ? null : nextHook,
    // Detaching clears it on chain, so mirroring the event rather than
    // preserving the old value is what keeps this row honest.
    hookData: nextHook === ZERO_ADDR ? null : nextHookData,
    ...hookFlagColumns(flags),
    pendingHasTax: false,
    pendingTaxPercentage: null,
    pendingHasHook: false,
    pendingHook: null,
    pendingHookData: null,
    pendingProposedAt: null,
    updatedAt: event.block.timestamp,
  });

  await context.db.insert(termsAppliedEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId,
    slot: slotAddr,
    taxPercentage: event.args.taxPercentage,
    hook: nextHook,
    hookData: nextHookData,
    previousTaxPercentage: s.taxPercentage,
    previousHook: prevHook ?? ZERO_ADDR,
    previousHookData: prevHookData,
    taxChanged,
    hookChanged,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

/**
 * A queued proposal retracted, per dimension.
 *
 * `cancelProposal` takes the same two flags `proposeTerms` does — so this
 * clears only the dimensions the event names, and a slot with a tax change and
 * a hook change queued keeps whichever one was not cancelled. Clearing both
 * unconditionally here would reintroduce, in the indexer, exactly the
 * all-or-nothing behaviour the contract was fixed to stop doing: under a
 * collective, tax and hook belong to different roles.
 *
 * `pendingProposedAt` follows the contract's own rule — zeroed only when
 * nothing is left queued, because a surviving proposal keeps its clock.
 *
 * The pre-clear values are copied into the event row. The chain does not carry
 * them here (`ProposalCancelled` names the flags and nothing else), so if they
 * are not captured before the update, what was retracted is unrecoverable
 * without replaying the preceding `TermsProposed`.
 */
ponder.on("Slot:ProposalCancelled", async ({ event, context }) => {
  const slotAddr = lower(event.log.address);
  const s = await loadSlot(context, slotAddr);
  const { tax, hook: hookFlag } = event.args;

  const hadTax = s.pendingHasTax && tax;
  const hadHook = s.pendingHasHook && hookFlag;

  const nextHasTax = tax ? false : s.pendingHasTax;
  const nextHasHook = hookFlag ? false : s.pendingHasHook;

  await context.db.update(slot, { id: slotAddr }).set({
    pendingHasTax: nextHasTax,
    pendingTaxPercentage: tax ? null : s.pendingTaxPercentage,
    pendingHasHook: nextHasHook,
    pendingHook: hookFlag ? null : s.pendingHook,
    pendingHookData: hookFlag ? null : s.pendingHookData,
    // Mirrors `if (!pending.hasTax && !pending.hasHook) pending.proposedAt = 0`.
    pendingProposedAt:
      nextHasTax || nextHasHook ? s.pendingProposedAt : null,
    updatedAt: event.block.timestamp,
  });

  await context.db.insert(proposalCancelledEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId: context.chain.id,
    slot: slotAddr,
    // `cancelProposal` is `onlyManager`, so the manager on the row IS the
    // canceller. `transaction.from` is the fallback only for the impossible
    // case of a slot with no manager, where nothing could have emitted this.
    manager: s.manager ?? lower(event.transaction.from),
    cancelTax: tax,
    cancelHook: hookFlag,
    cancelledTaxPercentage: hadTax ? s.pendingTaxPercentage : null,
    cancelledHook: hadHook ? s.pendingHook : null,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

// ─── signed sell orders ────────────────────────────────────────────────────

/**
 * A buyer burned one of their own nonces.
 *
 * This is the ONLY order-lifecycle event the protocol emits. A nonce is also
 * consumed when an order is FILLED, and `Sold` carries no nonce — so an order
 * book cannot distinguish a filled order from a live one by watching logs; it
 * has to call `orderUsed(buyer, nonce)`. Adding the nonce to `Sold` would close
 * that gap.
 */
ponder.on("Slot:OrderCancelled", async ({ event, context }) => {
  const chainId = context.chain.id;
  const slotAddr = lower(event.log.address);
  const buyer = lower(event.args.buyer);

  await getOrCreateAccount(
    context,
    buyer,
    buyer === lower(event.transaction.from),
  );

  await context.db
    .insert(cancelledOrder)
    .values({
      slot: slotAddr,
      buyer,
      nonce: event.args.nonce,
      chainId,
      cancelledAt: event.block.timestamp,
      tx: event.transaction.hash,
    })
    .onConflictDoNothing();

  await context.db.insert(orderCancelledEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId,
    slot: slotAddr,
    buyer,
    nonce: event.args.nonce,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

// ─── hooks ─────────────────────────────────────────────────────────────────

/**
 * An `after` callback reverted and was swallowed.
 *
 * The protocol's only observability into a broken hook: nothing reverts,
 * nothing retries, and the action the hook was watching succeeded anyway. If
 * this is not indexed, a hook that has stopped working is completely silent.
 *
 * Never emitted for the `before` side — a failing `before` reverts the whole
 * transaction and never reaches here.
 */
ponder.on("Slot:HookCallFailed", async ({ event, context }) => {
  const chainId = context.chain.id;
  const slotAddr = lower(event.log.address);
  const hookAddr = lower(event.args.hook);

  await bumpHookSlotCount(context, hookAddr, event.block.timestamp, 0);
  await context.db
    .update(hook, { id: hookAddr, chainId })
    .set((row) => ({
      failedCallCount: row.failedCallCount + 1,
      updatedAt: event.block.timestamp,
    }));

  await context.db.insert(hookCallFailedEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId,
    slot: slotAddr,
    hook: hookAddr,
    selector: event.args.selector,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});
