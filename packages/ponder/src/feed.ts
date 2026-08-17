import { type Context, ponder } from "ponder:registry";
import {
  feed,
  feedCreatedEvent,
  feedHub,
  feedMetadataURIUpdatedEvent,
  feedNameUpdatedEvent,
  feedRecipientUpdatedEvent,
  feedSlotAddedEvent,
  feedSlotRemovedEvent,
  slot,
} from "ponder:schema";
import { getAddress, type Hex } from "viem";
import { FeedAbi } from "../abis";
import { evtId, extractCid, lower, resolveAdJson, ZERO_ADDR } from "./helpers";

/**
 * Feed metadata, resolved from the URI.
 *
 * The subgraph could not do this. Its File Data Sources fetch asynchronously
 * and cannot write back to the entity that spawned them, so every IPFS-hosted
 * feed had null name/description/image/banner/link and a `displayName` stuck on
 * the on-chain name — a caveat its own schema documents. Here the fetch is just
 * awaited.
 *
 * The cost is real and worth stating: an IPFS round trip inside a handler is
 * the most expensive thing this indexer does, measured at ~770ms/event against
 * ~1ms for handlers that touch no network. Feeds are few, so it is affordable
 * here in a way it would not be on a high-frequency event.
 */
async function resolveMetadata(uri: string) {
  const empty = {
    metadataName: null as string | null,
    description: null as string | null,
    image: null as string | null,
    banner: null as string | null,
    externalLink: null as string | null,
    metadataRaw: null as string | null,
    metadataCid: null as string | null,
  };
  if (!uri) return empty;

  const cid = extractCid(uri);
  const raw = await resolveAdJson(uri);
  if (!raw) return { ...empty, metadataCid: cid };

  const str = (v: unknown) => (typeof v === "string" ? v : null);
  try {
    const obj = JSON.parse(raw);
    return {
      metadataName: str(obj?.name),
      description: str(obj?.description),
      image: str(obj?.image),
      banner: str(obj?.banner),
      externalLink: str(obj?.externalLink),
      metadataRaw: raw,
      metadataCid: cid,
    };
  } catch {
    // Not JSON — keep the raw document, it is still what the URI resolved to.
    return { ...empty, metadataRaw: raw, metadataCid: cid };
  }
}

/** Read a feed's current on-chain strings, tolerating a revert. */
async function readFeed(context: Context, address: Hex) {
  const checksum = getAddress(address);
  const abi = FeedAbi as unknown as readonly unknown[];
  const read = async (functionName: string) => {
    try {
      return await context.client.readContract({
        address: checksum,
        abi,
        functionName,
      });
    } catch {
      return undefined;
    }
  };
  const [name, metadataURI, recipient] = await Promise.all([
    read("name"),
    read("metadataURI"),
    read("feedRecipient"),
  ]);
  return {
    onchainName: typeof name === "string" ? name : "",
    metadataURI: typeof metadataURI === "string" ? metadataURI : "",
    recipient:
      typeof recipient === "string" ? lower(recipient as Hex) : ZERO_ADDR,
  };
}

