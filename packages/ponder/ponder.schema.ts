import {
  index,
  onchainEnum,
  onchainTable,
  primaryKey,
  relations,
} from "ponder";

// ──────────────────────────────────────────
// Enums
// ──────────────────────────────────────────

export const accountType = onchainEnum("account_type", [
  "EOA",
  "CONTRACT",
  "DELEGATED",
  "SPLIT",
]);

// ──────────────────────────────────────────
// Cross-chain identity tables (no chainId — same address = same entity)
// ──────────────────────────────────────────

export const account = onchainTable("account", (t) => ({
  id: t.hex().primaryKey(),
  type: accountType().notNull(),
  slotCount: t.integer().notNull(),
  occupiedCount: t.integer().notNull(),
  metadataUpdateCount: t.bigint().notNull(),
  totalHoldTime: t.bigint().notNull(),
}));

export const currency = onchainTable("currency", (t) => ({
  id: t.hex().primaryKey(),
  name: t.text(),
  symbol: t.text(),
  decimals: t.integer().notNull(),
}));

// ──────────────────────────────────────────
// Chain-scoped entities (all have chainId for filtering)
// ──────────────────────────────────────────

export const factory = onchainTable(
  "factory",
  (t) => ({
    id: t.hex().primaryKey(),
    chainId: t.integer().notNull(),
    slotCount: t.bigint().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
  }),
);

export const accountSlot = onchainTable(
  "account_slot",
  (t) => ({
    account: t.hex().notNull(),
    slot: t.hex().notNull(),
    chainId: t.integer().notNull(),
    metadataUpdateCount: t.bigint().notNull(),
    taxPaid: t.bigint().notNull(),
    holdTime: t.bigint().notNull(),
    lastOccupiedAt: t.bigint(),
    firstInteractedAt: t.bigint().notNull(),
    lastInteractedAt: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.account, table.slot] }),
    chainIdx: index().on(table.chainId),
  }),
);

export const slot = onchainTable(
  "slot",
  (t) => ({
    id: t.hex().primaryKey(),
    chainId: t.integer().notNull(),
    recipient: t.hex().notNull(),
    recipientAccount: t.hex().notNull(),
    currency: t.hex().notNull(),
    mutableTax: t.boolean().notNull(),
    mutableModule: t.boolean().notNull(),
    manager: t.hex().notNull(),
    taxPercentage: t.bigint().notNull(),
    module: t.hex(),
    liquidationBountyBps: t.bigint().notNull(),
    minDepositSeconds: t.bigint().notNull(),
    occupant: t.hex(),
    occupantAccount: t.hex(),
    price: t.bigint().notNull(),
    deposit: t.bigint().notNull(),
    collectedTax: t.bigint().notNull(),
    totalCollected: t.bigint().notNull(),
    createdAt: t.bigint().notNull(),
    createdTx: t.hex().notNull(),
    updatedAt: t.bigint().notNull(),
    // parent factory so Slot-scoped handlers can resolve modules
    factory: t.hex().notNull(),
    // Pending updates — at most one per dimension, all applied together on the
    // next ownership transition. Answering "what is queued on this slot right
    // now" used to require an RPC call per slot; the per-kind event log makes
    // it derivable, so it lives here.
    //
    // NULL means nothing is queued. It is NOT interchangeable with the zero
    // address, which is a real proposed value for the two address dimensions —
    // "remove the utility" and "drop the occupancy policy" are both changes
    // someone deliberately queued.
    pendingTaxPercentage: t.bigint(),
    taxProposedAt: t.bigint(),
    pendingUtility: t.hex(),
    utilityProposedAt: t.bigint(),
    pendingPolicy: t.hex(),
    policyProposedAt: t.bigint(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
    factoryIdx: index().on(table.factory),
  }),
);

export const module = onchainTable(
  "module",
  (t) => ({
    id: t.hex().primaryKey(),
    chainId: t.integer().notNull(),
    factory: t.hex().notNull(),
    verified: t.boolean().notNull(),
    name: t.text().notNull(),
    version: t.text().notNull(),
    feeBps: t.bigint().notNull(),
    moduleURI: t.text(),
    image: t.text(),
    description: t.text(),
    totalFeesCollected: t.bigint().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
  }),
);

export const metadataSlot = onchainTable(
  "metadata_slot",
  (t) => ({
    id: t.hex().primaryKey(),
    chainId: t.integer().notNull(),
    slot: t.hex().notNull(),
    uri: t.text().notNull(),
    cid: t.text(),
    rawJson: t.text(),
    adType: t.text(),
    updatedBy: t.hex().notNull(),
    updateCount: t.bigint().notNull(),
    createdAt: t.bigint().notNull(),
    createdTx: t.hex().notNull(),
    updatedAt: t.bigint().notNull(),
    updatedTx: t.hex().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
  }),
);

// ──────────────────────────────────────────
// Immutable event entities (chainId for filtering)
// ──────────────────────────────────────────

export const slotDeployedEvent = onchainTable(
  "slot_deployed_event",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    slot: t.hex().notNull(),
    recipient: t.hex().notNull(),
    currency: t.hex().notNull(),
    manager: t.hex().notNull(),
    mutableTax: t.boolean().notNull(),
    mutableModule: t.boolean().notNull(),
    taxPercentage: t.bigint().notNull(),
    module: t.hex().notNull(),
    liquidationBountyBps: t.bigint().notNull(),
    minDepositSeconds: t.bigint().notNull(),
    deployer: t.hex().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    tx: t.hex().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
    slotIdx: index().on(table.slot),
  }),
);

