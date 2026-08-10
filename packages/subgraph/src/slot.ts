import {
  Address,
  BigInt,
  Bytes,
  dataSource,
} from "@graphprotocol/graph-ts";
import {
  BoughtEvent,
  DepositedEvent,
  LiquidatedEvent,
  Module,
  ModuleFeePaidEvent,
  ModuleUpdateProposedEvent,
  OperatorSetEvent,
  PendingUpdateCancelledEvent,
  PolicyUpdateAppliedEvent,
  PolicyUpdateProposedEvent,
  PriceUpdatedEvent,
  RefundClaimedEvent,
  RefundCreditedEvent,
  ReleasedEvent,
  SettledEvent,
  Slot,
  TaxPaidEvent,
  SlotOperator,
  SlotRefund,
  TaxCollectedEvent,
  TaxUpdateProposedEvent,
  TransferScheduledEvent,
  WithdrawnEvent,
} from "../generated/schema";
import {
  Bought,
  Deposited,
  Liquidated,
  LiquidationBountyUpdated,
  ModuleFeePaid,
  ModuleUpdateProposed,
  OperatorSet,
  PendingUpdateApplied,
  PendingUpdateCancelled,
  PolicyUpdateApplied,
  PolicyUpdateProposed,
  PriceUpdated,
  RefundClaimed,
  RefundCredited,
  Released,
  Settled,
  TaxPaid,
  SlotConfiguredV3,
  TaxCollected,
  TaxUpdateProposed,
  TransferScheduled,
  Withdrawn,
} from "../generated/templates/Slot/Slot";
import {
  getOrCreateAccount,
  getOrCreateAccountSlot,
  getOrCreateModule,
} from "./helpers";

function evtId(txHash: Bytes, logIndex: BigInt): string {
  return txHash.toHexString() + "-" + logIndex.toString();
}

function getSlot(address: Address): Slot {
  return Slot.load(address.toHexString()) as Slot;
}

export function handleBought(event: Bought): void {
  const slot = getSlot(event.address);

  // Decrement previous occupant count & finalize hold time
  const zeroAddr = Address.zero();
  if (
    slot.occupant !== null &&
    Address.fromBytes(slot.occupant as Bytes) != zeroAddr
  ) {
    const prevAddr = Address.fromBytes(slot.occupant as Bytes);
    const prevAccount = getOrCreateAccount(prevAddr);
    prevAccount.occupiedCount -= 1;

    const prevAS = getOrCreateAccountSlot(
      prevAddr,
      event.address,
      event.block.timestamp,
    );
    if (prevAS.lastOccupiedAt !== null) {
      const held = event.block.timestamp.minus(prevAS.lastOccupiedAt as BigInt);
      prevAS.holdTime = prevAS.holdTime.plus(held);
      prevAccount.totalHoldTime = prevAccount.totalHoldTime.plus(held);
    }
    prevAS.lastOccupiedAt = null;
    prevAS.lastInteractedAt = event.block.timestamp;
    prevAS.save();
    prevAccount.save();
  }

  // Set new occupant. NOTE: `buyer` is the `account` argument to buy(), not
  // necessarily the tx sender — buy(account, ...) lets one address pay while
  // another occupies, e.g. a keeper buying on a bidder's behalf. On an
  // epoch slot this event also fires in a LATER transaction than the buy, sent
  // by whoever happened to materialise the transfer. Never read tx.from here.
  const buyerAccount = getOrCreateAccount(event.params.buyer, true);
  buyerAccount.occupiedCount += 1;
  buyerAccount.save();

  const buyerAS = getOrCreateAccountSlot(
    event.params.buyer,
    event.address,
    event.block.timestamp,
  );
  buyerAS.lastOccupiedAt = event.block.timestamp;
  buyerAS.lastInteractedAt = event.block.timestamp;
  buyerAS.save();

  slot.occupant = event.params.buyer;
  slot.occupantAccount = buyerAccount.id;
  slot.isOccupied = true;
  slot.price = event.params.selfAssessedPrice;
  slot.deposit = event.params.deposit;

  // On an epoch slot the tenure began at the BOUNDARY, not at the transaction
  // that happened to materialise it — `_materialize` sets
  // `occupiedSince = p.effectiveAt`, and MinimumTenurePolicy measures from
  // exactly that. Using the block timestamp here would overstate protection by
  // however long the slot sat unpoked.
  if (slot.pendingEffectiveAt !== null) {
    slot.occupiedSince = slot.pendingEffectiveAt as BigInt;
  } else {
    slot.occupiedSince = event.block.timestamp;
  }

  // This event IS the materialisation, so the scheduled transfer is now spent.
  // Leaving it set would make clients keep resolving to a "pending" buyer who
  // has already become the occupant.
  slot.pendingBuyer = null;
  slot.pendingEffectiveAt = null;
  slot.pendingPrice = null;
  slot.pendingDeposit = null;

  slot.updatedAt = event.block.timestamp;
  slot.save();

  const ev = new BoughtEvent(evtId(event.transaction.hash, event.logIndex));
  ev.slot = slot.id;
  ev.currency = slot.currency;
  ev.buyer = event.params.buyer;
  ev.previousOccupant = event.params.previousOccupant;
  ev.price = event.params.price;
  ev.deposit = event.params.deposit;
  ev.selfAssessedPrice = event.params.selfAssessedPrice;
  ev.timestamp = event.block.timestamp;
  ev.blockNumber = event.block.number;
  ev.tx = event.transaction.hash;
  ev.save();
}

