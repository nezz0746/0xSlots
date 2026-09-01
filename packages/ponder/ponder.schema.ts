import {
  index,
  onchainEnum,
  onchainTable,
  primaryKey,
  relations,
} from "ponder";

// ═══════════════════════════════════════════════════════════════════════════
// THE HOOK-BASED SLOTS PROTOCOL
//
// One `hook` address per slot. There is no policy table and no module table,
// because there are no policies and no modules — the three extension surfaces
// the previous protocol had (occupancy policy, utility head, module gallery)
// collapsed into a single address with one interface. A slot wanting several
// behaviours points at a CompositeHook that fans out in userland, and the
// indexer sees exactly one address either way.
//
// Two things follow from that and shape everything below:
//
//   1. `hook` is a first-class entity, not a column. It is shared across slots
//      (MinimumTenureHook is a stateless singleton, one deploy per duration),
//      it carries a declared flag set, and the factory has an opinion about it
//      (`attestedHooks`). All three want a row.
//
//   2. A slot stores a SNAPSHOT of the hook's flags taken when it was
//      attached, and the hook's own `hooks()` can drift from it afterwards —
//      a hook may be a proxy, and the snapshot is deliberately never re-read.
//      Both sides are stored, on `slot` and on `hook`, precisely so the drift
//      is visible rather than averaged away.
// ═══════════════════════════════════════════════════════════════════════════

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
 * address.
 *
 * The consequence is that `slotCount` and `occupiedCount` here are TOTALS
 * across all chains, and are only meaningful as such. Anything rendering a
 * single chain must read `accountChain` instead.
 */
export const account = onchainTable("account", (t) => ({
  id: t.hex().primaryKey(),
  type: accountType().notNull(),
  /// Slots whose `recipient` is this account.
  slotCount: t.integer().notNull(),
  /// Slots this account currently occupies.
  occupiedCount: t.integer().notNull(),
  /// Seconds spent occupying, summed over every tenure that has ENDED.
  totalHoldTime: t.bigint().notNull(),
  /// Tax actually paid, summed from `TaxPaid.paid` — the number that means
  /// money moved, as opposed to what was owed.
  taxPaidTotal: t.bigint().notNull(),
}));

/**
 * The same counters, per chain.
 *
 * Exists because `account` has no `chainId` and cannot gain one cheaply, which
 * makes any single-chain screen reading `account` quietly wrong — it would list
 * base-sepolia's recipients on base, with their base-sepolia counts.
 */
export const accountChain = onchainTable(
  "account_chain",
  (t) => ({
    account: t.hex().notNull(),
    chainId: t.integer().notNull(),
    slotCount: t.integer().notNull(),
    occupiedCount: t.integer().notNull(),
    /// Of the slots this account RECEIVES tax from, how many are occupied.
    /// Tracked as a counter because counting it at read time capped out.
    occupiedAsRecipient: t.integer().notNull(),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.account, table.chainId] }),
    chainIdx: index().on(table.chainId),
  }),
);

export const currency = onchainTable("currency", (t) => ({
  id: t.hex().primaryKey(),
  name: t.text(),
  symbol: t.text(),
  decimals: t.integer().notNull(),
}));

// ──────────────────────────────────────────
// Chain-scoped entities
// ──────────────────────────────────────────

/**
 * The factory, which is also the protocol's event hub and its admin surface.
 *
 * `admin`, `implementation` and `attested hooks` all live on this one contract,
 * and each of its four events writes here — so the row answers "who can upgrade
 * every slot on this chain right now", which is the single most consequential
 * fact in the protocol and previously had no home in the schema at all.
 */
