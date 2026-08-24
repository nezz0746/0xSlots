import { ponder } from "ponder:registry";
import {
  dataService,
  slotDataClearedEvent,
  slotDataRecord,
  slotDataTenancy,
  slotDataWroteEvent,
} from "ponder:schema";
import type { Hex } from "viem";
import { evtId, lower } from "./helpers";

/**
 * SlotData — services, payloads, and the generation that decides which are live.
 *
 * Every id here is scoped by the MODULE as well as the chain. Registration is
 * permissionless and service ids are per-deployment sequences, so a second
 * SlotData would start again at 1 and collide with the first on any key that
 * left the address out. Nothing stops a second deployment existing — the
 * indexer derives its watched addresses from `ModuleVerified`, so one appears
 * the moment the factory verifies it.
 */

const serviceKey = (chainId: number, module: Hex, serviceId: bigint) =>
  `${chainId}-${module}-${serviceId}`;

const tenancyKey = (chainId: number, module: Hex, slotAddr: Hex) =>
  `${chainId}-${module}-${slotAddr}`;

ponder.on("SlotData:ServiceRegistered", async ({ event, context }) => {
  const chainId = context.chain.id;
  const module = lower(event.log.address);
  const serviceId = event.args.id;

  await context.db
    .insert(dataService)
    .values({
      id: serviceKey(chainId, module, serviceId),
      chainId,
      module,
      serviceId,
      schema: event.args.schema,
      name: event.args.name,
      registrar: lower(event.args.registrar),
      metadataURI: event.args.metadataURI,
      writeCount: 0n,
      createdAt: event.block.timestamp,
      createdTx: event.transaction.hash,
    })
    // Ids are `++serviceCount` and can never repeat, so a conflict means a
    // reindex of a block already seen rather than a second registration.
    // Ignoring it keeps `writeCount` — replaying the insert with 0 would
    // reset a counter the writes below have already moved.
    .onConflictDoNothing();
});

ponder.on("SlotData:Wrote", async ({ event, context }) => {
  const chainId = context.chain.id;
  const module = lower(event.log.address);
  const slotAddr = lower(event.args.slot);
  const { serviceId, generation } = event.args;
  const writer = lower(event.args.writer);
  const service = serviceKey(chainId, module, serviceId);
  const tenancy = tenancyKey(chainId, module, slotAddr);

  /*
   * The tenancy row is created HERE as well as on `Cleared`, and it has to be.
   *
   * A slot's first write happens under generation 0, and nothing has cleared it
   * yet — so the row would not exist, and every record pointing at it would
   * resolve `tenancyRef` to null. A client comparing generations to decide what
   * is live would then see no answer at all for exactly the slots that have
   * only ever had one tenant, which is most of them.
   *
   * `onConflictDoNothing`, never an update: `Cleared` may already have moved
   * this slot past `generation`, and a late write under an old generation must
   * not drag the tenancy backwards. It cannot happen in block order, but the
   * cost of saying so is one clause.
   */
  await context.db
    .insert(slotDataTenancy)
    .values({
      id: tenancy,
      chainId,
      module,
      slot: slotAddr,
      generation,
      clearedAt: null,
      clearedTx: null,
    })
    .onConflictDoNothing();

  await context.db
    .insert(slotDataRecord)
    .values({
      id: `${tenancy}-${generation}-${serviceId}`,
      chainId,
      module,
      slot: slotAddr,
      generation,
      serviceId,
      service,
      tenancy,
      data: event.args.data,
      writer,
      writeCount: 1n,
      createdAt: event.block.timestamp,
      createdTx: event.transaction.hash,
      updatedAt: event.block.timestamp,
      updatedTx: event.transaction.hash,
    })
    // An overwrite within the same tenancy — the contract just assigns over the
    // old bytes, so the row moves rather than a second one appearing.
    .onConflictDoUpdate((row) => ({
      data: event.args.data,
      writer,
      writeCount: row.writeCount + 1n,
      updatedAt: event.block.timestamp,
      updatedTx: event.transaction.hash,
    }));

  /*
   * Counted only when the service is known.
   *
   * `_write` reverts on an unregistered id, so in practice it always is — but
   * the indexer can be started from a block after a registration it therefore
   * never saw, and an update against a missing row throws rather than skipping.
   * Reading first turns "started too late" into a counter that is low, which is
   * a far better failure than an indexer that will not run.
   */
  const existing = await context.db.find(dataService, { id: service });
  if (existing) {
    await context.db.update(dataService, { id: service }).set((row) => ({
      writeCount: row.writeCount + 1n,
    }));
  }

  await context.db.insert(slotDataWroteEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId,
    module,
    slot: slotAddr,
    serviceId,
    service,
    writer,
    generation,
    data: event.args.data,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

ponder.on("SlotData:Cleared", async ({ event, context }) => {
  const chainId = context.chain.id;
  const module = lower(event.log.address);
  const slotAddr = lower(event.args.slot);
  const { generation } = event.args;

  // Nothing is deleted. The records of the tenancy that just ended stay exactly
  // where they are — they are still what that tenant published, and the logs
  // hold them forever regardless. Moving this number is the whole of what
  // "cleared" means, on chain and here.
  await context.db
    .insert(slotDataTenancy)
    .values({
      id: tenancyKey(chainId, module, slotAddr),
      chainId,
      module,
      slot: slotAddr,
      generation,
      clearedAt: event.block.timestamp,
      clearedTx: event.transaction.hash,
    })
    .onConflictDoUpdate(() => ({
      generation,
      clearedAt: event.block.timestamp,
      clearedTx: event.transaction.hash,
    }));

  await context.db.insert(slotDataClearedEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId,
    module,
    slot: slotAddr,
    generation,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});