export const boughtEvent = onchainTable(
  "bought_event",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    slot: t.hex().notNull(),
    currency: t.hex().notNull(),
    buyer: t.hex().notNull(),
    previousOccupant: t.hex().notNull(),
    price: t.bigint().notNull(),
    deposit: t.bigint().notNull(),
    selfAssessedPrice: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    tx: t.hex().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
    slotIdx: index().on(table.slot),
  }),
);

export const releasedEvent = onchainTable(
  "released_event",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    slot: t.hex().notNull(),
    currency: t.hex().notNull(),
    occupant: t.hex().notNull(),
    refund: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    tx: t.hex().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
    slotIdx: index().on(table.slot),
  }),
);

export const liquidatedEvent = onchainTable(
  "liquidated_event",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    slot: t.hex().notNull(),
    currency: t.hex().notNull(),
    liquidator: t.hex().notNull(),
    occupant: t.hex().notNull(),
    bounty: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    tx: t.hex().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
    slotIdx: index().on(table.slot),
  }),
);

export const priceUpdatedEvent = onchainTable(
  "price_updated_event",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    slot: t.hex().notNull(),
    currency: t.hex().notNull(),
    oldPrice: t.bigint().notNull(),
    newPrice: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    tx: t.hex().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
    slotIdx: index().on(table.slot),
  }),
);

export const depositedEvent = onchainTable(
  "deposited_event",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    slot: t.hex().notNull(),
    currency: t.hex().notNull(),
    depositor: t.hex().notNull(),
    amount: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    tx: t.hex().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
    slotIdx: index().on(table.slot),
  }),
);

export const withdrawnEvent = onchainTable(
  "withdrawn_event",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    slot: t.hex().notNull(),
    currency: t.hex().notNull(),
    occupant: t.hex().notNull(),
    amount: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    tx: t.hex().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
    slotIdx: index().on(table.slot),
  }),
);

export const settledEvent = onchainTable(
  "settled_event",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    slot: t.hex().notNull(),
    currency: t.hex().notNull(),
    taxOwed: t.bigint().notNull(),
    taxPaid: t.bigint().notNull(),
    depositRemaining: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    tx: t.hex().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
    slotIdx: index().on(table.slot),
  }),
);

export const taxCollectedEvent = onchainTable(
  "tax_collected_event",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    slot: t.hex().notNull(),
    currency: t.hex().notNull(),
    recipient: t.hex().notNull(),
    amount: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    tx: t.hex().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
    slotIdx: index().on(table.slot),
  }),
);

export const moduleFeePaidEvent = onchainTable(
  "module_fee_paid_event",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    slot: t.hex().notNull(),
    currency: t.hex().notNull(),
    module: t.hex().notNull(),
    amount: t.bigint().notNull(),
    feeBps: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    tx: t.hex().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
    slotIdx: index().on(table.slot),
    moduleIdx: index().on(table.module),
  }),
);

export const taxUpdateProposedEvent = onchainTable(
  "tax_update_proposed_event",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    slot: t.hex().notNull(),
    newPercentage: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    tx: t.hex().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
    slotIdx: index().on(table.slot),
  }),
);