export const factory = onchainTable(
  "factory",
  (t) => ({
    id: t.hex().primaryKey(),
    chainId: t.integer().notNull(),
    slotCount: t.bigint().notNull(),
    /// May upgrade the beacon, upgrade the factory, and attest hooks.
    admin: t.hex(),
    /// Current beacon implementation. Every slot delegates to it.
    implementation: t.hex(),
    implementationUpdatedAt: t.bigint(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
  }),
);

/**
 * A hook contract.
 *
 * Chain-scoped by primary key, unlike `account` and `currency`. A hook is code
 * rather than an identity: the same address on two chains is two deployments
 * that may hold different constructor arguments — MinimumTenureHook's whole
 * configuration is its `tenureSeconds` immutable — and `attested` is an opinion
 * one chain's factory admin expressed about one of them. Merging the two rows
 * would merge those facts.
 *
 * The `declared*` flags are read from the hook's own `hooks()` the first time
 * it is seen. They are NOT what any particular slot obeys: a slot obeys the
 * snapshot it took at attach time, stored on `slot`. Comparing the two is how
 * you find a hook that changed its declaration after slots had already
 * committed to it.
 */
export const hook = onchainTable(
  "hook",
  (t) => ({
    id: t.hex().notNull(),
    chainId: t.integer().notNull(),
    /// False when `hooks()` did not answer — a hook that cannot be attached.
    /// The columns below are then all false rather than unknown, so read this
    /// one before trusting them.
    declaredKnown: t.boolean().notNull(),
    declaredBeforeBuy: t.boolean().notNull(),
    declaredBeforeSell: t.boolean().notNull(),
    declaredBeforeSelfAssess: t.boolean().notNull(),
    declaredAfterBuy: t.boolean().notNull(),
    declaredAfterSell: t.boolean().notNull(),
    declaredAfterRelease: t.boolean().notNull(),
    declaredAfterLiquidate: t.boolean().notNull(),
    declaredAfterSettle: t.boolean().notNull(),
    /// The factory admin's advisory opinion. Not a permission — any hook with
    /// code may be attached to any slot regardless of what this says.
    attested: t.boolean().notNull(),
    attestedAt: t.bigint(),
    /// Slots pointing at this hook right now.
    slotCount: t.integer().notNull(),
    /// `after` callbacks that reverted and were swallowed. A hook accumulating
    /// these is broken in a way nothing on chain will ever tell its users.
    failedCallCount: t.integer().notNull(),
    firstSeenAt: t.bigint().notNull(),
    updatedAt: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.id, table.chainId] }),
    chainIdx: index().on(table.chainId),
    attestedIdx: index().on(table.attested),
  }),
);

/**
 * One Harberger-taxed slot.
 *
 * Most of this row cannot be read from `SlotCreated`, which carries only
 * recipient, creator, currency and hook. The terms — tax, minimum deposit,
 * which dimensions are mutable, the manager — are read back from the slot with
 * an eth_call at creation. See `readSlotTerms` in src/helpers.ts.
 */
