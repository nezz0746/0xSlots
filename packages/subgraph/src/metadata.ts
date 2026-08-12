import { Address, BigInt, json } from "@graphprotocol/graph-ts";
import { MetadataUpdated } from "../generated/MetadataModule/MetadataModule";
import { MetadataSlot, MetadataUpdatedEvent, Slot } from "../generated/schema";
import { MetadataUpdated as MetadataUpdatedV2 } from "../generated/templates/FeedPostModule/FeedPostModuleV2";
import { IpfsContent as IpfsContentTemplate } from "../generated/templates";
import { getOrCreateAccount, getOrCreateAccountSlot } from "./helpers";

/**
 * INLINE content only — a `uri` that is literally a JSON document.
 *
 * That case needs no fetching, so it is still resolved synchronously here and
 * stored on the chain entity. Anything IPFS returns null and is handled by
 * `spawnIpfsContent` instead: `ipfs.cat` used to serve both from this one
 * function, blocking the handler and returning null on timeout — which the
 * callers then recorded, permanently, as "this URI has no content".
 */
export function resolveInlineContent(uri: string): string | null {
  return uri.startsWith("{") ? uri : null;
}

/**
 * Start fetching `uri`'s file if it is an IPFS URI, and return the CID to
 * store as the link. Null for inline JSON and anything unrecognised.
 *
 * Safe to call repeatedly with the same CID — Graph Node de-duplicates file
 * data sources by (template, id), which matters because the same metadata
 * document is commonly re-set across many slots and updates.
 */
export function spawnIpfsContent(uri: string): string | null {
  const cid = extractCid(uri);
  if (cid) IpfsContentTemplate.create(cid);
  return cid;
}

/**
 * Extract the IPFS CID from a URI string.
 * Returns null for inline JSON or non-IPFS URIs.
 */
export function extractCid(uri: string): string | null {
  if (uri.startsWith("Qm") || uri.startsWith("bafy")) return uri;
  if (uri.startsWith("ipfs://")) return uri.slice(7);
  return null;
}

/**
 * Try to extract "type" from a JSON string.
 */
function extractAdType(rawJson: string): string | null {
  const result = json.try_fromString(rawJson);
  if (result.isError) return null;
  const obj = result.value.toObject();
  const t = obj.get("type");
  if (t && !t.isNull()) return t.toString();
  return null;
}

export function handleMetadataUpdated(event: MetadataUpdated): void {
  const slotId = event.params.slot.toHexString();
  const slot = Slot.load(slotId);
  if (slot == null) return;

  slot.updatedAt = event.block.timestamp;
  slot.save();

  // Inline JSON is parsed here; an IPFS uri is fetched out of band and lands
  // on the linked IpfsContent row instead.
  const content = resolveInlineContent(event.params.uri);
  const adType: string | null = content ? extractAdType(content) : null;
  const cid = spawnIpfsContent(event.params.uri);

  // Upsert MetadataSlot (mutable — latest state)
  let metadataSlot = MetadataSlot.load(slotId);
  if (metadataSlot == null) {
    metadataSlot = new MetadataSlot(slotId);
    metadataSlot.slot = slotId;
    metadataSlot.updateCount = BigInt.fromI32(0);
    metadataSlot.createdAt = event.block.timestamp;
    metadataSlot.createdTx = event.transaction.hash;
  }
  metadataSlot.uri = event.params.uri;
  metadataSlot.cid = cid;
  metadataSlot.content = cid;
  metadataSlot.rawJson = content;
  metadataSlot.adType = adType;
  metadataSlot.updatedBy = event.transaction.from;
  metadataSlot.updateCount = metadataSlot.updateCount.plus(BigInt.fromI32(1));
  metadataSlot.updatedAt = event.block.timestamp;
  metadataSlot.updatedTx = event.transaction.hash;
  metadataSlot.save();

  // Track metadata update counts on Account & AccountSlot
  const author = getOrCreateAccount(event.transaction.from, true);
  author.metadataUpdateCount = author.metadataUpdateCount.plus(
    BigInt.fromI32(1),
  );
  author.save();

  const authorAS = getOrCreateAccountSlot(
    event.transaction.from,
    event.params.slot,
    event.block.timestamp,
  );
  authorAS.metadataUpdateCount = authorAS.metadataUpdateCount.plus(
    BigInt.fromI32(1),
  );
  authorAS.lastInteractedAt = event.block.timestamp;
  authorAS.save();

  // Create immutable history event
  const eventId =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  const metadataEvent = new MetadataUpdatedEvent(eventId);
  metadataEvent.slot = slotId;
  metadataEvent.author = author.id;
  metadataEvent.updatedBy = event.transaction.from;
  metadataEvent.uri = event.params.uri;
  metadataEvent.cid = cid;
  metadataEvent.content = cid;
  metadataEvent.rawJson = content;
  metadataEvent.adType = adType;
  metadataEvent.timestamp = event.block.timestamp;
  metadataEvent.blockNumber = event.block.number;
  metadataEvent.tx = event.transaction.hash;
  metadataEvent.save();
}

