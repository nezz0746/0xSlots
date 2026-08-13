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

/**
 * An address, once, across every chain.
 *
 * Deliberately NOT chain-scoped: an address is the same person on base and
 * base-sepolia, and `accountSlot` / the event tables all reference it by bare
 * address. Chain-scoping the primary key would move every one of those.
 *
 * The consequence is that `slotCount` and `occupiedCount` here are TOTALS
 * across all chains, and are only meaningful as such. Anything rendering a
 * single chain must read `accountChain` instead — see the note there.
 */
export const account = onchainTable("account", (t) => ({
  id: t.hex().primaryKey(),
  type: accountType().notNull(),
  slotCount: t.integer().notNull(),
  occupiedCount: t.integer().notNull(),
  metadataUpdateCount: t.bigint().notNull(),
  totalHoldTime: t.bigint().notNull(),
}));

/**
 * The same counters, per chain.
 *
 * Exists because `account` has no `chainId` and cannot gain one cheaply, which
 * made a whole screen quietly wrong: the explorer's recipient list read
 * `accounts` unfiltered, so on base it listed base-sepolia's recipients with
 * their base-sepolia slot counts. Clicking one opened a recipient page that
 * correctly filters slots by chain and therefore found none — zeros everywhere
 * and an empty table, for a recipient the list had just advertised as holding
 * 133 slots.
 *
 * Additive on purpose. Chain-scoping `account.id` would have been the other
 * fix and would have moved every table that references an account by address.
 * This leaves all of that alone and gives per-chain readers somewhere correct
 * to read from.
 *
 * Maintained in lockstep with the totals above, at exactly the same three
 * sites: `factory.ts` when a recipient gains a slot, and `slot.ts` when an
 * occupant arrives or leaves. If one moves without the other they drift
 * silently, which is the failure mode this table exists to end.
 */
export const accountChain = onchainTable(
  "account_chain",
  (t) => ({
    account: t.hex().notNull(),
    chainId: t.integer().notNull(),
    /// Slots on THIS chain where the account is the recipient.
    slotCount: t.integer().notNull(),
    /// Slots on THIS chain the account currently OCCUPIES.
    /// @dev Not the companion of `slotCount` — that is `occupiedAsRecipient`.
    ///      These two describe different roles and pairing them as a ratio is a
    ///      category error, however much they look like a pair.
    occupiedCount: t.integer().notNull(),
    /// Of this account's RECIPIENT slots, how many are currently occupied.
    /// @dev The one that pairs with `slotCount`, and the only honest numerator
    ///      for an occupancy percentage. Previously the explorer derived this by
    ///      fetching up to 500 of the account's slots and counting the occupied
    ///      ones client-side — correct but capped, and wrong past 500.
    occupiedAsRecipient: t.integer().notNull(),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.account, table.chainId] }),
    chainIdx: index().on(table.chainId),
    accountIdx: index().on(table.account),
    // The explorer lists recipients per chain ordered by size, so the sort
    // column is indexed alongside the filter.
    slotCountIdx: index().on(table.slotCount),
  }),
);

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
    // Slots created before the occupancy layer carry neither this nor
    // `occupancyPolicy`; both are backfilled (false / null) rather than left
    // undefined, so each column means the same thing for every row.
    mutablePolicy: t.boolean().notNull(),
    manager: t.hex().notNull(),
    taxPercentage: t.bigint().notNull(),
    module: t.hex(),
    // null = no policy, i.e. plain instant buy
    occupancyPolicy: t.hex(),
    liquidationBountyBps: t.bigint().notNull(),
    minDepositSeconds: t.bigint().notNull(),
    occupant: t.hex(),
    occupantAccount: t.hex(),
    // Mirrors `occupant != null`, so the column is sortable and filterable
    // without a null check in every query.
    isOccupied: t.boolean().notNull(),
    occupiedSince: t.bigint().notNull(),
    price: t.bigint().notNull(),
    deposit: t.bigint().notNull(),
    collectedTax: t.bigint().notNull(),
    // Total tax ever paid into this slot, summed from TaxPaid. Unlike
    // `collectedTax` it only grows — collecting drains the balance, not the
    // history.
    taxPaidTotal: t.bigint().notNull(),
    totalCollected: t.bigint().notNull(),
    createdAt: t.bigint().notNull(),
    createdTx: t.hex().notNull(),
    updatedAt: t.bigint().notNull(),
    // parent factory so Slot-scoped handlers can resolve modules
    factory: t.hex().notNull(),
    // Null unless the slot belongs to a Feed. Driven by SlotAdded/SlotRemoved,
    // never by reading the feed's own list.
    feed: t.hex(),
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
    metadataURI: t.text(),
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
    mutablePolicy: t.boolean().notNull(),
    taxPercentage: t.bigint().notNull(),
    module: t.hex().notNull(),
    occupancyPolicy: t.hex(),
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

