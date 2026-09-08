import { ponder } from "ponder:registry";
import {
  accountSlot,
  adKey,
  clearedEvent,
  creative,
  publishedEvent,
  slot,
} from "ponder:schema";

import { evtId, lower } from "./helpers";

/**
 * AdLand: what a slot is showing.
 *
 * The first HOOK this indexer watches, and the reason is narrow: the creative
 * is the entire content of an ad space and it lives nowhere else. Every other
 * source here is the core protocol, which every slot shares — a hook is one
 * behaviour among however many people write, and none of the others is indexed.
 *
 * ── Two events, and both are needed ─────────────────────────────────────────
 *
 * `Published` is somebody putting an ad up. `Cleared` is the hook blanking one
 * because the slot changed hands — emitted from `afterBuy`, `afterRelease` and
 * `afterLiquidate`, with no publish involved. Watching only the first would
 * leave a slot's last creative showing in the index long after the chain had
 * stopped serving it, which is exactly the bug that reaches a share card.
 *
 * ── The clear is recorded, not applied ──────────────────────────────────────
 *
 * A cleared creative keeps its `uri` and gains a `clearedAt`. The contract does
 * the same thing — `AdLand` leaves the string in storage and refuses to return
 * it once `tenureId` has moved on — and the two states are worth telling apart:
 * a slot that has been advertised on and is now empty is a different fact from
 * one nobody has ever bought, and a `uri` of "" cannot express both.
 */

ponder.on("AdLand:Published", async ({ event, context }) => {
  const chainId = context.chain.id;
  const slotAddr = lower(event.args.slot);
  const hook = lower(event.log.address);
  const tenureId = BigInt(event.args.tenureId);

  /**
   * Who published it, taken from the slot this indexer already tracks.
   *
   * Not from `event.transaction.from`, which is whoever SENT the transaction —
   * a relayer, or an operator repricing on the occupant's behalf. The occupant
   * is the only account the contract would have let publish, so the slot's row
   * is both the accurate answer and one we already hold.
   *
   * The ordering this depends on is the chain's, not a guess: `buyAndPublish`
   * buys before it publishes, so `Bought` precedes `Published` in the same
   * transaction and the row is already seated with the new occupant by the time
   * this runs.
   */
  const s = await context.db.find(slot, { id: slotAddr });
  const publisher = s?.occupant ?? null;

  await context.db
    .insert(publishedEvent)
    .values({
      id: evtId(event.transaction.hash, event.log.logIndex),
      chainId,
      slot: slotAddr,
      hook,
      uri: event.args.uri,
      tenureId,
      publisher,
      timestamp: event.block.timestamp,
      blockNumber: event.block.number,
      tx: event.transaction.hash,
    })
    .onConflictDoNothing();

  await context.db
    .insert(creative)
    .values({
      slot: slotAddr,
      chainId,
      hook,
      uri: event.args.uri,
      tenureId,
      publisher,
      clearedAt: null,
      publishCount: 1,
      firstPublishedAt: event.block.timestamp,
      updatedAt: event.block.timestamp,
    })
    .onConflictDoUpdate((row) => ({
      hook,
      uri: event.args.uri,
      tenureId,
      publisher,
      // Republishing into a slot that was cleared makes it current again.
      clearedAt: null,
      publishCount: row.publishCount + 1,
      updatedAt: event.block.timestamp,
    }));

  // The leaderboard's "how many ads has this advertiser run here" — counted as
  // it happens, for the reason given on the column.
  //
  // Only when there is an occupant to attribute it to. `getOrCreateAccountSlot`
  // is deliberately not called here: a row created by a publish would be an
  // advertiser with no tenure and no tax paid, which is not a thing that can
  // happen — the contract refuses a publish from anyone but the occupant, so a
  // missing row means this indexer never saw the buy, and inventing one would
  // put a phantom on the board.
  if (publisher) {
    const existing = await context.db.find(accountSlot, {
      account: publisher,
      slot: slotAddr,
    });
    if (existing) {
      await context.db
        .update(accountSlot, { account: publisher, slot: slotAddr })
        .set({
          publishCount: existing.publishCount + 1,
          lastInteractedAt: event.block.timestamp,
        });
    }
  }
});