export const moduleUpdateProposedEvent = onchainTable(
  "module_update_proposed_event",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    slot: t.hex().notNull(),
    newModule: t.hex().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    tx: t.hex().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
    slotIdx: index().on(table.slot),
  }),
);

export const pendingUpdateCancelledEvent = onchainTable(
  "pending_update_cancelled_event",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    slot: t.hex().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    tx: t.hex().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
    slotIdx: index().on(table.slot),
  }),
);

/**
 * The per-kind pending-update log: every propose, cancel and apply, tagged with
 * the dimension it touched.
 *
 * One table rather than three because the contract emits one event shape for
 * all of it. The older per-domain tables above cannot be reduced into slot
 * state: `PendingUpdateApplied` carries both tax and utility on every apply,
 * filling the unchanged one in from current state, and `PendingUpdateCancelled`
 * carries nothing at all. They are kept for historical continuity.
 *
 * `kind` matches the Solidity enum: 0 tax, 1 utility, 2 policy.
 * `value` is null on a cancel — nothing was set, only cleared.
 */
export const pendingUpdateEvent = onchainTable(
  "pending_update_event",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    slot: t.hex().notNull(),
    kind: t.integer().notNull(),
    action: t.text().notNull(), // "proposed" | "cancelled" | "applied"
    value: t.hex(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    tx: t.hex().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
    slotIdx: index().on(table.slot),
    kindIdx: index().on(table.kind),
  }),
);

export const metadataUpdatedEvent = onchainTable(
  "metadata_updated_event",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    slot: t.hex().notNull(),
    author: t.hex().notNull(),
    updatedBy: t.hex().notNull(),
    uri: t.text().notNull(),
    cid: t.text(),
    rawJson: t.text(),
    adType: t.text(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    tx: t.hex().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
    slotIdx: index().on(table.slot),
  }),
);

// ──────────────────────────────────────────
// ERC721Slots
// ──────────────────────────────────────────

export const nftCollection = onchainTable(
  "nft_collection",
  (t) => ({
    id: t.hex().primaryKey(),
    chainId: t.integer().notNull(),
    name: t.text().notNull(),
    symbol: t.text().notNull(),
    creator: t.hex().notNull(),
    factory: t.hex().notNull(),
    currency: t.hex().notNull(),
    taxPercentage: t.bigint().notNull(),
    totalSupply: t.bigint().notNull(),
    createdAt: t.bigint().notNull(),
    createdTx: t.hex().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
  }),
);

export const nftToken = onchainTable(
  "nft_token",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    collection: t.hex().notNull(),
    tokenId: t.bigint().notNull(),
    slot: t.hex().notNull(),
    uri: t.text().notNull(),
    mintedAt: t.bigint().notNull(),
    mintedTx: t.hex().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
    collectionIdx: index().on(table.collection),
  }),
);

// ──────────────────────────────────────────
// Relations (one() only — query event tables directly by foreign key column,
// e.g. boughtEvents(where: { slot: "0x...", chainId: 84532 }).
// ──────────────────────────────────────────

export const accountSlotRelations = relations(accountSlot, ({ one }) => ({
  accountRef: one(account, {
    fields: [accountSlot.account],
    references: [account.id],
  }),
  slotRef: one(slot, {
    fields: [accountSlot.slot],
    references: [slot.id],
  }),
}));

export const slotRelations = relations(slot, ({ one }) => ({
  recipientAccountRef: one(account, {
    fields: [slot.recipientAccount],
    references: [account.id],
    relationName: "recipient",
  }),
  occupantAccountRef: one(account, {
    fields: [slot.occupantAccount],
    references: [account.id],
    relationName: "occupant",
  }),
  currencyRef: one(currency, {
    fields: [slot.currency],
    references: [currency.id],
  }),
  moduleRef: one(module, {
    fields: [slot.module],
    references: [module.id],
  }),
  metadata: one(metadataSlot, {
    fields: [slot.id],
    references: [metadataSlot.slot],
  }),
}));

export const moduleRelations = relations(module, ({ one }) => ({
  factoryRef: one(factory, {
    fields: [module.factory],
    references: [factory.id],
  }),
}));

export const nftTokenRelations = relations(nftToken, ({ one }) => ({
  collectionRef: one(nftCollection, {
    fields: [nftToken.collection],
    references: [nftCollection.id],
  }),
  slotRef: one(slot, {
    fields: [nftToken.slot],
    references: [slot.id],
  }),
}));