export const slot = onchainTable(
  "slot",
  (t) => ({
    id: t.hex().primaryKey(),
    chainId: t.integer().notNull(),
    factory: t.hex().notNull(),

    // ── identity ──────────────────────────────────────────────────────────
    /// Where tax goes.
    recipient: t.hex().notNull(),
    recipientAccount: t.hex().notNull(),
    /// Zero address means native ETH; the `currency` row names it "ETH".
    currency: t.hex().notNull(),
    /// NULL on a fully immutable slot. The contract enforces the pairing: a
    /// manager exists exactly when something is mutable.
    manager: t.hex(),
    creator: t.hex().notNull(),

    // ── terms ─────────────────────────────────────────────────────────────
    /// Basis points per 30 days.
    taxPercentage: t.bigint().notNull(),
    /// Minimum runway, in seconds, a buyer must fund. Zero means no minimum.
    minDepositSeconds: t.bigint().notNull(),
    mutableTax: t.boolean().notNull(),
    mutableHook: t.boolean().notNull(),

    // ── the hook, and the flags THIS SLOT obeys ───────────────────────────
    /// NULL when the slot has no hook at all — which is the plain Harberger
    /// slot, and a perfectly ordinary configuration rather than a gap.
    hook: t.hex(),
    /// Snapshotted when the hook was attached and never re-read, so a hook
    /// cannot widen its own reach mid-tenure. Compare against the `declared*`
    /// columns on `hook` to see whether it has since tried.
    hookBeforeBuy: t.boolean().notNull(),
    hookBeforeSell: t.boolean().notNull(),
    hookBeforeSelfAssess: t.boolean().notNull(),
    hookAfterBuy: t.boolean().notNull(),
    hookAfterSell: t.boolean().notNull(),
    hookAfterRelease: t.boolean().notNull(),
    hookAfterLiquidate: t.boolean().notNull(),
    hookAfterSettle: t.boolean().notNull(),

    // ── occupancy ─────────────────────────────────────────────────────────
    occupant: t.hex(),
    occupantAccount: t.hex(),
    /// Mirrors `occupant != null`, so the column is sortable and filterable
    /// without a null check in every query.
    isOccupied: t.boolean().notNull(),
    occupiedSince: t.bigint().notNull(),
    /// Which tenure is current. Increments on every seating and never repeats;
    /// zero before the slot has ever been occupied.
    ///
    /// A COUNTER, not a timestamp, and mirrored from the chain's own
    /// `tenureId` rather than derived here: release-and-reseat can happen in
    /// one block, so two tenures can share an `occupiedSince` and an identity
    /// that collides is not an identity. Never reset by vacancy — the counter
    /// only goes up, so the value persists while the slot is empty.
    tenureId: t.bigint().notNull(),
    price: t.bigint().notNull(),
    /// Escrow left after the last settlement. Maintained from `Settled`,
    /// `Deposited`, `Withdrawn` and the transition events, all of which report
    /// the resulting balance directly.
    deposit: t.bigint().notNull(),

    // ── money ─────────────────────────────────────────────────────────────
    /// Tax realised out of deposits and not yet flushed to `recipient`.
    /// Drains to zero on `TaxCollected`.
    collectedTax: t.bigint().notNull(),
    /// Every wei of tax ever realised on this slot. Only grows — collecting
    /// drains the balance, not the history.
    taxPaidTotal: t.bigint().notNull(),
    /// Every wei ever flushed to the recipient.
    totalCollected: t.bigint().notNull(),
    /// Payouts that could not be pushed and became claimable credits. A
    /// non-zero value here means somebody's `receive()` or the currency itself
    /// refused a transfer — worth surfacing, because nothing on chain will.
    creditedTotal: t.bigint().notNull(),

    // ── deferred terms ────────────────────────────────────────────────────
    //
    // Two independent dimensions sharing one deferral, mirroring `Pending` in
    // SlotStorage exactly. The booleans are not redundant with the values:
    // a queued hook change TO the zero address means "detach the hook", which
    // is a real change somebody proposed, and is indistinguishable from "no
    // hook change queued" if you only look at `pendingHook`.
    pendingHasTax: t.boolean().notNull(),
    pendingTaxPercentage: t.bigint(),
    pendingHasHook: t.boolean().notNull(),
    pendingHook: t.hex(),
    pendingProposedAt: t.bigint(),

    // ── bookkeeping ───────────────────────────────────────────────────────
    createdAt: t.bigint().notNull(),
    createdTx: t.hex().notNull(),
    updatedAt: t.bigint().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
    factoryIdx: index().on(table.factory),
    hookIdx: index().on(table.hook),
    recipientIdx: index().on(table.recipient),
    occupantIdx: index().on(table.occupant),
  }),
);

/**
 * One account's relationship with one slot, accumulated across every tenure.
 */
export const accountSlot = onchainTable(
  "account_slot",
  (t) => ({
    account: t.hex().notNull(),
    slot: t.hex().notNull(),
    chainId: t.integer().notNull(),
    taxPaid: t.bigint().notNull(),
    /// Seconds held, summed over ENDED tenures. The current one is added when
    /// it ends, so an occupant sitting in a slot shows the time they held it
    /// BEFORE this tenure — add `now - lastOccupiedAt` for a live figure.
    holdTime: t.bigint().notNull(),
    /// When the current tenure began, or null when not occupying.
    lastOccupiedAt: t.bigint(),
    firstInteractedAt: t.bigint().notNull(),
    lastInteractedAt: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.account, table.slot] }),
    chainIdx: index().on(table.chainId),
  }),
);

