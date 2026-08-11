import { ponder } from "ponder:registry";
import {
  account,
  factory,
  module,
  slot,
  slotDeployedEvent,
} from "ponder:schema";
import {
  evtId,
  getOrCreateAccount,
  getOrCreateCurrency,
  getOrCreateModule,
  lower,
  tryFetchIpfsJson,
  ZERO_ADDR,
} from "./helpers";

ponder.on("SlotFactory:SlotDeployed", async ({ event, context }) => {
  const chainId = context.chain.id;
  const factoryId = lower(event.log.address);
  const slotId = lower(event.args.slot);
  const moduleAddr = lower(event.args.initParams.utility);

  // Factory: bump slot count
  await context.db
    .insert(factory)
    .values({ id: factoryId, chainId, slotCount: 1n })
    .onConflictDoUpdate((row) => ({ slotCount: row.slotCount + 1n }));

  // Currency
  const cur = await getOrCreateCurrency(context, event.args.currency);

  // Recipient account
  const recipient = await getOrCreateAccount(context, event.args.recipient);
  await context.db
    .update(account, { id: recipient.id })
    .set((row) => ({ slotCount: row.slotCount + 1 }));

  // Optional module
  if (moduleAddr !== ZERO_ADDR) {
    await getOrCreateModule(context, moduleAddr, factoryId, chainId);
  }

  // Slot
  await context.db.insert(slot).values({
    id: slotId,
    chainId,
    recipient: lower(event.args.recipient),
    recipientAccount: recipient.id,
    currency: cur.id,
    mutableTax: event.args.config.mutableTax,
    mutableModule: event.args.config.mutableUtility,
    manager: lower(event.args.config.manager),
    taxPercentage: event.args.initParams.taxPercentage,
    module: moduleAddr === ZERO_ADDR ? null : moduleAddr,
    liquidationBountyBps: event.args.initParams.liquidationBountyBps,
    minDepositSeconds: event.args.initParams.minDepositSeconds,
    occupant: null,
    occupantAccount: null,
    price: 0n,
    deposit: 0n,
    collectedTax: 0n,
    totalCollected: 0n,
    createdAt: event.block.timestamp,
    createdTx: event.transaction.hash,
    updatedAt: event.block.timestamp,
    factory: factoryId,
  });

  // Immutable deploy event
  await context.db.insert(slotDeployedEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    chainId,
    slot: slotId,
    recipient: lower(event.args.recipient),
    currency: cur.id,
    manager: lower(event.args.config.manager),
    mutableTax: event.args.config.mutableTax,
    mutableModule: event.args.config.mutableUtility,
    taxPercentage: event.args.initParams.taxPercentage,
    module: moduleAddr,
    liquidationBountyBps: event.args.initParams.liquidationBountyBps,
    minDepositSeconds: event.args.initParams.minDepositSeconds,
    deployer: lower(event.transaction.from),
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

ponder.on("SlotFactory:ModuleVerified", async ({ event, context }) => {
  const chainId = context.chain.id;
  const factoryId = lower(event.log.address);
  const id = lower(event.args.utility);

  const existing = await context.db.find(module, { id });

  // Optional IPFS metadata fetch
  let image: string | null = null;
  let description: string | null = null;
  const uri = event.args.moduleURI;
  if (uri && uri.length > 0) {
    const json = await tryFetchIpfsJson(uri);
    if (json) {
      try {
        const obj = JSON.parse(json);
        if (typeof obj?.image === "string") image = obj.image;
        if (typeof obj?.description === "string") description = obj.description;
      } catch {
        // swallow
      }
    }
  }

  if (!existing) {
    await context.db.insert(module).values({
      id,
      chainId,
      factory: factoryId,
      verified: event.args.verified,
      name: event.args.name,
      version: event.args.version,
      feeBps: event.args.feeBps,
      moduleURI: uri ?? null,
      image,
      description,
      totalFeesCollected: 0n,
    });
  } else {
    await context.db.update(module, { id }).set({
      verified: event.args.verified,
      name: event.args.name,
      version: event.args.version,
      feeBps: event.args.feeBps,
      moduleURI: uri ?? null,
      image,
      description,
    });
  }
});

ponder.on("SlotFactory:AdminTransferred", async () => {
  // No-op: admin not stored in schema
});
