import {
  Address,
  BigInt,
  DataSourceContext,
  ethereum,
  log,
} from "@graphprotocol/graph-ts";
import {
  AdminTransferred,
  ModuleVerified,
  SlotDeployed,
  SlotDeployed1,
} from "../generated/SlotFactory/SlotFactory";
import { Factory, Module, Slot, SlotDeployedEvent } from "../generated/schema";
import {
  FeedPostModule as FeedPostModuleTemplate,
  MetadataModule as MetadataModuleTemplate,
  Slot as SlotTemplate,
} from "../generated/templates";
import {
  getOrCreateAccount,
  getOrCreateCurrency,
  getOrCreateModule,
} from "./helpers";
import { spawnIpfsContent } from "./metadata";

function getOrCreateFactory(address: string): Factory {
  let factory = Factory.load(address);
  if (!factory) {
    factory = new Factory(address);
    factory.slotCount = BigInt.zero();
    factory.save();
  }
  return factory;
}

/**
 * Slots created before `SlotConfig.mutablePolicy` and
 * `SlotInitParams.occupancyPolicy` existed.
 *
 * Those additions changed the event's tuple types and therefore its topic0, so
 * this handler is the only thing that will ever see the 252 historical slots.
 * It fills the two new fields with what those slots actually have: no policy,
 * and occupancy that was never separately mutable.
 */
export function handleSlotDeployedLegacy(event: SlotDeployed): void {
  _record(
    event,
    event.params.slot,
    event.params.recipient,
    event.params.currency,
    event.params.config.mutableTax,
    // The legacy tuple predates the utility/module rename and is kept in the
    // ABI verbatim, so it still carries the old component names. Only the
    // current-signature handler below reads `mutableUtility`.
    event.params.config.mutableModule,
    false,
    event.params.config.manager,
    event.params.initParams.taxPercentage,
    event.params.initParams.module,
    event.params.initParams.liquidationBountyBps,
    event.params.initParams.minDepositSeconds,
    Address.zero()
  );
}

/** Slots created with the current tuple. */
export function handleSlotDeployed(event: SlotDeployed1): void {
  _record(
    event,
    event.params.slot,
    event.params.recipient,
    event.params.currency,
    event.params.config.mutableTax,
    event.params.config.mutableUtility,
    event.params.config.mutablePolicy,
    event.params.config.manager,
    event.params.initParams.taxPercentage,
    event.params.initParams.utility,
    event.params.initParams.liquidationBountyBps,
    event.params.initParams.minDepositSeconds,
    event.params.initParams.occupancyPolicy
  );
}