/**
 * Repricing rights delegated by an occupant, for ONE tenure.
 *
 * The tenure is in the primary key because that is what the approval is scoped
 * to on chain: storage is `_operatorOf[tenureId][operator]`, and `isOperator`
 * answers for the current occupant only. An approval therefore EXPIRES SILENTLY
 * at the next seating — there is no revocation event, and nothing on chain
 * marks the row dead.
 *
 * So a row here is never "the operators of this slot". It is "the operators
 * approved during tenure N", and it stops meaning anything the moment tenure
 * N ends. Live approvals are exactly:
 *
 *     slotOperator.approved
 *       AND slotOperator.tenure = slot.tenureId
 *       AND slot.isOccupied
 *
 * All three conjuncts are load bearing. The tenure test is what expires an
 * approval at a hand-over; `isOccupied` is what expires it at a release or a
 * liquidation, which vacate the slot WITHOUT advancing the counter — the chain
 * gets the same answer from `isOperator`'s own `_occupant != address(0)` guard.
 *
 * A stale row is deliberately kept rather than deleted: it is the record that
 * this operator once acted for that occupant, and the pair (tenure, setBy)
 * says exactly whose authority it was.
 */
export const slotOperator = onchainTable(
  "slot_operator",
  (t) => ({
    slot: t.hex().notNull(),
    /// The tenure this approval belongs to, and dies with.
    tenure: t.bigint().notNull(),
    operator: t.hex().notNull(),
    chainId: t.integer().notNull(),
    approved: t.boolean().notNull(),
    /// The occupant who granted or revoked it. `setOperator` is `onlyOccupant`,
    /// so this is always the holder of `tenure`.
    setBy: t.hex().notNull(),
    updatedAt: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.slot, table.tenure, table.operator] }),
    chainIdx: index().on(table.chainId),
    // The lookup a client actually makes: this slot, this tenure.
    currentIdx: index().on(table.slot, table.tenure),
    approvedIdx: index().on(table.approved),
  }),
);

/**
 * A payout that could not be pushed, and is waiting to be claimed.
 *
 * Push-then-credit means this table is normally empty. A row in it is a
 * counterparty the slot could not pay: a contract that reverts on receipt, a
 * blocklisting currency, or an outgoing occupant whose `receive()` costs more
 * than the 30k stipend. `balance` is `withdrawableOf` on chain.
 */
export const slotCredit = onchainTable(
  "slot_credit",
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
    accountIdx: index().on(table.account),
  }),
);

/**
 * A signed sell order the buyer killed before it was filled.
 *
 * Only cancellations are visible. A nonce is ALSO burned when an order is
 * filled, but `Sold` carries no nonce, so an order book cannot tell a filled
 * order from a live one by watching logs — it has to call `orderUsed`. See the
 * note in src/slot.ts.
 */
export const cancelledOrder = onchainTable(
  "cancelled_order",
  (t) => ({
    slot: t.hex().notNull(),
    buyer: t.hex().notNull(),
    nonce: t.bigint().notNull(),
    chainId: t.integer().notNull(),
    cancelledAt: t.bigint().notNull(),
    tx: t.hex().notNull(),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.slot, table.buyer, table.nonce] }),
    chainIdx: index().on(table.chainId),
    buyerIdx: index().on(table.buyer),
  }),
);

// ──────────────────────────────────────────
// Event tables
//
// One per event the protocol emits, keyed `${txHash}-${logIndex}`. They are
// append-only and never updated: the current-state tables above are derived
// from them, and keeping both means a screen can show "what is true now"
// without paying for a replay, and "how it got there" without a second source.
// ──────────────────────────────────────────

export const slotCreatedEvent = onchainTable(
  "slot_created_event",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    factory: t.hex().notNull(),
    slot: t.hex().notNull(),
    recipient: t.hex().notNull(),
    /// `msg.sender` of `createSlot`, which is not necessarily `tx.from` — a
    /// collective or a router may create a slot on someone's behalf.
    creator: t.hex().notNull(),
    currency: t.hex().notNull(),
    /// Zero address when the slot has no hook.
    hook: t.hex().notNull(),
    /// Read back from the slot, not carried by the event. See `readSlotTerms`.
    taxPercentage: t.bigint().notNull(),
    minDepositSeconds: t.bigint().notNull(),
    mutableTax: t.boolean().notNull(),
    mutableHook: t.boolean().notNull(),
    manager: t.hex(),
    deployer: t.hex().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    tx: t.hex().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
    slotIdx: index().on(table.slot),
    creatorIdx: index().on(table.creator),
  }),
);

export const hookAttestedEvent = onchainTable(
  "hook_attested_event",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    factory: t.hex().notNull(),
    hook: t.hex().notNull(),
    attested: t.boolean().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    tx: t.hex().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
    hookIdx: index().on(table.hook),
  }),
);

