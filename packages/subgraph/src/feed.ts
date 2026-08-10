import { Address, BigInt, JSONValueKind, json } from "@graphprotocol/graph-ts";
import {
  Feed,
  FeedMetadataURIUpdatedEvent,
  FeedNameUpdatedEvent,
  FeedRecipientUpdatedEvent,
  FeedSlotAddedEvent,
  FeedSlotRemovedEvent,
  Slot,
} from "../generated/schema";
import {
  MetadataURIUpdated,
  NameUpdated,
  RecipientUpdated,
  SlotAdded,
  SlotRemoved,
} from "../generated/templates/Feed/Feed";
import { getOrCreateAccount, getOrCreateCurrency } from "./helpers";
import { extractCid, resolveContent } from "./metadata";

/**
 * Resolve a Feed's `metadataURI` JSON and populate its metadata fields.
 * Reuses metadata.ts's resolveContent/extractCid idiom (inline JSON vs
 * bare-CID vs ipfs:// → ipfs.cat), then pulls name/description/image/
 * banner/externalLink off the parsed object.
 * If metadataURI is empty or unresolvable, metadata fields stay null and
 * displayName falls back to onchainName.
 */
export function applyFeedMetadata(feed: Feed, metadataURI: string): void {
  feed.metadataName = null;
  feed.description = null;
  feed.image = null;
  feed.banner = null;
  feed.externalLink = null;
  feed.metadataRaw = null;
  feed.metadataCid = null;

  if (metadataURI.length > 0) {
    feed.metadataCid = extractCid(metadataURI);
    const content = resolveContent(metadataURI);
    if (content) {
      feed.metadataRaw = content;
      const result = json.try_fromString(content);
      if (!result.isError) {
        const obj = result.value.toObject();

        const name = obj.get("name");
        if (name && !name.isNull() && name.kind == JSONValueKind.STRING) {
          feed.metadataName = name.toString();
        }

        const description = obj.get("description");
        if (
          description &&
          !description.isNull() &&
          description.kind == JSONValueKind.STRING
        ) {
          feed.description = description.toString();
        }

        const image = obj.get("image");
        if (image && !image.isNull() && image.kind == JSONValueKind.STRING) {
          feed.image = image.toString();
        }

        const banner = obj.get("banner");
        if (banner && !banner.isNull() && banner.kind == JSONValueKind.STRING) {
          feed.banner = banner.toString();
        }

        const externalLink = obj.get("externalLink");
        if (
          externalLink &&
          !externalLink.isNull() &&
          externalLink.kind == JSONValueKind.STRING
        ) {
          feed.externalLink = externalLink.toString();
        }
      }
    }
  }

  feed.displayName = feed.metadataName
    ? (feed.metadataName as string)
    : feed.onchainName;
}

export function handleNameUpdated(event: NameUpdated): void {
  const feed = Feed.load(event.address.toHexString());
  if (feed == null) return;

  feed.onchainName = event.params.name;
  feed.displayName = feed.metadataName
    ? (feed.metadataName as string)
    : feed.onchainName;
  feed.updatedAt = event.block.timestamp;
  feed.save();

  const evId =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  const ev = new FeedNameUpdatedEvent(evId);
  ev.feed = feed.id;
  ev.name = event.params.name;
  ev.blockNumber = event.block.number;
  ev.blockTimestamp = event.block.timestamp;
  ev.transactionHash = event.transaction.hash;
  ev.save();
}

export function handleMetadataURIUpdated(event: MetadataURIUpdated): void {
  const feed = Feed.load(event.address.toHexString());
  if (feed == null) return;

  feed.metadataURI = event.params.uri;
  applyFeedMetadata(feed, event.params.uri);
  feed.updatedAt = event.block.timestamp;
  feed.save();

  const evId =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  const ev = new FeedMetadataURIUpdatedEvent(evId);
  ev.feed = feed.id;
  ev.uri = event.params.uri;
  ev.blockNumber = event.block.number;
  ev.blockTimestamp = event.block.timestamp;
  ev.transactionHash = event.transaction.hash;
  ev.save();
}

export function handleRecipientUpdated(event: RecipientUpdated): void {
  const feed = Feed.load(event.address.toHexString());
  if (feed == null) return;

  feed.recipient = event.params.recipient;
  feed.updatedAt = event.block.timestamp;
  feed.save();

  const evId =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  const ev = new FeedRecipientUpdatedEvent(evId);
  ev.feed = feed.id;
  ev.recipient = event.params.recipient;
  ev.blockNumber = event.block.number;
  ev.blockTimestamp = event.block.timestamp;
  ev.transactionHash = event.transaction.hash;
  ev.save();
}

export function handleSlotAdded(event: SlotAdded): void {
  const feed = Feed.load(event.address.toHexString());
  if (feed == null) return;

  const slotId = event.params.slot.toHexString();
  let slot = Slot.load(slotId);
  if (slot == null) {
    // Normally the Slot is already created by handleSlotDeployed (factory.ts)
    // earlier in the same transaction (lower log index). If it's somehow
    // missing, create a minimal placeholder with zero-value defaults so
    // required fields are satisfied; handleSlotDeployed running later would
    // overwrite these with real values.
    slot = new Slot(slotId);
    const zeroAccount = getOrCreateAccount(Address.zero());
    const zeroCurrency = getOrCreateCurrency(Address.zero());
    slot.recipient = Address.zero();
    slot.recipientAccount = zeroAccount.id;
    slot.currency = zeroCurrency.id;
    slot.mutableTax = false;
    slot.mutableModule = false;
    slot.manager = Address.zero();
    slot.taxPercentage = BigInt.zero();
    slot.liquidationBountyBps = BigInt.zero();
    slot.minDepositSeconds = BigInt.zero();
    slot.occupant = null;
    slot.occupantAccount = null;
    slot.isOccupied = false;
    slot.price = BigInt.zero();
    slot.deposit = BigInt.zero();
    slot.collectedTax = BigInt.zero();
  slot.taxPaidTotal = BigInt.zero();
    slot.totalCollected = BigInt.zero();
    slot.createdAt = event.block.timestamp;
    slot.createdTx = event.transaction.hash;
    slot.updatedAt = event.block.timestamp;
  }
  slot.feed = feed.id;
  slot.updatedAt = event.block.timestamp;
  slot.save();

  feed.slotCount = feed.slotCount.plus(BigInt.fromI32(1));
  feed.updatedAt = event.block.timestamp;
  feed.save();

  const evId =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  const ev = new FeedSlotAddedEvent(evId);
  ev.feed = feed.id;
  ev.slot = event.params.slot;
  ev.blockNumber = event.block.number;
  ev.blockTimestamp = event.block.timestamp;
  ev.transactionHash = event.transaction.hash;
  ev.save();
}

export function handleSlotRemoved(event: SlotRemoved): void {
  const feed = Feed.load(event.address.toHexString());
  if (feed == null) return;

  const slot = Slot.load(event.params.slot.toHexString());
  if (slot != null) {
    slot.feed = null;
    slot.updatedAt = event.block.timestamp;
    slot.save();
  }

  if (feed.slotCount.gt(BigInt.zero())) {
    feed.slotCount = feed.slotCount.minus(BigInt.fromI32(1));
  }
  feed.updatedAt = event.block.timestamp;
  feed.save();

  const evId =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  const ev = new FeedSlotRemovedEvent(evId);
  ev.feed = feed.id;
  ev.slot = event.params.slot;
  ev.blockNumber = event.block.number;
  ev.blockTimestamp = event.block.timestamp;
  ev.transactionHash = event.transaction.hash;
  ev.save();
}