/**
 * Per-address tax attribution.
 *
 * `Settled` and `TaxPaid` both fire inside the same `_settle()`, but only
 * `TaxPaid` names the payer, and it fires only when money actually moved. So
 * attribution hangs off this event, never off `Settled` plus current
 * occupancy — settlement runs BEFORE a buy reassigns the occupant, so the
 * charge belongs to the outgoing tenant, not the incoming one.
 */
export const taxPaidEvent = onchainTable(
  "tax_paid_event",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    slot: t.hex().notNull(),
    currency: t.hex().notNull(),
    occupant: t.hex().notNull(),
    taxOwed: t.bigint().notNull(),
    // Capped by the remaining deposit, so it can fall well short of `taxOwed`
    // when an occupant is going insolvent. This is the number that means money
    // moved — anything reconstructing contributions from price x time
    // over-credits.
    taxPaid: t.bigint().notNull(),
    // False when the payer disagreed with the occupant on record. Always false
    // today; a true value means the ordering assumption above has broken and
    // older totals are suspect.
    matchedOccupant: t.boolean().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    tx: t.hex().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
    slotIdx: index().on(table.slot),
    occupantIdx: index().on(table.occupant),
  }),
);

export const operatorSetEvent = onchainTable(
  "operator_set_event",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    slot: t.hex().notNull(),
    occupant: t.hex().notNull(),
    operator: t.hex().notNull(),
    approved: t.boolean().notNull(),
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
 * Current operator approvals. An operator may selfAssess and topUp on the
 * occupant's behalf; it may never withdraw or release.
 */
export const slotOperator = onchainTable(
  "slot_operator",
  (t) => ({
    slot: t.hex().notNull(),
    occupant: t.hex().notNull(),
    operator: t.hex().notNull(),
    chainId: t.integer().notNull(),
    approved: t.boolean().notNull(),
    updatedAt: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({
      columns: [table.slot, table.occupant, table.operator],
    }),
    chainIdx: index().on(table.chainId),
  }),
);

export const policyUpdateProposedEvent = onchainTable(
  "policy_update_proposed_event",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    slot: t.hex().notNull(),
    newPolicy: t.hex().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    tx: t.hex().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
    slotIdx: index().on(table.slot),
  }),
);

export const policyUpdateAppliedEvent = onchainTable(
  "policy_update_applied_event",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    slot: t.hex().notNull(),
    newPolicy: t.hex().notNull(),
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
 * A refund that could not be pushed — a blocklisting currency, a recipient
 * that reverts — and was credited for later claim instead. Crediting is what
 * keeps liquidation unconditional: an occupant the currency refuses to pay
 * must not be able to veto their own forced sale.
 */
export const refundCreditedEvent = onchainTable(
  "refund_credited_event",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    slot: t.hex().notNull(),
    currency: t.hex().notNull(),
    account: t.hex().notNull(),
    amount: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    tx: t.hex().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
    slotIdx: index().on(table.slot),
    accountIdx: index().on(table.account),
  }),
);

export const refundClaimedEvent = onchainTable(
  "refund_claimed_event",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    slot: t.hex().notNull(),
    currency: t.hex().notNull(),
    account: t.hex().notNull(),
    amount: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    tx: t.hex().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
    slotIdx: index().on(table.slot),
    accountIdx: index().on(table.account),
  }),
);

/** Outstanding credit. A non-zero `balance` means the slot owes someone money. */
export const slotRefund = onchainTable(
  "slot_refund",
  (t) => ({
    slot: t.hex().notNull(),
    account: t.hex().notNull(),
    chainId: t.integer().notNull(),
    currency: t.hex().notNull(),
    credited: t.bigint().notNull(),
    claimed: t.bigint().notNull(),
    balance: t.bigint().notNull(),
    updatedAt: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.slot, table.account] }),
    chainIdx: index().on(table.chainId),
  }),
);