ponder.on("FeedHub:FeedCreated", async ({ event, context }) => {
  const chainId = context.chain.id;
  const hubId = lower(event.log.address);
  const feedId = lower(event.args.feed);

  await context.db
    .insert(feedHub)
    .values({ id: hubId, chainId, feedCount: 1n })
    .onConflictDoUpdate((row) => ({ feedCount: row.feedCount + 1n }));

  const onchain = await readFeed(context, event.args.feed);
  const meta = await resolveMetadata(onchain.metadataURI);

  await context.db.insert(feed).values({
    id: feedId,
    chainId,
    hub: hubId,
    index: event.args.index,
    owner: lower(event.args.owner),
    onchainName: onchain.onchainName,
    metadataURI: onchain.metadataURI,
    recipient: onchain.recipient,
    // Driven solely by SlotAdded. NOT seeded from `slotCount()`: createFeed and
    // createSlots land in the same block, so an eth_call returns the
    // end-of-block value with every slot already minted, and the SlotAdded
    // events that follow would then double-count it.
    slotCount: 0n,
    ...meta,
    displayName: meta.metadataName ?? onchain.onchainName,
    createdAt: event.block.timestamp,
    createdTx: event.transaction.hash,
    updatedAt: event.block.timestamp,
  });

  await context.db.insert(feedCreatedEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId,
    hub: hubId,
    feed: feedId,
    index: event.args.index,
    owner: lower(event.args.owner),
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

ponder.on("Feed:NameUpdated", async ({ event, context }) => {
  const feedId = lower(event.log.address);
  const row = await context.db.find(feed, { id: feedId });
  if (!row) return;

  await context.db.update(feed, { id: feedId }).set({
    onchainName: event.args.name,
    // The metadata document still wins when it names the feed.
    displayName: row.metadataName ?? event.args.name,
    updatedAt: event.block.timestamp,
  });

  await context.db.insert(feedNameUpdatedEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId: context.chain.id,
    feed: feedId,
    name: event.args.name,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

ponder.on("Feed:MetadataURIUpdated", async ({ event, context }) => {
  const feedId = lower(event.log.address);
  const row = await context.db.find(feed, { id: feedId });
  if (!row) return;

  const meta = await resolveMetadata(event.args.uri);
  await context.db.update(feed, { id: feedId }).set({
    metadataURI: event.args.uri,
    ...meta,
    displayName: meta.metadataName ?? row.onchainName,
    updatedAt: event.block.timestamp,
  });

  await context.db.insert(feedMetadataURIUpdatedEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId: context.chain.id,
    feed: feedId,
    uri: event.args.uri,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

ponder.on("Feed:RecipientUpdated", async ({ event, context }) => {
  const feedId = lower(event.log.address);
  const row = await context.db.find(feed, { id: feedId });
  if (!row) return;

  await context.db.update(feed, { id: feedId }).set({
    recipient: lower(event.args.recipient),
    updatedAt: event.block.timestamp,
  });

  await context.db.insert(feedRecipientUpdatedEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId: context.chain.id,
    feed: feedId,
    recipient: lower(event.args.recipient),
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

ponder.on("Feed:SlotAdded", async ({ event, context }) => {
  const feedId = lower(event.log.address);
  const slotId = lower(event.args.slot);

  const row = await context.db.find(feed, { id: feedId });
  if (row) {
    await context.db
      .update(feed, { id: feedId })
      .set({ slotCount: row.slotCount + 1n, updatedAt: event.block.timestamp });
  }

  // The slot may not be indexed yet — a feed can add a slot the factory has
  // not emitted for in this ordering — so this is conditional rather than
  // assumed.
  const slotRow = await context.db.find(slot, { id: slotId });
  if (slotRow) {
    await context.db
      .update(slot, { id: slotId })
      .set({ feed: feedId, updatedAt: event.block.timestamp });
  }

  await context.db.insert(feedSlotAddedEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId: context.chain.id,
    feed: feedId,
    slot: slotId,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

ponder.on("Feed:SlotRemoved", async ({ event, context }) => {
  const feedId = lower(event.log.address);
  const slotId = lower(event.args.slot);

  const row = await context.db.find(feed, { id: feedId });
  if (row && row.slotCount > 0n) {
    await context.db
      .update(feed, { id: feedId })
      .set({ slotCount: row.slotCount - 1n, updatedAt: event.block.timestamp });
  }

  const slotRow = await context.db.find(slot, { id: slotId });
  if (slotRow) {
    await context.db
      .update(slot, { id: slotId })
      .set({ feed: null, updatedAt: event.block.timestamp });
  }

  await context.db.insert(feedSlotRemovedEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId: context.chain.id,
    feed: feedId,
    slot: slotId,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});
