import { type Context, ponder } from "ponder:registry";
import {
  account,
  adminTransferredEvent,
  beaconUpgradedEvent,
  factory,
  hook,
  hookAttestedEvent,
  slot,
  slotCreatedEvent,
} from "ponder:schema";
import {
  bumpAccountChain,
  evtId,
  getOrCreateAccount,
  getOrCreateCurrency,
  getOrCreateHook,
  hookFlagColumns,
  lower,
  NO_HOOK_FLAGS,
  readSlotTerms,
  ZERO_ADDR,
} from "./helpers";

/**
 * SlotFactory — the protocol's registry and its admin surface.
 *
 * Four events, all handled here. `Initialized(uint64)` and `Upgraded(address)`
 * are deliberately not: both come from OpenZeppelin's proxy plumbing rather
 * than from the protocol, `Initialized` collides by name with the Slot event of
 * the same name, and `BeaconUpgraded` — which IS handled — is the one that
 * matters, because it changes the code of every slot at once.
 */

/** Upsert the factory row. Any of its four events may be the first one seen. */
async function touchFactory(
  ctx: Context,
  id: `0x${string}`,
  values: {
    slotCount?: bigint;
    admin?: `0x${string}`;
    implementation?: `0x${string}`;
    implementationUpdatedAt?: bigint;
  },
) {
  await ctx.db
    .insert(factory)
    .values({
      id,
      chainId: ctx.chain.id,
      slotCount: values.slotCount ?? 0n,
      admin: values.admin ?? null,
      implementation: values.implementation ?? null,
      implementationUpdatedAt: values.implementationUpdatedAt ?? null,
    })
    .onConflictDoUpdate((row) => ({
      slotCount: row.slotCount + (values.slotCount ?? 0n),
      admin: values.admin ?? row.admin,
      implementation: values.implementation ?? row.implementation,
      implementationUpdatedAt:
        values.implementationUpdatedAt ?? row.implementationUpdatedAt,
    }));
}

/**
 * A new slot.
 *
 * `SlotCreated` carries slot, recipient, creator, currency and hook — and
 * nothing about the terms. Tax, the deposit floor, the two mutability flags and
 * the manager are read back from the slot with `readSlotTerms`, which is six
 * eth_calls at the creation block.
 *
 * That read is the one avoidable cost in this indexer. Putting the four scalars
 * in the event would remove it entirely, and they are all known at emit time —
 * `init` is right there in the call frame. See the report accompanying this
 * rewrite; nothing here can fix it from the indexer side, because a slot's
 * terms are simply not in any log.
 */