ponder.on("AdLand:Cleared", async ({ event, context }) => {
  const chainId = context.chain.id;
  const slotAddr = lower(event.args.slot);

  await context.db
    .insert(clearedEvent)
    .values({
      id: evtId(event.transaction.hash, event.log.logIndex),
      chainId,
      slot: slotAddr,
      hook: lower(event.log.address),
      fromTenure: BigInt(event.args.fromTenure),
      toTenure: BigInt(event.args.toTenure),
      timestamp: event.block.timestamp,
      blockNumber: event.block.number,
      tx: event.transaction.hash,
    })
    .onConflictDoNothing();

  // Nothing to clear if this indexer never saw the publish — a slot advertised
  // on before the hook's start block. `update` on a missing row throws, so the
  // find is the guard rather than a nicety.
  const current = await context.db.find(creative, { slot: slotAddr });
  if (!current) return;

  await context.db.update(creative, { slot: slotAddr }).set({
    clearedAt: event.block.timestamp,
    updatedAt: event.block.timestamp,
  });
});


/**
 * The name registry — which key points where.
 *
 * `slotOf` is a mapping, so the set of keys cannot be read back on chain at
 * all: you can ask what "ethereum" resolves to, but not which names exist. That
 * was tolerable while only the owner could set one and there were a handful.
 * Keys are now claimed permissionlessly at creation, so the set grows without
 * anybody holding a list of it, and this is the only place that list can come
 * from.
 *
 * Three events and they are one state machine: a key is SET (immediately, on
 * first claim), then any later change is PROPOSED, waits out `CHANGE_DELAY`,
 * and is either committed — which emits `SlotSet` again — or cancelled.
 */

ponder.on("AdLand:SlotSet", async ({ event, context }) => {
  const chainId = context.chain.id;
  const key = event.args.key;
  const hook = lower(event.log.address);
  const target = lower(event.args.slot);

  await context.db
    .insert(adKey)
    .values({
      key,
      chainId,
      hook,
      slot: target,
      pendingSlot: null,
      pendingReadyAt: null,
      setCount: 1,
      claimedAt: event.block.timestamp,
      updatedAt: event.block.timestamp,
    })
    // A commit fires `SlotSet` too, so this is both the claim and every later
    // landing. Clearing `pending*` here is what closes the loop: the proposal
    // that produced this change is spent, and a row still advertising it would
    // show a queued repoint that already happened.
    .onConflictDoUpdate((row) => ({
      slot: target,
      hook,
      pendingSlot: null,
      pendingReadyAt: null,
      setCount: row.setCount + 1,
      updatedAt: event.block.timestamp,
    }));
});

ponder.on("AdLand:SlotProposed", async ({ event, context }) => {
  const chainId = context.chain.id;

  // No insert branch. A proposal can only exist on a key that already resolves
  // somewhere — the contract writes straight through on a virgin key and never
  // queues one — so a missing row here would mean the indexer had lost the
  // `SlotSet` that created it, and inventing a row to hang the pending change
  // on would paper over exactly that.
  await context.db
    .update(adKey, { key: event.args.key, chainId })
    .set({
      pendingSlot: lower(event.args.slot),
      pendingReadyAt: BigInt(event.args.readyAt),
      updatedAt: event.block.timestamp,
    });
});

ponder.on("AdLand:SlotProposalCancelled", async ({ event, context }) => {
  const chainId = context.chain.id;

  await context.db
    .update(adKey, { key: event.args.key, chainId })
    .set({
      pendingSlot: null,
      pendingReadyAt: null,
      updatedAt: event.block.timestamp,
    });
});
