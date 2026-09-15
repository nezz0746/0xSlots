import { ponder } from "ponder:registry";
import { wrappedToken, wrapper } from "ponder:schema";
import { zeroAddress } from "viem";

import { getOrCreateAccount, lower } from "./helpers";

/**
 * Wrappers, and the NFTs people have put under common ownership through them.
 *
 * Two sources, as with collections: the factory's `WrapperCreated`, and every
 * wrapper it has made — discovered through ponder's `factory()` filter, so a
 * wrapper needs no configuration to be indexed.
 *
 * Ownership comes from the wrapper's own `Transfer`, never derived from the
 * slot. That contract keeps real ERC-721 storage precisely so an indexer does
 * not have to: the token moves in the same transaction as the seating, and the
 * event is the ordinary one every ERC-721 reader already understands.
 */

const TOKEN_ID = (chainId: number, wrap: string, tokenId: bigint) =>
  `${chainId}:${wrap}:${tokenId}`;

/**
 * A wrapper was deployed.
 *
 * Every column comes out of the event. Unlike `CollectionCreated` there is
 * nothing to read back off the contract, because a wrapper fixes nothing
 * beyond its name — terms belong to each wrap.
 */
ponder.on("SlotBoundNFTFactory:WrapperCreated", async ({ event, context }) => {
  await getOrCreateAccount(context, event.args.creator);

  await context.db.insert(wrapper).values({
    id: lower(event.args.wrapper),
    chainId: context.chain.id,
    factory: lower(event.log.address),
    creator: lower(event.args.creator),
    name: event.args.name,
    symbol: event.args.symbol,
    totalWrapped: 0,
    owner: lower(event.args.owner),
    wrapFeeWei: event.args.wrapFeeWei,
    createdAt: event.block.timestamp,
    updatedAt: event.block.timestamp,
  });
});

/**
 * An NFT went in.
 *
 * `owner` starts at the wrapper because that is what the contract does: it
 * mints to itself and only then seats the depositor, whose `Transfer` lands
 * later in the same transaction and is handled below.
 */
ponder.on("SlotBoundNFTWrapper:Wrapped", async ({ event, context }) => {
  const chainId = context.chain.id;
  const wrap = lower(event.log.address);

  await getOrCreateAccount(context, event.args.depositor);

  await context.db.insert(wrappedToken).values({
    id: TOKEN_ID(chainId, wrap, event.args.tokenId),
    chainId,
    wrapper: wrap,
    tokenId: event.args.tokenId,
    slot: lower(event.args.slot),
    owner: wrap,
    depositor: lower(event.args.depositor),
    underlying: lower(event.args.underlying),
    underlyingId: event.args.underlyingId,
    mode: event.args.mode,
    taxBps: event.args.taxBps,
    fee: event.args.fee,
    retired: false,
    retiredAt: null,
    wrappedAt: event.block.timestamp,
    updatedAt: event.block.timestamp,
  });

  await context.db
    .update(wrapper, { id: wrap, chainId })
    .set((row) => ({
      totalWrapped: row.totalWrapped + 1,
      updatedAt: event.block.timestamp,
    }));
});

/**
 * The owner re-priced future wraps.
 *
 * This moves the wrapper's CURRENT fee only. What each existing token paid is
 * its own `fee`, written when it was wrapped and never revised — a fee change
 * cannot reach someone already in.
 */
ponder.on("SlotBoundNFTWrapper:WrapFeeSet", async ({ event, context }) => {
  await context.db
    .update(wrapper, {
      id: lower(event.log.address),
      chainId: context.chain.id,
    })
    .set({ wrapFeeWei: event.args.fee, updatedAt: event.block.timestamp });
});

ponder.on("SlotBoundNFTWrapper:OwnershipTransferred", async ({ event, context }) => {
  // The initializer emits this too, from the zero address, before the factory's
  // own `WrapperCreated` has inserted the row. Nothing to update yet, and
  // `WrapperCreated` carries the same owner.
  const id = lower(event.log.address);
  const existing = await context.db.find(wrapper, { id, chainId: context.chain.id });
  if (!existing) return;

  if (event.args.to !== zeroAddress) {
    await getOrCreateAccount(context, event.args.to);
  }
  await context.db
    .update(wrapper, { id, chainId: context.chain.id })
    .set({ owner: lower(event.args.to), updatedAt: event.block.timestamp });
});

/**
 * The token followed its slot.
 *
 * Transfers between accounts cannot happen — the token is soulbound to
 * occupancy — so every one of these is either the mint, an occupancy change,
 * or the retirement burn.
 *
 * The mint's own `Transfer` is emitted BEFORE `Wrapped` (the contract mints,
 * then emits), so it arrives here with no row to update. Skipping is right:
 * `Wrapped` is the log that knows the slot, and it inserts with the same owner
 * this transfer would have set.
 */
ponder.on("SlotBoundNFTWrapper:Transfer", async ({ event, context }) => {
  const chainId = context.chain.id;
  const wrap = lower(event.log.address);
  const id = TOKEN_ID(chainId, wrap, event.args.tokenId);

  const existing = await context.db.find(wrappedToken, { id });
  if (!existing) return;

  // The retirement burn sends it to the zero address, which is not an account.
  if (event.args.to !== zeroAddress) {
    await getOrCreateAccount(context, event.args.to);
  }

  await context.db.update(wrappedToken, { id }).set({
    owner: lower(event.args.to),
    updatedAt: event.block.timestamp,
  });
});

/**
 * The underlying went home, and the slot behind it is dead.
 *
 * Lands after the burn's `Transfer` above — the contract burns before it
 * emits — so `owner` is already the zero address by the time this runs. This
 * adds the reason.
 */
ponder.on("SlotBoundNFTWrapper:Withdrawn", async ({ event, context }) => {
  const id = TOKEN_ID(
    context.chain.id,
    lower(event.log.address),
    event.args.tokenId,
  );

  await context.db.update(wrappedToken, { id }).set({
    retired: true,
    retiredAt: event.block.timestamp,
    updatedAt: event.block.timestamp,
  });
});