export function handleReleased(event: Released): void {
  const slot = getSlot(event.address);

  if (slot.occupant !== null) {
    const prevAddr = Address.fromBytes(slot.occupant as Bytes);
    const prevAccount = getOrCreateAccount(prevAddr);
    prevAccount.occupiedCount -= 1;

    const prevAS = getOrCreateAccountSlot(
      prevAddr,
      event.address,
      event.block.timestamp,
    );
    if (prevAS.lastOccupiedAt !== null) {
      const held = event.block.timestamp.minus(prevAS.lastOccupiedAt as BigInt);
      prevAS.holdTime = prevAS.holdTime.plus(held);
      prevAccount.totalHoldTime = prevAccount.totalHoldTime.plus(held);
    }
    prevAS.lastOccupiedAt = null;
    prevAS.lastInteractedAt = event.block.timestamp;
    prevAS.save();
    prevAccount.save();
  }

  slot.occupant = null;
  slot.occupantAccount = null;
  slot.isOccupied = false;
  slot.price = BigInt.zero();
  slot.deposit = BigInt.zero();
  slot.collectedTax = BigInt.zero();
  slot.taxPaidTotal = BigInt.zero();
  slot.occupiedSince = BigInt.zero();
  // A scheduled transfer deliberately SURVIVES vacancy: release/liquidate
  // before the boundary leave the slot empty, and the transfer still lands at
  // its boundary (the buyer's purchase price is refunded then). Do not clear
  // pendingBuyer here.
  slot.updatedAt = event.block.timestamp;
  slot.save();

  const ev = new ReleasedEvent(evtId(event.transaction.hash, event.logIndex));
  ev.slot = slot.id;
  ev.currency = slot.currency;
  ev.occupant = event.params.occupant;
  ev.refund = event.params.refund;
  ev.timestamp = event.block.timestamp;
  ev.blockNumber = event.block.number;
  ev.tx = event.transaction.hash;
  ev.save();
}

