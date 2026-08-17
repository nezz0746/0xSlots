import { type Context, ponder } from "ponder:registry";
import {
  account,
  accountSlot,
  metadataSlot,
  metadataUpdatedEvent,
  slot,
} from "ponder:schema";
import type { Hex } from "viem";
import {
  evtId,
  extractAdType,
  extractCid,
  getOrCreateAccount,
  getOrCreateAccountSlot,
  lower,
  resolveAdJson,
} from "./helpers";

type MinimalEvent = {
  block: { timestamp: bigint; number: bigint };
  log: { address: Hex; logIndex: number };
  transaction: { hash: Hex; from: Hex };
};

async function applyMetadataUpdate(
  context: Context,
  event: MinimalEvent,
  slotAddrRaw: Hex,
  authorAddrRaw: Hex,
  uri: string,
  updatedByForRow: Hex,
  chainId: number,
) {
  const slotId = lower(slotAddrRaw);
  const s = await context.db.find(slot, { id: slotId });
  if (!s) return;

  await context.db.update(slot, { id: slotId }).set({
    updatedAt: event.block.timestamp,
  });

  const content = await resolveAdJson(uri);
  const adType = content ? extractAdType(content) : null;
  const cid = extractCid(uri);
  const updatedBy = lower(updatedByForRow);

  const existingMs = await context.db.find(metadataSlot, { id: slotId });
  if (!existingMs) {
    await context.db.insert(metadataSlot).values({
      id: slotId,
      chainId,
      slot: slotId,
      uri,
      cid,
      rawJson: content,
      adType,
      updatedBy,
      updateCount: 1n,
      createdAt: event.block.timestamp,
      createdTx: event.transaction.hash,
      updatedAt: event.block.timestamp,
      updatedTx: event.transaction.hash,
    });
  } else {
    await context.db.update(metadataSlot, { id: slotId }).set((row) => ({
      uri,
      cid,
      rawJson: content,
      adType,
      updatedBy,
      updateCount: row.updateCount + 1n,
      updatedAt: event.block.timestamp,
      updatedTx: event.transaction.hash,
    }));
  }

  // Author bookkeeping (Account + AccountSlot)
  const author = await getOrCreateAccount(context, authorAddrRaw, true);
  await context.db.update(account, { id: author.id }).set((row) => ({
    metadataUpdateCount: row.metadataUpdateCount + 1n,
  }));

  await getOrCreateAccountSlot(
    context,
    authorAddrRaw,
    slotAddrRaw,
    event.block.timestamp,
    chainId,
  );
  await context.db
    .update(accountSlot, { account: lower(authorAddrRaw), slot: slotId })
    .set((row) => ({
      metadataUpdateCount: row.metadataUpdateCount + 1n,
      lastInteractedAt: event.block.timestamp,
    }));

  await context.db.insert(metadataUpdatedEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId,
    slot: slotId,
    author: author.id,
    updatedBy,
    uri,
    cid,
    rawJson: content,
    adType,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
}

// V1: MetadataUpdated(slot, uri) — fires for both MetadataModule and
// FeedPostModule v1 contracts, since the ABI is shared. author = tx.from.
ponder.on(
  "FeedPostModule:MetadataUpdated(address indexed slot, string uri)",
  async ({ event, context }) => {
    await applyMetadataUpdate(
      context,
      event,
      event.args.slot,
      event.transaction.from,
      event.args.uri,
      event.transaction.from,
      context.chain.id,
    );
  },
);

// V2 (same FeedPostModule contract, overloaded event):
// MetadataUpdated(slot, updatedBy, uri) — author = updatedBy
ponder.on(
  "FeedPostModule:MetadataUpdated(address indexed slot, address indexed updatedBy, string uri)",
  async ({ event, context }) => {
    await applyMetadataUpdate(
      context,
      event,
      event.args.slot,
      event.args.updatedBy,
      event.args.uri,
      event.args.updatedBy,
      context.chain.id,
    );
  },
);