/**
 * Admin handover on the factory.
 *
 * Worth its own table despite being rare: this key can `upgradeBeacon` and so
 * replace the code of every slot at once. A change here is the highest-signal
 * event the protocol emits.
 */
export const adminTransferredEvent = onchainTable(
  "admin_transferred_event",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    factory: t.hex().notNull(),
    /// Zero on the initialize-time emission.
    previousAdmin: t.hex().notNull(),
    newAdmin: t.hex().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    tx: t.hex().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
    factoryIdx: index().on(table.factory),
  }),
);

/** Every slot's code changed. */
export const beaconUpgradedEvent = onchainTable(
  "beacon_upgraded_event",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    factory: t.hex().notNull(),
    implementation: t.hex().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    tx: t.hex().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
    factoryIdx: index().on(table.factory),
  }),
);

/**
 * An occupancy transition.
 *
 * Every transition emits exactly one of these, INCLUDING a `sell` — which
 * emits `Sold` and then `Bought`, deliberately, so that anything watching
 * occupancy sees one vocabulary. `viaSell` distinguishes the two paths without
 * needing a second table, and is set by looking for the `Sold` row this
 * event's `sell` emitted immediately before it.
 */
export const boughtEvent = onchainTable(
  "bought_event",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    slot: t.hex().notNull(),
    currency: t.hex().notNull(),
    /// Seated. Not necessarily the payer: `buy(account, …)` lets one address
    /// pay and another occupy.
    buyer: t.hex().notNull(),
    /// The outgoing occupant. Zero when the slot was vacant.
    from: t.hex().notNull(),
    price: t.bigint().notNull(),
    deposit: t.bigint().notNull(),
    /// Paid to the outgoing occupant for the seat itself — their own declared
    /// price. Zero on a claim of a vacant slot.
    paid: t.bigint().notNull(),
    /// True when this transition came through `sell` rather than `buy`.
    viaSell: t.boolean().notNull(),
    /// The tenure this seating STARTED. Operator approvals carrying this
    /// number were granted by this buyer.
    tenure: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    tx: t.hex().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
    slotIdx: index().on(table.slot),
    buyerIdx: index().on(table.buyer),
  }),
);

/**
 * The seller's side of a `sell`.
 *
 * Always paired with a `boughtEvent` from the same transaction, one log later.
 * This row is NOT an occupancy transition of its own — counting both would
 * double every negotiated sale.
 */
export const soldEvent = onchainTable(
  "sold_event",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    slot: t.hex().notNull(),
    currency: t.hex().notNull(),
    seller: t.hex().notNull(),
    buyer: t.hex().notNull(),
    price: t.bigint().notNull(),
    deposit: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    tx: t.hex().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
    slotIdx: index().on(table.slot),
    sellerIdx: index().on(table.seller),
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

/**
 * An eviction for insolvency.
 *
 * No bounty column, because there is no bounty: the reward is that the slot is
 * now vacant and the liquidator can take it in the same `multicall`. `by` is
 * therefore usually — but not necessarily — the address that buys next.
 */
export const liquidatedEvent = onchainTable(
  "liquidated_event",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    slot: t.hex().notNull(),
    currency: t.hex().notNull(),
    /// Whoever called `liquidate`. Permissionless.
    by: t.hex().notNull(),
    occupant: t.hex().notNull(),
    /// How long the evicted tenure lasted, in seconds.
    heldFor: t.bigint().notNull(),
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

export const priceSetEvent = onchainTable(
  "price_set_event",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    slot: t.hex().notNull(),
    currency: t.hex().notNull(),
    /// The caller — the occupant, or one of their operators.
    by: t.hex().notNull(),
    /// The occupant on record, which is who the tax is actually charged to.
    occupant: t.hex().notNull(),
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
    /// Anyone may fund a slot, so this is not necessarily the occupant.
    by: t.hex().notNull(),
    amount: t.bigint().notNull(),
    total: t.bigint().notNull(),
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
    left: t.bigint().notNull(),
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
 * A settlement. Fires from every entry point, before anything else happens.
 *
 * Emitted even when `paid` is zero, so this is the high-frequency table by a
 * wide margin. `owed > paid` is the insolvency signal: the occupant's debt
 * exceeded what their deposit could cover, and `depositLeft` is then zero.
 */
export const settledEvent = onchainTable(
  "settled_event",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    slot: t.hex().notNull(),
    currency: t.hex().notNull(),
    owed: t.bigint().notNull(),
    paid: t.bigint().notNull(),
    depositLeft: t.bigint().notNull(),
    /// `owed > paid` — the deposit ran dry inside this settlement.
    insolvent: t.boolean().notNull(),
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
 * Tax actually taken from a deposit, attributed to the occupant who owed it.
 *
 * Only emitted when `paid > 0`, so it is the money-moved subset of
 * `settledEvent`. Anything reconstructing contributions from price × time
 * over-credits, because a dry occupant owes more than they pay.
 */
export const taxPaidEvent = onchainTable(
  "tax_paid_event",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    slot: t.hex().notNull(),
    currency: t.hex().notNull(),
    payer: t.hex().notNull(),
    owed: t.bigint().notNull(),
    paid: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    tx: t.hex().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
    slotIdx: index().on(table.slot),
    payerIdx: index().on(table.payer),
  }),
);

/** Accrued tax flushed to the recipient. No module fee is carved out of it. */
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
    recipientIdx: index().on(table.recipient),
  }),
);