export function handleLiquidated(event: Liquidated): void {
  const slot = getSlot(event.address);

  if (slot.occupant !== null) {
    const prevAddr = Address.fromBytes(slot.occupant as Bytes);
    const prevAccount = getOrCreateAccount(prevAddr);
    prevAccount.occupiedCount -= 1;

    const prevAS = getOrCreateAccountSlot(
      prevAddr,
      event.address,
      event.block.timestamp,
    );
    if (prevAS.lastOccupiedAt !== null) {
      const held = event.block.timestamp.minus(prevAS.lastOccupiedAt as BigInt);
      prevAS.holdTime = prevAS.holdTime.plus(held);
      prevAccount.totalHoldTime = prevAccount.totalHoldTime.plus(held);
    }
    prevAS.lastOccupiedAt = null;
    prevAS.lastInteractedAt = event.block.timestamp;
    prevAS.save();
    prevAccount.save();
  }

  slot.occupant = null;
  slot.occupantAccount = null;
  slot.isOccupied = false;
  slot.price = BigInt.zero();
  slot.deposit = BigInt.zero();
  slot.collectedTax = BigInt.zero();
  slot.taxPaidTotal = BigInt.zero();
  slot.occupiedSince = BigInt.zero();
  // A scheduled transfer deliberately SURVIVES vacancy: release/liquidate
  // before the boundary leave the slot empty, and the transfer still lands at
  // its boundary (the buyer's purchase price is refunded then). Do not clear
  // pendingBuyer here.
  slot.updatedAt = event.block.timestamp;
  slot.save();

  const ev = new LiquidatedEvent(evtId(event.transaction.hash, event.logIndex));
  ev.slot = slot.id;
  ev.currency = slot.currency;
  ev.liquidator = event.params.liquidator;
  ev.occupant = event.params.occupant;
  ev.bounty = event.params.bounty;
  ev.timestamp = event.block.timestamp;
  ev.blockNumber = event.block.number;
  ev.tx = event.transaction.hash;
  ev.save();
}

export function handlePriceUpdated(event: PriceUpdated): void {
  const slot = getSlot(event.address);
  slot.price = event.params.newPrice;
  slot.updatedAt = event.block.timestamp;
  slot.save();

  const ev = new PriceUpdatedEvent(
    evtId(event.transaction.hash, event.logIndex),
  );
  ev.slot = slot.id;
  ev.currency = slot.currency;
  ev.oldPrice = event.params.oldPrice;
  ev.newPrice = event.params.newPrice;
  ev.timestamp = event.block.timestamp;
  ev.blockNumber = event.block.number;
  ev.tx = event.transaction.hash;
  ev.save();
}

export function handleDeposited(event: Deposited): void {
  const slot = getSlot(event.address);
  slot.deposit = slot.deposit.plus(event.params.amount);
  slot.updatedAt = event.block.timestamp;
  slot.save();

  const ev = new DepositedEvent(evtId(event.transaction.hash, event.logIndex));
  ev.slot = slot.id;
  ev.currency = slot.currency;
  ev.depositor = event.params.depositor;
  ev.amount = event.params.amount;
  ev.timestamp = event.block.timestamp;
  ev.blockNumber = event.block.number;
  ev.tx = event.transaction.hash;
  ev.save();
}

export function handleWithdrawn(event: Withdrawn): void {
  const slot = getSlot(event.address);
  slot.deposit = slot.deposit.minus(event.params.amount);
  slot.updatedAt = event.block.timestamp;
  slot.save();

  const ev = new WithdrawnEvent(evtId(event.transaction.hash, event.logIndex));
  ev.slot = slot.id;
  ev.currency = slot.currency;
  ev.occupant = event.params.occupant;
  ev.amount = event.params.amount;
  ev.timestamp = event.block.timestamp;
  ev.blockNumber = event.block.number;
  ev.tx = event.transaction.hash;
  ev.save();
}

export function handleSettled(event: Settled): void {
  const slot = getSlot(event.address);
  slot.deposit = event.params.depositRemaining;
  slot.updatedAt = event.block.timestamp;
  slot.save();

  // Track tax paid on the current occupant (per-slot, since currency is immutable per slot)
  if (slot.occupant !== null) {
    const occAddr = Address.fromBytes(slot.occupant as Bytes);
    const occAS = getOrCreateAccountSlot(
      occAddr,
      event.address,
      event.block.timestamp,
    );
    occAS.taxPaid = occAS.taxPaid.plus(event.params.taxPaid);
    occAS.lastInteractedAt = event.block.timestamp;
    occAS.save();
  }

  const ev = new SettledEvent(evtId(event.transaction.hash, event.logIndex));
  ev.slot = slot.id;
  ev.currency = slot.currency;
  ev.taxOwed = event.params.taxOwed;
  ev.taxPaid = event.params.taxPaid;
  ev.depositRemaining = event.params.depositRemaining;
  ev.timestamp = event.block.timestamp;
  ev.blockNumber = event.block.number;
  ev.tx = event.transaction.hash;
  ev.save();
}