// ──────────────────────────────────────────
// Feeds — beacon-proxy collections, each owning a set of slots
// ──────────────────────────────────────────

export const feedHub = onchainTable(
  "feed_hub",
  (t) => ({
    id: t.hex().primaryKey(),
    chainId: t.integer().notNull(),
    feedCount: t.bigint().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
  }),
);

/**
 * A feed, with its metadata document resolved inline.
 *
 * The subgraph could not do this. Its File Data Sources fetch asynchronously
 * and are forbidden from writing back to the entity that spawned them, so for
 * any IPFS `metadataURI` the name, description, image, banner and link were all
 * permanently null and `displayName` could only ever fall back to the on-chain
 * name. A ponder handler just awaits the fetch and writes the fields, so they
 * carry real values here.
 */
export const feed = onchainTable(
  "feed",
  (t) => ({
    id: t.hex().primaryKey(),
    chainId: t.integer().notNull(),
    hub: t.hex().notNull(),
    index: t.bigint().notNull(),
    owner: t.hex().notNull(),
    onchainName: t.text().notNull(),
    metadataURI: t.text().notNull(),
    recipient: t.hex().notNull(),
    // Driven solely by SlotAdded/SlotRemoved — see the handler for why reading
    // `slotCount()` here would double-count.
    slotCount: t.bigint().notNull(),

    // Resolved from metadataURI.
    metadataName: t.text(),
    description: t.text(),
    image: t.text(),
    banner: t.text(),
    externalLink: t.text(),
    metadataRaw: t.text(),
    metadataCid: t.text(),
    /** `metadataName ?? onchainName`. Actually meaningful here. */
    displayName: t.text().notNull(),

    createdAt: t.bigint().notNull(),
    createdTx: t.hex().notNull(),
    updatedAt: t.bigint().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
    hubIdx: index().on(table.hub),
  }),
);

export const feedCreatedEvent = onchainTable(
  "feed_created_event",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    hub: t.hex().notNull(),
    feed: t.hex().notNull(),
    index: t.bigint().notNull(),
    owner: t.hex().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    tx: t.hex().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
    feedIdx: index().on(table.feed),
  }),
);

export const feedNameUpdatedEvent = onchainTable(
  "feed_name_updated_event",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    feed: t.hex().notNull(),
    name: t.text().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    tx: t.hex().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
    feedIdx: index().on(table.feed),
  }),
);

export const feedMetadataURIUpdatedEvent = onchainTable(
  "feed_metadata_uri_updated_event",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    feed: t.hex().notNull(),
    uri: t.text().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    tx: t.hex().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
    feedIdx: index().on(table.feed),
  }),
);

export const feedRecipientUpdatedEvent = onchainTable(
  "feed_recipient_updated_event",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    feed: t.hex().notNull(),
    recipient: t.hex().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    tx: t.hex().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
    feedIdx: index().on(table.feed),
  }),
);

export const feedSlotAddedEvent = onchainTable(
  "feed_slot_added_event",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    feed: t.hex().notNull(),
    slot: t.hex().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    tx: t.hex().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
    feedIdx: index().on(table.feed),
    slotIdx: index().on(table.slot),
  }),
);

export const feedSlotRemovedEvent = onchainTable(
  "feed_slot_removed_event",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    feed: t.hex().notNull(),
    slot: t.hex().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    tx: t.hex().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
    feedIdx: index().on(table.feed),
    slotIdx: index().on(table.slot),
  }),
);

// ──────────────────────────────────────────
// Relations
//
// The subgraph exposed per-slot event lists via @derivedFrom, so the explorer
// fetched a slot and its history in ONE query. Reproducing that here needs
// `many()` on `slot` — and drizzle resolves a `many()` only when the child
// declares the inverse `one()`, hence the block of one-line child relations
// below. Filtering an event table directly by its foreign key still works and
// stays the right call for long, paginated lists.
// ──────────────────────────────────────────

export const accountRelations = relations(account, ({ many }) => ({
  accountSlots: many(accountSlot),
  // The inverses of slot's two account links. Both need the same relationName
  // as the `one()` side, or drizzle cannot tell which of the two it is looking
  // at — a slot points at an account twice, for different reasons.
  slotsAsRecipient: many(slot, { relationName: "recipient" }),
  slotsAsOccupant: many(slot, { relationName: "occupant" }),
  /// One row per chain this account has ever held or received a slot on.
  chains: many(accountChain),
}));