/** A payout that failed and became claimable instead. */
export const creditedEvent = onchainTable(
  "credited_event",
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

export const claimedEvent = onchainTable(
  "claimed_event",
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

export const operatorSetEvent = onchainTable(
  "operator_set_event",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    slot: t.hex().notNull(),
    /// The occupant who set it — the only address allowed to.
    occupant: t.hex().notNull(),
    operator: t.hex().notNull(),
    allowed: t.boolean().notNull(),
    /// The tenure the approval was scoped to. Compare against `slot.tenureId`
    /// to tell whether it is still in force.
    tenure: t.bigint().notNull(),
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
 * Terms queued by the manager, landing at the next occupancy transition.
 *
 * `changeTax` / `changeHook` are what make this readable. The event carries
 * both `taxPercentage` and `hook` on every emission regardless of which one
 * the manager actually touched, so the value columns are only meaningful when
 * their flag is true.
 */
export const termsProposedEvent = onchainTable(
  "terms_proposed_event",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    slot: t.hex().notNull(),
    manager: t.hex().notNull(),
    changeTax: t.boolean().notNull(),
    changeHook: t.boolean().notNull(),
    /// Meaningful only when `changeTax`.
    taxPercentage: t.bigint().notNull(),
    /// Meaningful only when `changeHook`. Zero means "detach the hook".
    hook: t.hex().notNull(),
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
 * Queued terms landing.
 *
 * Reports the slot's FINAL values, including the dimension that did not
 * change — so unlike `termsProposedEvent` both columns are always true, and
 * `taxChanged` / `hookChanged` are computed here by diffing against the row.
 */
export const termsAppliedEvent = onchainTable(
  "terms_applied_event",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    slot: t.hex().notNull(),
    taxPercentage: t.bigint().notNull(),
    hook: t.hex().notNull(),
    previousTaxPercentage: t.bigint().notNull(),
    previousHook: t.hex().notNull(),
    taxChanged: t.boolean().notNull(),
    hookChanged: t.boolean().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    tx: t.hex().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
    slotIdx: index().on(table.slot),
  }),
);

export const orderCancelledEvent = onchainTable(
  "order_cancelled_event",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    slot: t.hex().notNull(),
    buyer: t.hex().notNull(),
    nonce: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    tx: t.hex().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
    slotIdx: index().on(table.slot),
    buyerIdx: index().on(table.buyer),
  }),
);

/**
 * An `after` callback reverted and was swallowed.
 *
 * The protocol's only observability into a broken hook. Nothing on chain
 * reverts, nothing retries, and the action the hook was watching succeeded
 * anyway — so if this is not indexed, a hook that stopped working is
 * completely silent.
 */