/**
 * `TaxPaid` — the authoritative per-address tax ledger.
 *
 * Emitted immediately after `Settled`, in the same transaction, carrying the
 * payer that `Settled` omits. `handleSettled` already attributes to
 * `slot.occupant`, which is correct only because `_settle()` runs before
 * occupancy is reassigned — an implicit ordering assumption with nothing
 * checking it. This handler does not re-add the amount (that would double
 * count); it records the authoritative event, keeps the per-slot denominator,
 * and repairs the attribution if the inference ever disagreed.
 */
export function handleTaxPaid(event: TaxPaid): void {
  const slot = getSlot(event.address);
  const payer = event.params.occupant;
  const amount = event.params.taxPaid;

  // Only grows — `collectedTax` is drained by `collect()`, so it cannot serve
  // as the denominator for a historical share.
  slot.taxPaidTotal = slot.taxPaidTotal.plus(amount);
  slot.updatedAt = event.block.timestamp;
  slot.save();

  const inferred = slot.occupant;
  const matched =
    inferred !== null && Address.fromBytes(inferred as Bytes).equals(payer);

  const payerAS = getOrCreateAccountSlot(
    payer,
    event.address,
    event.block.timestamp,
  );

  if (!matched) {
    // handleSettled credited the wrong account this transaction. Move it,
    // rather than letting the two sources drift apart silently.
    if (inferred !== null) {
      const wrongAS = getOrCreateAccountSlot(
        Address.fromBytes(inferred as Bytes),
        event.address,
        event.block.timestamp,
      );
      wrongAS.taxPaid = wrongAS.taxPaid.minus(amount);
      wrongAS.save();
    }
    payerAS.taxPaid = payerAS.taxPaid.plus(amount);
  }

  payerAS.lastInteractedAt = event.block.timestamp;
  payerAS.save();

  const ev = new TaxPaidEvent(evtId(event.transaction.hash, event.logIndex));
  ev.slot = slot.id;
  ev.account = getOrCreateAccount(payer).id;
  ev.accountSlot = payerAS.id;
  ev.currency = slot.currency;
  ev.taxOwed = event.params.taxOwed;
  ev.taxPaid = amount;
  ev.matchedOccupant = matched;
  ev.timestamp = event.block.timestamp;
  ev.blockNumber = event.block.number;
  ev.tx = event.transaction.hash;
  ev.save();
}

export function handleTaxCollected(event: TaxCollected): void {
  const slot = getSlot(event.address);
  slot.collectedTax = BigInt.zero();
  slot.taxPaidTotal = BigInt.zero();
  slot.totalCollected = slot.totalCollected.plus(event.params.amount);
  slot.updatedAt = event.block.timestamp;
  slot.save();

  const ev = new TaxCollectedEvent(
    evtId(event.transaction.hash, event.logIndex),
  );
  ev.slot = slot.id;
  ev.currency = slot.currency;
  ev.recipient = event.params.recipient;
  ev.amount = event.params.amount;
  ev.timestamp = event.block.timestamp;
  ev.blockNumber = event.block.number;
  ev.tx = event.transaction.hash;
  ev.save();
}

export function handleTaxUpdateProposed(event: TaxUpdateProposed): void {
  const ev = new TaxUpdateProposedEvent(
    evtId(event.transaction.hash, event.logIndex),
  );
  ev.slot = event.address.toHexString();
  ev.newPercentage = event.params.newPercentage;
  ev.timestamp = event.block.timestamp;
  ev.blockNumber = event.block.number;
  ev.tx = event.transaction.hash;
  ev.save();
}

export function handleModuleUpdateProposed(event: ModuleUpdateProposed): void {
  const ev = new ModuleUpdateProposedEvent(
    evtId(event.transaction.hash, event.logIndex),
  );
  ev.slot = event.address.toHexString();
  ev.newModule = event.params.newModule;
  ev.timestamp = event.block.timestamp;
  ev.blockNumber = event.block.number;
  ev.tx = event.transaction.hash;
  ev.save();
}

export function handlePendingUpdateCancelled(
  event: PendingUpdateCancelled,
): void {
  const ev = new PendingUpdateCancelledEvent(
    evtId(event.transaction.hash, event.logIndex),
  );
  ev.slot = event.address.toHexString();
  ev.timestamp = event.block.timestamp;
  ev.blockNumber = event.block.number;
  ev.tx = event.transaction.hash;
  ev.save();
}