ponder.on("SlotFactory:SlotCreated", async ({ event, context }) => {
  const chainId = context.chain.id;
  const factoryId = lower(event.log.address);
  const slotId = lower(event.args.slot);
  const hookAddr = lower(event.args.hook);
  const hasHook = hookAddr !== ZERO_ADDR;

  await touchFactory(context, factoryId, { slotCount: 1n });

  const cur = await getOrCreateCurrency(context, event.args.currency);

  // The recipient's total and per-chain counts move together; the pair is only
  // meaningful while it agrees.
  const recipient = await getOrCreateAccount(context, event.args.recipient);
  await context.db
    .update(account, { id: recipient.id })
    .set((row) => ({ slotCount: row.slotCount + 1 }));
  await bumpAccountChain(context, event.args.recipient, chainId, {
    slotCount: 1,
  });

  // `creator` is `msg.sender` of `createSlot`, which is not necessarily
  // `tx.from` — a collective or a router creates slots on someone's behalf.
  await getOrCreateAccount(
    context,
    event.args.creator,
    lower(event.args.creator) === lower(event.transaction.from),
  );

  const terms = await readSlotTerms(context, slotId);

  if (hasHook) {
    await getOrCreateHook(context, hookAddr, event.block.timestamp);
    await context.db
      .update(hook, { id: hookAddr, chainId })
      .set((row) => ({
        slotCount: row.slotCount + 1,
        updatedAt: event.block.timestamp,
      }));
  }

  await context.db.insert(slot).values({
    id: slotId,
    chainId,
    factory: factoryId,
    recipient: lower(event.args.recipient),
    recipientAccount: recipient.id,
    currency: cur.id,
    manager: terms.manager,
    creator: lower(event.args.creator),
    taxPercentage: terms.taxPercentage,
    minDepositSeconds: terms.minDepositSeconds,
    mutableTax: terms.mutableTax,
    mutableHook: terms.mutableHook,
    hook: hasHook ? hookAddr : null,
    hookData: hasHook ? terms.hookData : null,
    ...hookFlagColumns(hasHook ? terms.flags : NO_HOOK_FLAGS),
    occupant: null,
    occupantAccount: null,
    isOccupied: false,
    occupiedSince: 0n,
    // The chain's counter starts at zero and reaches 1 on the first seating,
    // so "no tenure has ever happened here" is representable.
    tenureId: 0n,
    price: 0n,
    deposit: 0n,
    collectedTax: 0n,
    taxPaidTotal: 0n,
    totalCollected: 0n,
    creditedTotal: 0n,
    pendingHasTax: false,
    pendingTaxPercentage: null,
    pendingHasHook: false,
    pendingHook: null,
    pendingHookData: null,
    pendingProposedAt: null,
    createdAt: event.block.timestamp,
    createdTx: event.transaction.hash,
    updatedAt: event.block.timestamp,
    feed: null,
  });

  await context.db.insert(slotCreatedEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId,
    factory: factoryId,
    slot: slotId,
    recipient: lower(event.args.recipient),
    creator: lower(event.args.creator),
    currency: cur.id,
    hook: hookAddr,
    hookData: terms.hookData,
    taxPercentage: terms.taxPercentage,
    minDepositSeconds: terms.minDepositSeconds,
    mutableTax: terms.mutableTax,
    mutableHook: terms.mutableHook,
    manager: terms.manager,
    deployer: lower(event.transaction.from),
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

/**
 * The admin's opinion about a hook.
 *
 * Advisory and nothing more — any hook with code may be attached to any slot
 * whether or not it appears here. Indexed so a client can surface the opinion,
 * and so an attestation being REVOKED on a hook that slots already point at is
 * visible; nothing on chain detaches it.
 */
ponder.on("SlotFactory:HookAttested", async ({ event, context }) => {
  const chainId = context.chain.id;
  const factoryId = lower(event.log.address);
  const hookAddr = lower(event.args.hook);

  await touchFactory(context, factoryId, {});
  await getOrCreateHook(context, hookAddr, event.block.timestamp);
  await context.db.update(hook, { id: hookAddr, chainId }).set({
    attested: event.args.attested,
    attestedAt: event.args.attested ? event.block.timestamp : null,
    updatedAt: event.block.timestamp,
  });

  await context.db.insert(hookAttestedEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId,
    factory: factoryId,
    hook: hookAddr,
    attested: event.args.attested,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

/**
 * The key that can replace every slot's code changed hands.
 *
 * Also fires once from `initialize`, with `from` at the zero address.
 */
ponder.on("SlotFactory:AdminTransferred", async ({ event, context }) => {
  const factoryId = lower(event.log.address);
  const next = lower(event.args.to);

  await touchFactory(context, factoryId, { admin: next });
  await getOrCreateAccount(context, next);

  await context.db.insert(adminTransferredEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId: context.chain.id,
    factory: factoryId,
    previousAdmin: lower(event.args.from),
    newAdmin: next,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

/** Every slot on this chain now runs different code. */
ponder.on("SlotFactory:BeaconUpgraded", async ({ event, context }) => {
  const factoryId = lower(event.log.address);
  const impl = lower(event.args.implementation);

  await touchFactory(context, factoryId, {
    implementation: impl,
    implementationUpdatedAt: event.block.timestamp,
  });

  await context.db.insert(beaconUpgradedEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId: context.chain.id,
    factory: factoryId,
    implementation: impl,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});