export const accountChainRelations = relations(accountChain, ({ one }) => ({
  accountRef: one(account, {
    fields: [accountChain.account],
    references: [account.id],
  }),
}));

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

export const factoryRelations = relations(factory, ({ many }) => ({
  slots: many(slot),
  modules: many(module),
}));

export const slotRelations = relations(slot, ({ one, many }) => ({
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
  factoryRef: one(factory, {
    fields: [slot.factory],
    references: [factory.id],
  }),
  feedRef: one(feed, {
    fields: [slot.feed],
    references: [feed.id],
  }),
  metadata: one(metadataSlot, {
    fields: [slot.id],
    references: [metadataSlot.slot],
  }),

  // A slot names two addresses, and a SlotCollective can be BOTH of them. Each
  // link resolves to null when the address is an ordinary EOA, which is the
  // common case — these say "governed by / paid to a collective", not "has one".
  // Distinct relationNames because a slot may point at the same collective
  // twice, for different reasons.
  managerCollectiveRef: one(slotCollective, {
    fields: [slot.manager],
    references: [slotCollective.id],
    relationName: "collectiveManagedSlots",
  }),
  recipientCollectiveRef: one(slotCollective, {
    fields: [slot.recipient],
    references: [slotCollective.id],
    relationName: "collectiveReceivingSlots",
  }),

  accountSlots: many(accountSlot),
  operators: many(slotOperator),
  refunds: many(slotRefund),

  deployedEvents: many(slotDeployedEvent),
  boughtEvents: many(boughtEvent),
  releasedEvents: many(releasedEvent),
  liquidatedEvents: many(liquidatedEvent),
  priceUpdatedEvents: many(priceUpdatedEvent),
  depositedEvents: many(depositedEvent),
  withdrawnEvents: many(withdrawnEvent),
  settledEvents: many(settledEvent),
  taxPaidEvents: many(taxPaidEvent),
  taxCollectedEvents: many(taxCollectedEvent),
  moduleFeePaidEvents: many(moduleFeePaidEvent),
  taxUpdateProposedEvents: many(taxUpdateProposedEvent),
  moduleUpdateProposedEvents: many(moduleUpdateProposedEvent),
  pendingUpdateCancelledEvents: many(pendingUpdateCancelledEvent),
  pendingUpdateEvents: many(pendingUpdateEvent),
  policyUpdateProposedEvents: many(policyUpdateProposedEvent),
  policyUpdateAppliedEvents: many(policyUpdateAppliedEvent),
  operatorSetEvents: many(operatorSetEvent),
  refundCreditedEvents: many(refundCreditedEvent),
  refundClaimedEvents: many(refundClaimedEvent),
  metadataUpdates: many(metadataUpdatedEvent),
}));

export const moduleRelations = relations(module, ({ one, many }) => ({
  factoryRef: one(factory, {
    fields: [module.factory],
    references: [factory.id],
  }),
  slots: many(slot),
  feesPaid: many(moduleFeePaidEvent),
}));

export const metadataSlotRelations = relations(metadataSlot, ({ one }) => ({
  slotRef: one(slot, {
    fields: [metadataSlot.slot],
    references: [slot.id],
  }),
}));

// ── Inverse one() for every slot-scoped child ────────────────────────────────

export const slotOperatorRelations = relations(slotOperator, ({ one }) => ({
  slotRef: one(slot, { fields: [slotOperator.slot], references: [slot.id] }),
}));

export const slotRefundRelations = relations(slotRefund, ({ one }) => ({
  slotRef: one(slot, { fields: [slotRefund.slot], references: [slot.id] }),
    currencyRef: one(currency, {
      fields: [slotRefund.currency],
      references: [currency.id],
    }),
}));

export const slotDeployedEventRelations = relations(
  slotDeployedEvent,
  ({ one }) => ({
    slotRef: one(slot, {
      fields: [slotDeployedEvent.slot],
      references: [slot.id],
    }),
    currencyRef: one(currency, {
      fields: [slotDeployedEvent.currency],
      references: [currency.id],
    }),
  }),
);