export function handlePendingUpdateApplied(event: PendingUpdateApplied): void {
  const slot = getSlot(event.address);
  slot.taxPercentage = event.params.newTaxPercentage;
  const moduleAddr = event.params.newModule;
  if (moduleAddr.equals(Address.zero())) {
    slot.module = null;
  } else {
    const factoryId = dataSource.context().getString("factory");
    const mod = getOrCreateModule(moduleAddr, factoryId);
    slot.module = mod.id;
  }
  slot.updatedAt = event.block.timestamp;
  slot.save();
}

export function handleLiquidationBountyUpdated(
  event: LiquidationBountyUpdated,
): void {
  const slot = getSlot(event.address);
  slot.liquidationBountyBps = event.params.newBps;
  slot.updatedAt = event.block.timestamp;
  slot.save();
}

export function handleModuleFeePaid(event: ModuleFeePaid): void {
  const slot = getSlot(event.address);
  const moduleId = event.params.module.toHexString();
  const mod = Module.load(moduleId);
  if (mod) {
    mod.totalFeesCollected = mod.totalFeesCollected.plus(event.params.amount);
    mod.save();
  }

  const ev = new ModuleFeePaidEvent(
    evtId(event.transaction.hash, event.logIndex),
  );
  ev.slot = slot.id;
  ev.currency = slot.currency;
  ev.module = moduleId;
  ev.amount = event.params.amount;
  ev.feeBps = event.params.feeBps;
  ev.timestamp = event.block.timestamp;
  ev.blockNumber = event.block.number;
  ev.tx = event.transaction.hash;
  ev.save();
}

// ═══════════════════════════════════════════════════════════════════════════
// v3 OCCUPANCY LAYER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A slot's epoch length and occupancy policy, emitted by initializeV3 and
 * migrateSlotsV3. This is the ONLY on-chain source for either field —
 * SlotDeployed predates both and carries neither — so without this handler the
 * subgraph can never tell an hourly slot from an instant-buy one.
 */
export function handleSlotConfiguredV3(event: SlotConfiguredV3): void {
  const slot = getSlot(event.address);
  slot.epochSeconds = event.params.epochSeconds;
  if (event.params.occupancyPolicy.equals(Address.zero())) {
    slot.occupancyPolicy = null;
  } else {
    slot.occupancyPolicy = event.params.occupancyPolicy;
  }
  slot.updatedAt = event.block.timestamp;
  slot.save();
}

/**
 * A committed-but-not-yet-effective transfer.
 *
 * The occupant does NOT change here — the outgoing occupant keeps occupying and
 * keeps paying tax until the boundary. The matching Bought fires later, in
 * whatever transaction happens to materialise the transfer.
 *
 * Between `effectiveAt` and that transaction, the chain already treats
 * `buyer` as the occupant while `slot.occupant` still names the old one. The
 * subgraph cannot close that gap on its own (no "now" at query time), which is
 * exactly why these fields are exposed for clients to resolve against.
 */
export function handleTransferScheduled(event: TransferScheduled): void {
  const slot = getSlot(event.address);
  slot.pendingBuyer = event.params.buyer;
  slot.pendingEffectiveAt = event.params.effectiveAt;
  slot.pendingPrice = event.params.price;
  slot.pendingDeposit = event.params.deposit;
  slot.updatedAt = event.block.timestamp;
  slot.save();

  const ev = new TransferScheduledEvent(
    evtId(event.transaction.hash, event.logIndex),
  );
  ev.slot = slot.id;
  ev.currency = slot.currency;
  ev.buyer = event.params.buyer;
  ev.effectiveAt = event.params.effectiveAt;
  ev.price = event.params.price;
  ev.deposit = event.params.deposit;
  ev.timestamp = event.block.timestamp;
  ev.blockNumber = event.block.number;
  ev.tx = event.transaction.hash;
  ev.save();
}

