import { ponder } from "ponder:registry";
import { collection, collectionToken } from "ponder:schema";

import { getOrCreateAccount, getOrCreateCurrency, lower } from "./helpers";

/**
 * Slot-bound NFT collections, and the tokens that follow their slots.
 *
 * Two sources: the factory's `CollectionCreated`, and every collection it has
 * made — discovered through ponder's `factory()` filter, so a collection needs
 * no configuration to be indexed.
 *
 * Ownership is read from the collection's own `Transfer`, not derived from the
 * slot. The whole reason that contract keeps real ERC-721 storage is so an
 * indexer never has to: the token moves in the same transaction as the seating,
 * and the event is the ordinary one every ERC-721 reader already understands.
 */

const TOKEN_ID = (chainId: number, coll: string, tokenId: bigint) =>
  `${chainId}:${coll}:${tokenId}`;

ponder.on("SlotBoundNFTFactory:CollectionCreated", async ({ event, context }) => {
  const chainId = context.chain.id;
  const id = lower(event.args.collection);

  await getOrCreateAccount(context, event.args.creator);
  await getOrCreateAccount(context, event.args.recipient);
  await getOrCreateCurrency(context, event.args.currency);

  // The terms are not in the event — it carries only what a listing needs.
  // Read the rest off the collection, which is deployed by the time this log
  // exists and holds them immutably.
  let terms: {
    name: string | null;
    symbol: string | null;
    taxBps: bigint | null;
    minDepositSeconds: bigint | null;
    manager: `0x${string}` | null;
    owner: `0x${string}` | null;
  } = {
    name: null,
    symbol: null,
    taxBps: null,
    minDepositSeconds: null,
    manager: null,
    owner: null,
  };

  try {
    const [name, symbol, t, owner] = await Promise.all([
      context.client.readContract({
        abi: context.contracts.SlotBoundNFT.abi,
        address: id,
        functionName: "name",
      }),
      context.client.readContract({
        abi: context.contracts.SlotBoundNFT.abi,
        address: id,
        functionName: "symbol",
      }),
      context.client.readContract({
        abi: context.contracts.SlotBoundNFT.abi,
        address: id,
        functionName: "terms",
      }),
      context.client.readContract({
        abi: context.contracts.SlotBoundNFT.abi,
        address: id,
        functionName: "owner",
      }),
    ]);
    terms = {
      name,
      symbol,
      taxBps: t.taxBps,
      minDepositSeconds: t.minDepositSeconds,
      manager: lower(t.manager),
      owner: lower(owner),
    };
  } catch {
    // A collection that will not answer is still worth a row: the factory's
    // log is the fact, and the reads are decoration on it.
  }

  await context.db.insert(collection).values({
    id,
    chainId,
    factory: lower(event.log.address),
    creator: lower(event.args.creator),
    name: terms.name,
    symbol: terms.symbol,
    maxSupply: event.args.maxSupply,
    totalMinted: 0,
    currency: lower(event.args.currency),
    recipient: lower(event.args.recipient),
    taxBps: terms.taxBps,
    minDepositSeconds: terms.minDepositSeconds,
    manager: terms.manager,
    owner: terms.owner,
    baseURI: null,
    createdAt: event.block.timestamp,
    updatedAt: event.block.timestamp,
  });
});

ponder.on("SlotBoundNFT:SlotMinted", async ({ event, context }) => {
  const chainId = context.chain.id;
  const coll = lower(event.log.address);

  await getOrCreateAccount(context, event.args.creator);

  await context.db.insert(collectionToken).values({
    id: TOKEN_ID(chainId, coll, event.args.tokenId),
    chainId,
    collection: coll,
    tokenId: event.args.tokenId,
    slot: lower(event.args.slot),
    // The mint seats the minter, but `Transfer` lands separately and is what
    // moves this. Starting at the collection matches the contract, which mints
    // to itself before seating.
    owner: coll,
    minter: lower(event.args.creator),
    mintedAt: event.block.timestamp,
    updatedAt: event.block.timestamp,
  });

  await context.db
    .update(collection, { id: coll, chainId })
    .set((row) => ({
      totalMinted: row.totalMinted + 1,
      updatedAt: event.block.timestamp,
    }));
});

/**
 * The token followed its slot.
 *
 * Covers the mint (`from` is the zero address) and every occupancy change
 * after it. Transfers between accounts cannot happen — the collection is
 * soulbound — so every one of these is the slot moving.
 */
ponder.on("SlotBoundNFT:Transfer", async ({ event, context }) => {
  const chainId = context.chain.id;
  const coll = lower(event.log.address);
  const id = TOKEN_ID(chainId, coll, event.args.tokenId);

  await getOrCreateAccount(context, event.args.to);

  // `SlotMinted` and the mint's own `Transfer` are two logs in one
  // transaction, in that order — but only for the mint. A row that is not
  // there yet is a `Transfer` arriving before its `SlotMinted`, which cannot
  // happen, so this is a no-op rather than an insert with a slot it cannot know.
  const existing = await context.db.find(collectionToken, { id });
  if (!existing) return;

  await context.db.update(collectionToken, { id }).set({
    owner: lower(event.args.to),
    updatedAt: event.block.timestamp,
  });
});

ponder.on("SlotBoundNFT:BaseURISet", async ({ event, context }) => {
  await context.db
    .update(collection, {
      id: lower(event.log.address),
      chainId: context.chain.id,
    })
    .set({ baseURI: event.args.uri, updatedAt: event.block.timestamp });
});