export const boughtEventRelations = relations(boughtEvent, ({ one }) => ({
  slotRef: one(slot, { fields: [boughtEvent.slot], references: [slot.id] }),
    currencyRef: one(currency, {
      fields: [boughtEvent.currency],
      references: [currency.id],
    }),
}));

export const releasedEventRelations = relations(releasedEvent, ({ one }) => ({
  slotRef: one(slot, { fields: [releasedEvent.slot], references: [slot.id] }),
    currencyRef: one(currency, {
      fields: [releasedEvent.currency],
      references: [currency.id],
    }),
}));

export const liquidatedEventRelations = relations(
  liquidatedEvent,
  ({ one }) => ({
    slotRef: one(slot, {
      fields: [liquidatedEvent.slot],
      references: [slot.id],
    }),
    currencyRef: one(currency, {
      fields: [liquidatedEvent.currency],
      references: [currency.id],
    }),
  }),
);

export const priceUpdatedEventRelations = relations(
  priceUpdatedEvent,
  ({ one }) => ({
    slotRef: one(slot, {
      fields: [priceUpdatedEvent.slot],
      references: [slot.id],
    }),
    currencyRef: one(currency, {
      fields: [priceUpdatedEvent.currency],
      references: [currency.id],
    }),
  }),
);

export const depositedEventRelations = relations(depositedEvent, ({ one }) => ({
  slotRef: one(slot, { fields: [depositedEvent.slot], references: [slot.id] }),
    currencyRef: one(currency, {
      fields: [depositedEvent.currency],
      references: [currency.id],
    }),
}));

export const withdrawnEventRelations = relations(withdrawnEvent, ({ one }) => ({
  slotRef: one(slot, { fields: [withdrawnEvent.slot], references: [slot.id] }),
    currencyRef: one(currency, {
      fields: [withdrawnEvent.currency],
      references: [currency.id],
    }),
}));

export const settledEventRelations = relations(settledEvent, ({ one }) => ({
  slotRef: one(slot, { fields: [settledEvent.slot], references: [slot.id] }),
    currencyRef: one(currency, {
      fields: [settledEvent.currency],
      references: [currency.id],
    }),
}));

export const taxPaidEventRelations = relations(taxPaidEvent, ({ one }) => ({
  slotRef: one(slot, { fields: [taxPaidEvent.slot], references: [slot.id] }),
    currencyRef: one(currency, {
      fields: [taxPaidEvent.currency],
      references: [currency.id],
    }),
}));

export const taxCollectedEventRelations = relations(
  taxCollectedEvent,
  ({ one }) => ({
    slotRef: one(slot, {
      fields: [taxCollectedEvent.slot],
      references: [slot.id],
    }),
    currencyRef: one(currency, {
      fields: [taxCollectedEvent.currency],
      references: [currency.id],
    }),
  }),
);

export const moduleFeePaidEventRelations = relations(
  moduleFeePaidEvent,
  ({ one }) => ({
    slotRef: one(slot, {
      fields: [moduleFeePaidEvent.slot],
      references: [slot.id],
    }),
    moduleRef: one(module, {
      fields: [moduleFeePaidEvent.module],
      references: [module.id],
    }),
    currencyRef: one(currency, {
      fields: [moduleFeePaidEvent.currency],
      references: [currency.id],
    }),
  }),
);

export const taxUpdateProposedEventRelations = relations(
  taxUpdateProposedEvent,
  ({ one }) => ({
    slotRef: one(slot, {
      fields: [taxUpdateProposedEvent.slot],
      references: [slot.id],
    }),
  }),
);

export const moduleUpdateProposedEventRelations = relations(
  moduleUpdateProposedEvent,
  ({ one }) => ({
    slotRef: one(slot, {
      fields: [moduleUpdateProposedEvent.slot],
      references: [slot.id],
    }),
  }),
);

export const pendingUpdateCancelledEventRelations = relations(
  pendingUpdateCancelledEvent,
  ({ one }) => ({
    slotRef: one(slot, {
      fields: [pendingUpdateCancelledEvent.slot],
      references: [slot.id],
    }),
  }),
);

export const pendingUpdateEventRelations = relations(
  pendingUpdateEvent,
  ({ one }) => ({
    slotRef: one(slot, {
      fields: [pendingUpdateEvent.slot],
      references: [slot.id],
    }),
  }),
);