/**
 * V2 handler: MetadataUpdated(indexed address slot, indexed address updatedBy, string uri)
 * Uses event.params.updatedBy instead of event.transaction.from for attribution.
 */
export function handleMetadataUpdatedV2(event: MetadataUpdatedV2): void {
  const slotId = event.params.slot.toHexString();
  const slot = Slot.load(slotId);
  if (slot == null) return;

  slot.updatedAt = event.block.timestamp;
  slot.save();

  const authorAddress: Address = event.params.updatedBy;
  const content = resolveInlineContent(event.params.uri);
  const adType: string | null = content ? extractAdType(content) : null;
  const cid = spawnIpfsContent(event.params.uri);

  // Upsert MetadataSlot (mutable — latest state)
  let metadataSlot = MetadataSlot.load(slotId);
  if (metadataSlot == null) {
    metadataSlot = new MetadataSlot(slotId);
    metadataSlot.slot = slotId;
    metadataSlot.updateCount = BigInt.fromI32(0);
    metadataSlot.createdAt = event.block.timestamp;
    metadataSlot.createdTx = event.transaction.hash;
  }
  metadataSlot.uri = event.params.uri;
  metadataSlot.cid = cid;
  metadataSlot.content = cid;
  metadataSlot.rawJson = content;
  metadataSlot.adType = adType;
  metadataSlot.updatedBy = authorAddress;
  metadataSlot.updateCount = metadataSlot.updateCount.plus(BigInt.fromI32(1));
  metadataSlot.updatedAt = event.block.timestamp;
  metadataSlot.updatedTx = event.transaction.hash;
  metadataSlot.save();

  // Track metadata update counts on Account & AccountSlot
  const author = getOrCreateAccount(authorAddress, true);
  author.metadataUpdateCount = author.metadataUpdateCount.plus(
    BigInt.fromI32(1),
  );
  author.save();

  const authorAS = getOrCreateAccountSlot(
    authorAddress,
    event.params.slot,
    event.block.timestamp,
  );
  authorAS.metadataUpdateCount = authorAS.metadataUpdateCount.plus(
    BigInt.fromI32(1),
  );
  authorAS.lastInteractedAt = event.block.timestamp;
  authorAS.save();

  // Create immutable history event
  const eventId =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  const metadataEvent = new MetadataUpdatedEvent(eventId);
  metadataEvent.slot = slotId;
  metadataEvent.author = author.id;
  metadataEvent.updatedBy = authorAddress;
  metadataEvent.uri = event.params.uri;
  metadataEvent.cid = cid;
  metadataEvent.content = cid;
  metadataEvent.rawJson = content;
  metadataEvent.adType = adType;
  metadataEvent.timestamp = event.block.timestamp;
  metadataEvent.blockNumber = event.block.number;
  metadataEvent.tx = event.transaction.hash;
  metadataEvent.save();
}