export function handleOperatorSet(event: OperatorSet): void {
  const slot = getSlot(event.address);

  const id =
    slot.id +
    "-" +
    event.params.occupant.toHexString() +
    "-" +
    event.params.operator.toHexString();

  let op = SlotOperator.load(id);
  if (op == null) {
    op = new SlotOperator(id);
    op.slot = slot.id;
    op.occupant = event.params.occupant;
    op.operator = event.params.operator;
  }
  op.approved = event.params.approved;
  op.updatedAt = event.block.timestamp;
  op.save();

  const ev = new OperatorSetEvent(
    evtId(event.transaction.hash, event.logIndex),
  );
  ev.slot = slot.id;
  ev.occupant = event.params.occupant;
  ev.operator = event.params.operator;
  ev.approved = event.params.approved;
  ev.timestamp = event.block.timestamp;
  ev.blockNumber = event.block.number;
  ev.tx = event.transaction.hash;
  ev.save();
}

export function handlePolicyUpdateProposed(event: PolicyUpdateProposed): void {
  const slot = getSlot(event.address);
  slot.pendingPolicy = event.params.newPolicy;
  slot.hasPendingPolicy = true;
  slot.updatedAt = event.block.timestamp;
  slot.save();

  const ev = new PolicyUpdateProposedEvent(
    evtId(event.transaction.hash, event.logIndex),
  );
  ev.slot = slot.id;
  ev.newPolicy = event.params.newPolicy;
  ev.timestamp = event.block.timestamp;
  ev.blockNumber = event.block.number;
  ev.tx = event.transaction.hash;
  ev.save();
}

export function handlePolicyUpdateApplied(event: PolicyUpdateApplied): void {
  const slot = getSlot(event.address);
  if (event.params.newPolicy.equals(Address.zero())) {
    slot.occupancyPolicy = null;
  } else {
    slot.occupancyPolicy = event.params.newPolicy;
  }
  slot.pendingPolicy = null;
  slot.hasPendingPolicy = false;
  slot.updatedAt = event.block.timestamp;
  slot.save();

  const ev = new PolicyUpdateAppliedEvent(
    evtId(event.transaction.hash, event.logIndex),
  );
  ev.slot = slot.id;
  ev.newPolicy = event.params.newPolicy;
  ev.timestamp = event.block.timestamp;
  ev.blockNumber = event.block.number;
  ev.tx = event.transaction.hash;
  ev.save();
}

function getSlotRefund(
  slotId: string,
  account: Bytes,
  timestamp: BigInt,
): SlotRefund {
  const id = slotId + "-" + account.toHexString();
  let r = SlotRefund.load(id);
  if (r == null) {
    r = new SlotRefund(id);
    r.slot = slotId;
    r.account = account;
    r.credited = BigInt.zero();
    r.claimed = BigInt.zero();
    r.outstanding = BigInt.zero();
  }
  r.updatedAt = timestamp;
  return r as SlotRefund;
}

/**
 * A refund the slot could not push (blocklisting currency, reverting receiver)
 * and credited for later claim. A non-zero `outstanding` means the slot owes
 * this account money — worth surfacing in the UI, since nothing will move it
 * until they call `claim`.
 */
export function handleRefundCredited(event: RefundCredited): void {
  const slot = getSlot(event.address);
  const r = getSlotRefund(slot.id, event.params.account, event.block.timestamp);
  r.credited = r.credited.plus(event.params.amount);
  r.outstanding = r.outstanding.plus(event.params.amount);
  r.save();

  const ev = new RefundCreditedEvent(
    evtId(event.transaction.hash, event.logIndex),
  );
  ev.slot = slot.id;
  ev.currency = slot.currency;
  ev.account = event.params.account;
  ev.amount = event.params.amount;
  ev.timestamp = event.block.timestamp;
  ev.blockNumber = event.block.number;
  ev.tx = event.transaction.hash;
  ev.save();
}

export function handleRefundClaimed(event: RefundClaimed): void {
  const slot = getSlot(event.address);
  const r = getSlotRefund(slot.id, event.params.account, event.block.timestamp);
  r.claimed = r.claimed.plus(event.params.amount);
  r.outstanding = r.outstanding.minus(event.params.amount);
  r.save();

  const ev = new RefundClaimedEvent(
    evtId(event.transaction.hash, event.logIndex),
  );
  ev.slot = slot.id;
  ev.currency = slot.currency;
  ev.account = event.params.account;
  ev.amount = event.params.amount;
  ev.timestamp = event.block.timestamp;
  ev.blockNumber = event.block.number;
  ev.tx = event.transaction.hash;
  ev.save();
}