export const hookCallFailedEvent = onchainTable(
  "hook_call_failed_event",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    slot: t.hex().notNull(),
    hook: t.hex().notNull(),
    /// The 4-byte selector of the callback that failed, as hex.
    selector: t.hex().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    tx: t.hex().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
    slotIdx: index().on(table.slot),
    hookIdx: index().on(table.hook),
  }),
);
// ──────────────────────────────────────────
// Relations
//
// `many()` on `slot` is what lets a screen fetch a slot and its history in ONE
// query. Drizzle resolves a `many()` only when the child declares the inverse
// `one()`, hence the block of one-line child relations below. Filtering an
// event table directly by its foreign key still works and stays the right call
// for long, paginated lists.
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
  credits: many(slotCredit),
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
  attestations: many(hookAttestedEvent),
  adminTransfers: many(adminTransferredEvent),
  upgrades: many(beaconUpgradedEvent),
}));

export const hookRelations = relations(hook, ({ many }) => ({
  slots: many(slot),
  failures: many(hookCallFailedEvent),
  attestations: many(hookAttestedEvent),
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
  factoryRef: one(factory, {
    fields: [slot.factory],
    references: [factory.id],
  }),
  // Two columns, because `hook` is chain-scoped by primary key — the same
  // address on two chains is two deployments with possibly different
  // constructor arguments.
  hookRef: one(hook, {
    fields: [slot.hook, slot.chainId],
    references: [hook.id, hook.chainId],
  }),

  accountSlots: many(accountSlot),
  operators: many(slotOperator),
  credits: many(slotCredit),
  cancelledOrders: many(cancelledOrder),

  createdEvents: many(slotCreatedEvent),
  buys: many(boughtEvent),
  sales: many(soldEvent),
  releases: many(releasedEvent),
  liquidations: many(liquidatedEvent),
  priceChanges: many(priceSetEvent),
  deposits: many(depositedEvent),
  withdrawals: many(withdrawnEvent),
  settlements: many(settledEvent),
  taxPayments: many(taxPaidEvent),
  taxCollections: many(taxCollectedEvent),
  creditsIssued: many(creditedEvent),
  claims: many(claimedEvent),
  operatorChanges: many(operatorSetEvent),
  termsProposals: many(termsProposedEvent),
  termsApplications: many(termsAppliedEvent),
  orderCancellations: many(orderCancelledEvent),
  hookFailures: many(hookCallFailedEvent),
}));

export const slotOperatorRelations = relations(slotOperator, ({ one }) => ({
  slotRef: one(slot, { fields: [slotOperator.slot], references: [slot.id] }),
}));

export const slotCreditRelations = relations(slotCredit, ({ one }) => ({
  slotRef: one(slot, { fields: [slotCredit.slot], references: [slot.id] }),
  accountRef: one(account, {
    fields: [slotCredit.account],
    references: [account.id],
  }),
}));

export const cancelledOrderRelations = relations(cancelledOrder, ({ one }) => ({
  slotRef: one(slot, { fields: [cancelledOrder.slot], references: [slot.id] }),
}));

// ── event → parent inverses ─────────────────────────────────────────────────

export const slotCreatedEventRelations = relations(
  slotCreatedEvent,
  ({ one }) => ({
    slotRef: one(slot, {
      fields: [slotCreatedEvent.slot],
      references: [slot.id],
    }),
    factoryRef: one(factory, {
      fields: [slotCreatedEvent.factory],
      references: [factory.id],
    }),
  }),
);

export const hookAttestedEventRelations = relations(
  hookAttestedEvent,
  ({ one }) => ({
    factoryRef: one(factory, {
      fields: [hookAttestedEvent.factory],
      references: [factory.id],
    }),
    hookRef: one(hook, {
      fields: [hookAttestedEvent.hook, hookAttestedEvent.chainId],
      references: [hook.id, hook.chainId],
    }),
  }),
);

export const adminTransferredEventRelations = relations(
  adminTransferredEvent,
  ({ one }) => ({
    factoryRef: one(factory, {
      fields: [adminTransferredEvent.factory],
      references: [factory.id],
    }),
  }),
);

export const beaconUpgradedEventRelations = relations(
  beaconUpgradedEvent,
  ({ one }) => ({
    factoryRef: one(factory, {
      fields: [beaconUpgradedEvent.factory],
      references: [factory.id],
    }),
  }),
);

export const boughtEventRelations = relations(boughtEvent, ({ one }) => ({
  slotRef: one(slot, { fields: [boughtEvent.slot], references: [slot.id] }),
  buyerRef: one(account, {
    fields: [boughtEvent.buyer],
    references: [account.id],
  }),
}));