function _record(
  event: ethereum.Event,
  slotAddr: Address,
  recipientAddr: Address,
  currencyAddr: Address,
  mutableTax: boolean,
  mutableModule: boolean,
  mutablePolicy: boolean,
  manager: Address,
  taxPercentage: BigInt,
  moduleAddr: Address,
  liquidationBountyBps: BigInt,
  minDepositSeconds: BigInt,
  occupancyPolicy: Address
): void {
  const factory = getOrCreateFactory(event.address.toHexString());
  factory.slotCount = factory.slotCount.plus(BigInt.fromI32(1));
  factory.save();

  const slotAddress = slotAddr.toHexString();
  const slot = new Slot(slotAddress);

  const recipientAccount = getOrCreateAccount(recipientAddr);
  recipientAccount.slotCount += 1;
  recipientAccount.save();

  slot.recipient = recipientAddr;
  slot.recipientAccount = recipientAccount.id;
  slot.occupantAccount = null;
  const currency = getOrCreateCurrency(currencyAddr);
  slot.currency = currency.id;

  slot.mutableTax = mutableTax;
  slot.mutableModule = mutableModule;
  slot.mutablePolicy = mutablePolicy;
  slot.manager = manager;

  slot.taxPercentage = taxPercentage;
  if (!moduleAddr.equals(Address.zero())) {
    const mod = getOrCreateModule(moduleAddr, event.address.toHexString());
    slot.module = mod.id;
  }
  slot.liquidationBountyBps = liquidationBountyBps;
  slot.minDepositSeconds = minDepositSeconds;

  // State defaults
  slot.occupant = null;
  slot.isOccupied = false;
  slot.price = BigInt.zero();
  slot.deposit = BigInt.zero();
  slot.collectedTax = BigInt.zero();
  slot.taxPaidTotal = BigInt.zero();
  slot.totalCollected = BigInt.zero();

  // The policy now arrives in this event. Legacy slots pass address(0), which
  // is the truth for them: they were created before policies existed.
  slot.epochSeconds = BigInt.zero();
  slot.occupancyPolicy = occupancyPolicy.equals(Address.zero())
    ? null
    : occupancyPolicy;
  slot.occupiedSince = BigInt.zero();
  slot.pendingBuyer = null;
  slot.pendingEffectiveAt = null;
  slot.pendingPrice = null;
  slot.pendingDeposit = null;
  slot.pendingPolicy = null;
  slot.hasPendingPolicy = false;

  slot.createdAt = event.block.timestamp;
  slot.createdTx = event.transaction.hash;
  slot.updatedAt = event.block.timestamp;

  slot.save();

  // Record deploy event
  const evId =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  const ev = new SlotDeployedEvent(evId);
  ev.slot = slot.id;
  ev.recipient = recipientAddr;
  ev.currency = currency.id;
  ev.manager = manager;
  ev.mutableTax = mutableTax;
  ev.mutableModule = mutableModule;
  ev.mutablePolicy = mutablePolicy;
  ev.taxPercentage = taxPercentage;
  ev.module = moduleAddr;
  ev.liquidationBountyBps = liquidationBountyBps;
  ev.minDepositSeconds = minDepositSeconds;
  ev.deployer = event.transaction.from;
  ev.timestamp = event.block.timestamp;
  ev.blockNumber = event.block.number;
  ev.tx = event.transaction.hash;
  ev.save();

  // Start indexing events on this slot contract
  const context = new DataSourceContext();
  context.setString("factory", event.address.toHexString());
  SlotTemplate.createWithContext(slotAddr, context);

  // If the slot uses a module, start indexing MetadataUpdated events from it
  if (!moduleAddr.equals(Address.zero())) {
    MetadataModuleTemplate.create(moduleAddr);
    FeedPostModuleTemplate.create(moduleAddr);
  }
}

export function handleModuleVerified(event: ModuleVerified): void {
  const id = event.params.utility.toHexString();
  let module = Module.load(id);
  const wasVerified = module ? module.verified : false;
  if (!module) {
    module = new Module(id);
    module.factory = event.address.toHexString();
    module.totalFeesCollected = BigInt.zero();
  }
  module.verified = event.params.verified;
  module.name = event.params.name;
  module.version = event.params.version;
  module.feeBps = event.params.feeBps;

  const uri = event.params.moduleURI;
  module.moduleURI = uri;

  // Hand the CID to a file data source instead of fetching it here. This
  // handler no longer blocks on IPFS, and an unreachable file gets retried
  // rather than being recorded once as "this module has no image".
  //
  // The link is set immediately even though the row does not exist yet —
  // writing a reference is writing an id, and the entity appears under it when
  // the fetch lands.
  module.metadata = spawnIpfsContent(uri);

  module.save();

  // Start indexing MetadataUpdated events from newly verified MetadataModules
  if (
    event.params.verified &&
    !wasVerified &&
    (event.params.name == "MetadataModule" ||
      event.params.name == "AdLandModule")
  ) {
    log.info("Creating template for module {} at address {}", [
      event.params.name,
      event.params.utility.toHexString(),
    ]);
    MetadataModuleTemplate.create(event.params.utility);
  }

  // Also start indexing FeedPostModule instances
  if (
    event.params.verified &&
    !wasVerified &&
    event.params.name == "FeedPostModule"
  ) {
    log.info("Creating FeedPostModule template at address {}", [
      event.params.utility.toHexString(),
    ]);
    FeedPostModuleTemplate.create(event.params.utility);
  }
}

export function handleAdminTransferred(event: AdminTransferred): void {
  // No-op — admin not stored in schema
}