export const policyUpdateProposedEventRelations = relations(
  policyUpdateProposedEvent,
  ({ one }) => ({
    slotRef: one(slot, {
      fields: [policyUpdateProposedEvent.slot],
      references: [slot.id],
    }),
  }),
);

export const policyUpdateAppliedEventRelations = relations(
  policyUpdateAppliedEvent,
  ({ one }) => ({
    slotRef: one(slot, {
      fields: [policyUpdateAppliedEvent.slot],
      references: [slot.id],
    }),
  }),
);

export const operatorSetEventRelations = relations(
  operatorSetEvent,
  ({ one }) => ({
    slotRef: one(slot, {
      fields: [operatorSetEvent.slot],
      references: [slot.id],
    }),
  }),
);

export const refundCreditedEventRelations = relations(
  refundCreditedEvent,
  ({ one }) => ({
    slotRef: one(slot, {
      fields: [refundCreditedEvent.slot],
      references: [slot.id],
    }),
    currencyRef: one(currency, {
      fields: [refundCreditedEvent.currency],
      references: [currency.id],
    }),
  }),
);

export const refundClaimedEventRelations = relations(
  refundClaimedEvent,
  ({ one }) => ({
    slotRef: one(slot, {
      fields: [refundClaimedEvent.slot],
      references: [slot.id],
    }),
    currencyRef: one(currency, {
      fields: [refundClaimedEvent.currency],
      references: [currency.id],
    }),
  }),
);

export const metadataUpdatedEventRelations = relations(
  metadataUpdatedEvent,
  ({ one }) => ({
    slotRef: one(slot, {
      fields: [metadataUpdatedEvent.slot],
      references: [slot.id],
    }),
    authorRef: one(account, {
      fields: [metadataUpdatedEvent.author],
      references: [account.id],
    }),
  }),
);

export const feedHubRelations = relations(feedHub, ({ many }) => ({
  feeds: many(feed),
}));

export const feedRelations = relations(feed, ({ one, many }) => ({
  hubRef: one(feedHub, { fields: [feed.hub], references: [feedHub.id] }),
  slots: many(slot),
  createdEvents: many(feedCreatedEvent),
  nameUpdates: many(feedNameUpdatedEvent),
  metadataUpdates: many(feedMetadataURIUpdatedEvent),
  recipientUpdates: many(feedRecipientUpdatedEvent),
  slotsAdded: many(feedSlotAddedEvent),
  slotsRemoved: many(feedSlotRemovedEvent),
}));

export const feedCreatedEventRelations = relations(
  feedCreatedEvent,
  ({ one }) => ({
    feedRef: one(feed, { fields: [feedCreatedEvent.feed], references: [feed.id] }),
  }),
);

export const feedNameUpdatedEventRelations = relations(
  feedNameUpdatedEvent,
  ({ one }) => ({
    feedRef: one(feed, {
      fields: [feedNameUpdatedEvent.feed],
      references: [feed.id],
    }),
  }),
);

export const feedMetadataURIUpdatedEventRelations = relations(
  feedMetadataURIUpdatedEvent,
  ({ one }) => ({
    feedRef: one(feed, {
      fields: [feedMetadataURIUpdatedEvent.feed],
      references: [feed.id],
    }),
  }),
);

export const feedRecipientUpdatedEventRelations = relations(
  feedRecipientUpdatedEvent,
  ({ one }) => ({
    feedRef: one(feed, {
      fields: [feedRecipientUpdatedEvent.feed],
      references: [feed.id],
    }),
  }),
);

export const feedSlotAddedEventRelations = relations(
  feedSlotAddedEvent,
  ({ one }) => ({
    feedRef: one(feed, {
      fields: [feedSlotAddedEvent.feed],
      references: [feed.id],
    }),
    slotRef: one(slot, {
      fields: [feedSlotAddedEvent.slot],
      references: [slot.id],
    }),
  }),
);

export const feedSlotRemovedEventRelations = relations(
  feedSlotRemovedEvent,
  ({ one }) => ({
    feedRef: one(feed, {
      fields: [feedSlotRemovedEvent.feed],
      references: [feed.id],
    }),
    slotRef: one(slot, {
      fields: [feedSlotRemovedEvent.slot],
      references: [slot.id],
    }),
  }),
);