export const soldEventRelations = relations(soldEvent, ({ one }) => ({
  slotRef: one(slot, { fields: [soldEvent.slot], references: [slot.id] }),
  sellerRef: one(account, {
    fields: [soldEvent.seller],
    references: [account.id],
  }),
}));

export const releasedEventRelations = relations(releasedEvent, ({ one }) => ({
  slotRef: one(slot, { fields: [releasedEvent.slot], references: [slot.id] }),
  occupantRef: one(account, {
    fields: [releasedEvent.occupant],
    references: [account.id],
  }),
}));

export const liquidatedEventRelations = relations(
  liquidatedEvent,
  ({ one }) => ({
    slotRef: one(slot, {
      fields: [liquidatedEvent.slot],
      references: [slot.id],
    }),
    occupantRef: one(account, {
      fields: [liquidatedEvent.occupant],
      references: [account.id],
    }),
  }),
);

export const priceSetEventRelations = relations(priceSetEvent, ({ one }) => ({
  slotRef: one(slot, { fields: [priceSetEvent.slot], references: [slot.id] }),
}));

export const depositedEventRelations = relations(depositedEvent, ({ one }) => ({
  slotRef: one(slot, { fields: [depositedEvent.slot], references: [slot.id] }),
}));

export const withdrawnEventRelations = relations(withdrawnEvent, ({ one }) => ({
  slotRef: one(slot, { fields: [withdrawnEvent.slot], references: [slot.id] }),
}));

export const settledEventRelations = relations(settledEvent, ({ one }) => ({
  slotRef: one(slot, { fields: [settledEvent.slot], references: [slot.id] }),
}));

export const taxPaidEventRelations = relations(taxPaidEvent, ({ one }) => ({
  slotRef: one(slot, { fields: [taxPaidEvent.slot], references: [slot.id] }),
  payerRef: one(account, {
    fields: [taxPaidEvent.payer],
    references: [account.id],
  }),
}));

export const taxCollectedEventRelations = relations(
  taxCollectedEvent,
  ({ one }) => ({
    slotRef: one(slot, {
      fields: [taxCollectedEvent.slot],
      references: [slot.id],
    }),
    recipientRef: one(account, {
      fields: [taxCollectedEvent.recipient],
      references: [account.id],
    }),
  }),
);

export const creditedEventRelations = relations(creditedEvent, ({ one }) => ({
  slotRef: one(slot, { fields: [creditedEvent.slot], references: [slot.id] }),
  accountRef: one(account, {
    fields: [creditedEvent.account],
    references: [account.id],
  }),
}));

export const claimedEventRelations = relations(claimedEvent, ({ one }) => ({
  slotRef: one(slot, { fields: [claimedEvent.slot], references: [slot.id] }),
  accountRef: one(account, {
    fields: [claimedEvent.account],
    references: [account.id],
  }),
}));

export const operatorSetEventRelations = relations(
  operatorSetEvent,
  ({ one }) => ({
    slotRef: one(slot, {
      fields: [operatorSetEvent.slot],
      references: [slot.id],
    }),
  }),
);

export const termsProposedEventRelations = relations(
  termsProposedEvent,
  ({ one }) => ({
    slotRef: one(slot, {
      fields: [termsProposedEvent.slot],
      references: [slot.id],
    }),
  }),
);

export const termsAppliedEventRelations = relations(
  termsAppliedEvent,
  ({ one }) => ({
    slotRef: one(slot, {
      fields: [termsAppliedEvent.slot],
      references: [slot.id],
    }),
  }),
);

export const orderCancelledEventRelations = relations(
  orderCancelledEvent,
  ({ one }) => ({
    slotRef: one(slot, {
      fields: [orderCancelledEvent.slot],
      references: [slot.id],
    }),
    buyerRef: one(account, {
      fields: [orderCancelledEvent.buyer],
      references: [account.id],
    }),
  }),
);

export const hookCallFailedEventRelations = relations(
  hookCallFailedEvent,
  ({ one }) => ({
    slotRef: one(slot, {
      fields: [hookCallFailedEvent.slot],
      references: [slot.id],
    }),
    hookRef: one(hook, {
      fields: [hookCallFailedEvent.hook, hookCallFailedEvent.chainId],
      references: [hook.id, hook.chainId],
    }),
  }),
);