// ═══════════════════════════════════════════════════════════
// COLLECTIVES
// ═══════════════════════════════════════════════════════════
//
// A SlotCollective fills BOTH of a slot's named addresses at once: `recipient`
// (tax flows to it) and `manager` (it may propose tax/utility/policy changes).
// Indexed here so those two columns on `slot` stop being opaque addresses and
// become a join — "who governs this slot, and who actually gets paid".
//
// Split membership and role membership are the two things unavailable on-chain
// without replaying logs: `splitHash` is a hash, and AccessControl keeps no
// enumerable member list. Both are reconstructed below.

export const slotCollective = onchainTable(
  "slot_collective",
  (t) => ({
    id: t.hex().primaryKey(),
    chainId: t.integer().notNull(),
    /// DEFAULT_ADMIN_ROLE holder at deployment. Roles can move afterwards —
    /// `collectiveRole` is the live answer, this is only the founding one.
    admin: t.hex().notNull(),
    deployer: t.hex().notNull(),
    /// Mirrors the on-chain `splitHash`. The membership behind it is in
    /// `collectiveSplitRecipient`, rebuilt from `SplitUpdated`.
    splitHash: t.hex(),
    totalAllocation: t.bigint().notNull(),
    distributionIncentive: t.integer().notNull(),
    paused: t.boolean().notNull(),
    /// How many recipients the CURRENT split has. Stored so an update can
    /// delete the tail when a split shrinks, without querying for it.
    splitRecipientCount: t.integer().notNull(),
    createdAt: t.bigint().notNull(),
    createdTx: t.hex().notNull(),
    updatedAt: t.bigint().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
    adminIdx: index().on(table.admin),
  }),
);

/// @notice Live role membership. AccessControl has no enumerable member list,
///         so this is the only way to answer "who governs this collective".
/// @dev Rows are kept rather than deleted on revoke, with `granted` flipped —
///      history is the point, and a revoked member is a fact worth showing.
export const collectiveRole = onchainTable(
  "collective_role",
  (t) => ({
    collective: t.hex().notNull(),
    /// keccak of the role name. Resolved to a label in `roleLabel` where known.
    role: t.hex().notNull(),
    account: t.hex().notNull(),
    chainId: t.integer().notNull(),
    granted: t.boolean().notNull(),
    /// Human-readable role name where the hash is one of the four known ones.
    /// Null for DEFAULT_ADMIN_ROLE (0x00..) or any role added later.
    label: t.text(),
    grantedAt: t.bigint(),
    revokedAt: t.bigint(),
    updatedAt: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({
      columns: [table.collective, table.role, table.account],
    }),
    chainIdx: index().on(table.chainId),
    accountIdx: index().on(table.account),
    collectiveIdx: index().on(table.collective),
  }),
);

/// @notice Who the collective pays right now, and in what share.
/// @dev CURRENT state only — `SplitUpdated` carries the entire Split struct, so
///      the live set is always exactly the last event's contents and there is no
///      incremental add/remove to reconcile. History lives in
///      `collectiveSplitUpdatedEvent` instead, which keeps this table cheap:
///      updating it touches only primary keys, never a scan.
///
///      Keyed by position rather than account because splits-v2 does not forbid
///      the same address appearing twice.
export const collectiveSplitRecipient = onchainTable(
  "collective_split_recipient",
  (t) => ({
    collective: t.hex().notNull(),
    index: t.integer().notNull(),
    chainId: t.integer().notNull(),
    account: t.hex().notNull(),
    allocation: t.bigint().notNull(),
    /// Share of the whole in basis points, precomputed so a UI never has to
    /// divide by `totalAllocation` itself.
    shareBps: t.integer().notNull(),
    updatedAt: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.collective, table.index] }),
    chainIdx: index().on(table.chainId),
    collectiveIdx: index().on(table.collective),
    accountIdx: index().on(table.account),
  }),
);

/// @notice Every split rewrite, with the full membership as it was.
/// @dev The history half of the pair above. Arrays are stored as JSON text
///      because the whole point is to keep the snapshot verbatim; nothing
///      queries inside them.
export const collectiveSplitUpdatedEvent = onchainTable(
  "collective_split_updated_event",
  (t) => ({
    id: t.text().primaryKey(),
    collective: t.hex().notNull(),
    chainId: t.integer().notNull(),
    /// JSON array of addresses, in allocation order.
    recipients: t.text().notNull(),
    /// JSON array of decimal strings, index-aligned with `recipients`.
    allocations: t.text().notNull(),
    totalAllocation: t.bigint().notNull(),
    distributionIncentive: t.integer().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    tx: t.hex().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
    collectiveIdx: index().on(table.collective),
  }),
);

/// @notice Governance actions relayed through the collective to a slot.
/// @dev The reason this table can exist at all: the slot's own propose events
///      carry NO proposer, and `transaction.from` is wrong whenever the role
///      holder is a Safe or the call is bundled. `by` here is the actual role
///      holder, which is recoverable from nowhere else.
export const collectiveActionEvent = onchainTable(
  "collective_action_event",
  (t) => ({
    id: t.text().primaryKey(),
    collective: t.hex().notNull(),
    chainId: t.integer().notNull(),
    slot: t.hex().notNull(),
    by: t.hex().notNull(),
    /// "propose" | "cancel" | "cancelAll" | "bounty"
    action: t.text().notNull(),
    /// "Tax" | "Utility" | "Policy" — null for cancelAll and bounty.
    kind: t.text(),
    /// Raw basis points for Tax and bounty, the address for Utility/Policy.
    /// Left as the widened bytes32 the event carries.
    value: t.hex(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    tx: t.hex().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
    collectiveIdx: index().on(table.collective),
    slotIdx: index().on(table.slot),
    byIdx: index().on(table.by),
  }),
);

/// @notice Each time the collective fanned revenue out over its split.
export const collectiveDistributionEvent = onchainTable(
  "collective_distribution_event",
  (t) => ({
    id: t.text().primaryKey(),
    collective: t.hex().notNull(),
    chainId: t.integer().notNull(),
    token: t.hex().notNull(),
    distributor: t.hex().notNull(),
    amount: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    tx: t.hex().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
    collectiveIdx: index().on(table.collective),
    tokenIdx: index().on(table.token),
  }),
);

export const slotCollectiveRelations = relations(
  slotCollective,
  ({ many }) => ({
    roles: many(collectiveRole),
    splitRecipients: many(collectiveSplitRecipient),
    splitUpdates: many(collectiveSplitUpdatedEvent),
    actions: many(collectiveActionEvent),
    distributions: many(collectiveDistributionEvent),
    /// Slots that named this collective. Two relations because a slot may name
    /// it as manager, as recipient, or both — `relationName` keeps them apart.
    managedSlots: many(slot, { relationName: "collectiveManagedSlots" }),
    receivingSlots: many(slot, { relationName: "collectiveReceivingSlots" }),
  }),
);

export const collectiveRoleRelations = relations(collectiveRole, ({ one }) => ({
  collectiveRef: one(slotCollective, {
    fields: [collectiveRole.collective],
    references: [slotCollective.id],
  }),
  accountRef: one(account, {
    fields: [collectiveRole.account],
    references: [account.id],
  }),
}));

export const collectiveSplitRecipientRelations = relations(
  collectiveSplitRecipient,
  ({ one }) => ({
    collectiveRef: one(slotCollective, {
      fields: [collectiveSplitRecipient.collective],
      references: [slotCollective.id],
    }),
    accountRef: one(account, {
      fields: [collectiveSplitRecipient.account],
      references: [account.id],
    }),
  }),
);

export const collectiveSplitUpdatedEventRelations = relations(
  collectiveSplitUpdatedEvent,
  ({ one }) => ({
    collectiveRef: one(slotCollective, {
      fields: [collectiveSplitUpdatedEvent.collective],
      references: [slotCollective.id],
    }),
  }),
);

export const collectiveActionEventRelations = relations(
  collectiveActionEvent,
  ({ one }) => ({
    collectiveRef: one(slotCollective, {
      fields: [collectiveActionEvent.collective],
      references: [slotCollective.id],
    }),
    slotRef: one(slot, {
      fields: [collectiveActionEvent.slot],
      references: [slot.id],
    }),
  }),
);

export const collectiveDistributionEventRelations = relations(
  collectiveDistributionEvent,
  ({ one }) => ({
    collectiveRef: one(slotCollective, {
      fields: [collectiveDistributionEvent.collective],
      references: [slotCollective.id],
    }),
  }),
);
