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
// behaviours points at one hook that implements all of them, so the indexer
// sees exactly one address and there is no tree to reconstruct.
//
// Two things follow from that and shape everything below:
//
//   1. `hook` is a first-class entity, not a column. It is shared across slots
//      (MinimumTenureHook is a stateless singleton — ONE deploy, every
//      duration, since the window is the slot's `hookData`),
//      and it carries a declared flag set. It wants a row of its own.
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
 * `admin` and `implementation` both live on this one contract,
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
    /// May upgrade the beacon and upgrade the factory.
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
 * that may differ in code or in constructor arguments, each with its own
 * declaration and its own slots. Merging the two rows would merge those facts.
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
    declaredBeforeSelfAssess: t.boolean().notNull(),
    declaredAfterBuy: t.boolean().notNull(),
    declaredAfterRelease: t.boolean().notNull(),
    declaredAfterLiquidate: t.boolean().notNull(),
    declaredAfterSettle: t.boolean().notNull(),
    /// Not a callback — a mode. `after` calls run uncapped and their revert
    /// propagates, so a slot attaching this hook is only as evictable as it is.
    declaredStrict: t.boolean().notNull(),
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
  }),
);

/**
 * A slot-bound NFT collection.
 *
 * Chain-scoped, and a plain contract rather than a proxy: an upgrade to the
 * factory changes what the NEXT collection is, so two collections on one chain
 * can be running different code. `factory` records which one made this.
 *
 * The terms are the collection's, fixed at deployment and shared by every slot
 * it mints — which is why they live here rather than being repeated per token.
 */
export const collection = onchainTable(
  "collection",
  (t) => ({
    id: t.hex().notNull(),
    chainId: t.integer().notNull(),
    factory: t.hex().notNull(),
    creator: t.hex().notNull(),

    name: t.text(),
    symbol: t.text(),
    maxSupply: t.bigint().notNull(),
    totalMinted: t.integer().notNull(),

    /// The terms every slot this collection mints is created with.
    currency: t.hex().notNull(),
    recipient: t.hex().notNull(),
    taxBps: t.bigint(),
    minDepositSeconds: t.bigint(),
    /// Zero when the rent is fixed forever.
    manager: t.hex(),
    /// Holds the metadata, and nothing else.
    owner: t.hex(),
    baseURI: t.text(),

    createdAt: t.bigint().notNull(),
    updatedAt: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.id, table.chainId] }),
    chainIdx: index().on(table.chainId),
    factoryIdx: index().on(table.factory),
    creatorIdx: index().on(table.creator),
  }),
);

/**
 * One token, and the slot it follows.
 *
 * `owner` is mirrored from the slot rather than derived at read time: the token
 * IS the occupancy, so a query for "what does this account hold" would
 * otherwise have to join every slot in the collection.
 */
export const collectionToken = onchainTable(
  "collection_token",
  (t) => ({
    id: t.text().primaryKey(), // `${chainId}:${collection}:${tokenId}`
    chainId: t.integer().notNull(),
    collection: t.hex().notNull(),
    tokenId: t.bigint().notNull(),
    /// The slot whose occupancy this token follows. One per token, for ever.
    slot: t.hex().notNull(),
    /// Whoever occupies that slot. The collection itself while vacant.
    owner: t.hex().notNull(),
    minter: t.hex().notNull(),
    mintedAt: t.bigint().notNull(),
    updatedAt: t.bigint().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
    collectionIdx: index().on(table.collection),
    ownerIdx: index().on(table.owner),
    slotIdx: index().on(table.slot),
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
    taxBps: t.bigint().notNull(),
    /// Minimum runway, in seconds, a buyer must fund. Zero means no minimum.
    minDepositSeconds: t.bigint().notNull(),
    mutableTax: t.boolean().notNull(),
    mutableHook: t.boolean().notNull(),

    // ── the hook, and the flags THIS SLOT obeys ───────────────────────────
    /// NULL when the slot has no hook at all — which is the plain Harberger
    /// slot, and a perfectly ordinary configuration rather than a gap.
    hook: t.hex(),
    /// This slot's configuration FOR THAT HOOK, 32 bytes, handed back on every
    /// callback. Opaque here — only the hook knows what it means. A
    /// minimum-tenure window lives here, which is why one hook deployment can
    /// serve every duration. NULL when there is no hook.
    hookData: t.hex(),
    /// Snapshotted when the hook was attached and never re-read, so a hook
    /// cannot widen its own reach mid-tenure. Compare against the `declared*`
    /// columns on `hook` to see whether it has since tried.
    hookBeforeBuy: t.boolean().notNull(),
    hookBeforeSelfAssess: t.boolean().notNull(),
    hookAfterBuy: t.boolean().notNull(),
    hookAfterRelease: t.boolean().notNull(),
    hookAfterLiquidate: t.boolean().notNull(),
    hookAfterSettle: t.boolean().notNull(),
    /// The one flag that changes what the SLOT promises rather than what the
    /// hook hears about. Snapshotted like the rest: a hook cannot become strict
    /// under a sitting occupant.
    hookStrict: t.boolean().notNull(),

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
    pendingTaxBps: t.bigint(),
    pendingHasHook: t.boolean().notNull(),
    pendingHook: t.hex(),
    /// Queued alongside `pendingHook` and only meaningful with it — the
    /// contract proposes the two under one flag, because a hook and the word
    /// meant for it are one decision.
    pendingHookData: t.hex(),
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
    /// How many creatives this account has published into this slot.
    ///
    /// A count and not a join, because it is asked for in a leaderboard beside
    /// `taxPaid` — one row per advertiser, ordered — and counting publishes at
    /// read time would mean scanning the history once per row.
    publishCount: t.integer().notNull(),
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

/**
 * What a slot is showing right now.
 *
 * ── Why this is a table and not a column on `slot` ──────────────────────────
 *
 * Because the creative belongs to the HOOK, not to the slot. A slot's row is
 * assembled from the core protocol's own events, and every column on it is
 * something `Slot` emits; a creative is one hook's idea of what a slot is for,
 * and AdLand is one hook among however many people write. Putting `uri` on
 * `slot` would make the core schema carry a field that is null for every slot
 * running any other hook — and would have to grow another for the next hook
 * that stores something.
 *
 * ── Why `tenureId` is stored beside the URI ─────────────────────────────────
 *
 * The contract keys a creative by the tenure it was published in and treats a
 * stale one as absent, so `AdLand.creativeOf` returns "" once the slot changes
 * hands even though the string is still in storage. Storing the tenure here
 * lets a reader make the same judgement, and makes the case visible rather than
 * silently blank: a row whose `tenureId` is behind the slot's is a creative
 * that HAS been cleared, which is different from one that was never set.
 */
export const creative = onchainTable(
  "creative",
  (t) => ({
    slot: t.hex().notNull(),
    chainId: t.integer().notNull(),
    /// The hook holding it. A slot may be repointed, and then this is the
    /// contract that answered when it was last published to.
    hook: t.hex().notNull(),
    /// Empty after a clear. Not deleted — see `clearedAt`.
    uri: t.text().notNull(),
    /// The tenure this creative was published in.
    tenureId: t.bigint().notNull(),
    /// The occupant at the moment of publishing, as this indexer had it.
    publisher: t.hex(),
    /// Null while a creative is showing; set when a buy or release clears it.
    clearedAt: t.bigint(),
    publishCount: t.integer().notNull(),
    firstPublishedAt: t.bigint().notNull(),
    updatedAt: t.bigint().notNull(),
  }),
  (table) => ({
    // Keyed on the slot alone, matching `slot.id` and every other slot-keyed
    // table here. A slot address is treated as globally unique in this schema
    // — one row per deployed proxy, whatever chain it is on — and a creative
    // keyed differently could not join to it.
    pk: primaryKey({ columns: [table.slot] }),
    chainIdx: index().on(table.chainId),
    hookIdx: index().on(table.hook),
    publisherIdx: index().on(table.publisher),
  }),
);

/**
 * Every creative ever published, which is the history a publisher asks for.
 *
 * `uri` is stored whole rather than hashed or resolved. AdLand's creatives are
 * a few hundred bytes and travel inline as `data:` URIs precisely so no gateway
 * sits on the render path; storing the string means the history needs no
 * gateway either, and a creative whose IPFS pin has lapsed is still readable
 * here as what was published.
 */
export const publishedEvent = onchainTable(
  "published_event",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    slot: t.hex().notNull(),
    hook: t.hex().notNull(),
    uri: t.text().notNull(),
    tenureId: t.bigint().notNull(),
    /// The occupant at the moment of publishing. Null when this indexer has no
    /// row for the slot — a slot created before its factory's start block.
    publisher: t.hex(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    tx: t.hex().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
    slotIdx: index().on(table.slot),
    publisherIdx: index().on(table.publisher),
  }),
);

/**
 * A creative going blank because the slot changed hands.
 *
 * Emitted by the hook's `afterBuy`, `afterRelease` and `afterLiquidate`, and
 * worth its own table rather than being inferred from `boughtEvent`: whether a
 * buy actually cleared anything depends on whether a creative was showing, and
 * that is the hook's answer, not something to recompute from the core's events.
 */
export const clearedEvent = onchainTable(
  "cleared_event",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    slot: t.hex().notNull(),
    hook: t.hex().notNull(),
    fromTenure: t.bigint().notNull(),
    toTenure: t.bigint().notNull(),
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
 * AdLand's name registry: what each key resolves to.
 *
 * A publisher embeds `<adland-slot name="ethereum">` rather than an address,
 * because a pasted address lives in HTML nobody can reach again — redeploy the
 * slot and every page carrying it shows a dead space forever. The key is the
 * indirection that fixes that, and this table is what makes the set of them
 * listable: `slotOf` is a mapping, and a mapping cannot be enumerated on chain.
 *
 * Keys are claimed permissionlessly at creation (first come, first served on an
 * unclaimed key) and repointed by their holder or the contract owner, so the
 * set grows without anybody curating it. That is precisely why it needs
 * indexing — nothing else can answer "which names exist".
 *
 * `owner` is deliberately absent. `SlotSet` carries the key, the previous slot
 * and the new one, but not who claimed it, and the two ways to infer it are
 * both wrong: `transaction.from` is the sender rather than the claimant
 * whenever a contract or multisig calls, and a `keyOwner` read per event adds
 * an RPC round trip to serve a column no listing needs. Read it on chain from
 * a detail view, where one call is cheap and correct.
 */
export const adKey = onchainTable(
  "ad_key",
  (t) => ({
    /// The `bytes32` key. Short names are ASCII, so they read back directly.
    key: t.hex().notNull(),
    chainId: t.integer().notNull(),
    /// The AdLand deployment holding it — one per chain, but stored rather
    /// than assumed, so a second one does not silently merge into the first.
    hook: t.hex().notNull(),
    /// What it resolves to right now.
    slot: t.hex().notNull(),
    /// A queued repoint, waiting out `CHANGE_DELAY`. Null when none.
    pendingSlot: t.hex(),
    pendingReadyAt: t.bigint(),
    /// How many times this key has been pointed somewhere. One means it is
    /// still on its original claim.
    setCount: t.integer().notNull(),
    claimedAt: t.bigint().notNull(),
    updatedAt: t.bigint().notNull(),
  }),
  (table) => ({
    // Per chain: the same name on base and base-sepolia are different keys
    // pointing at different slots, and merging them would resolve an embed to
    // the wrong network's space.
    pk: primaryKey({ columns: [table.key, table.chainId] }),
    chainIdx: index().on(table.chainId),
    slotIdx: index().on(table.slot),
  }),
);

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
    /// The hook's configuration at creation. Read back from the slot.
    hookData: t.hex().notNull(),
    /// Read back from the slot, not carried by the event. See `readSlotTerms`.
    taxBps: t.bigint().notNull(),
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
 * both `taxBps` and `hook` on every emission regardless of which one
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
    taxBps: t.bigint().notNull(),
    /// Meaningful only when `changeHook`. Zero means "detach the hook".
    hook: t.hex().notNull(),
    /// Meaningful only when `changeHook`, and always zero when `hook` is —
    /// detaching takes the configuration with it.
    hookData: t.hex().notNull(),
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
    taxBps: t.bigint().notNull(),
    hook: t.hex().notNull(),
    hookData: t.hex().notNull(),
    previousTaxPercentage: t.bigint().notNull(),
    previousHook: t.hex().notNull(),
    previousHookData: t.hex().notNull(),
    taxChanged: t.boolean().notNull(),
    hookChanged: t.boolean().notNull(),
    /// Separate from `hookChanged`, because re-proposing the SAME hook with new
    /// configuration is now the only way to change a window — and it leaves the
    /// address untouched, so a consumer diffing on `hookChanged` alone sees
    /// nothing happen.
    hookDataChanged: t.boolean().notNull(),
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
 * A queued proposal retracted, per dimension.
 *
 * `cancelTerms` takes the same two flags `proposeTerms` does, which is what
 * lets a collective's tax manager and hook manager retract their own work
 * without destroying each other's — so the flags here say WHICH dimension was
 * dropped, and a row with only one of them true is the normal case rather than
 * a partial write.
 *
 * The slot's event carries no canceller: `cancelTerms` is `onlyManager`, so
 * the manager is the slot's own column, and when that manager is a collective
 * the actual role holder is in `collectiveActionEvent.by` and nowhere else.
 */
export const termsCancelledEvent = onchainTable(
  "terms_cancelled_event",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    slot: t.hex().notNull(),
    /// The slot's manager at the time. The only party allowed to emit this.
    manager: t.hex().notNull(),
    cancelTax: t.boolean().notNull(),
    cancelHook: t.boolean().notNull(),
    /// What was dropped, captured before the pending columns were cleared —
    /// otherwise a retraction leaves no record of what it retracted.
    cancelledTaxPercentage: t.bigint(),
    cancelledHook: t.hex(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    tx: t.hex().notNull(),
  }),
  (table) => ({
    chainIdx: index().on(table.chainId),
    slotIdx: index().on(table.slot),
  }),
);

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
  adminTransfers: many(adminTransferredEvent),
  upgrades: many(beaconUpgradedEvent),
}));

export const hookRelations = relations(hook, ({ many }) => ({
  slots: many(slot),
  failures: many(hookCallFailedEvent),
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

/**
 * A key points AT a slot, and the join has to be chain-scoped like the rest —
 * the same name on two chains is two keys resolving to two different spaces.
 */
export const adKeyRelations = relations(adKey, ({ one }) => ({
  slotRef: one(slot, {
    fields: [adKey.slot],
    references: [slot.id],
  }),
  /// What that slot is currently showing, so one query answers "the ad behind
  /// this name" — which is the whole reason a publisher embeds a name.
  creativeRef: one(creative, {
    fields: [adKey.slot],
    references: [creative.slot],
  }),
}));

export const creativeRelations = relations(creative, ({ one, many }) => ({
  slotRef: one(slot, {
    fields: [creative.slot],
    references: [slot.id],
  }),
  adKeys: many(adKey),
}));

export const publishedEventRelations = relations(publishedEvent, ({ one }) => ({
  slotRef: one(slot, {
    fields: [publishedEvent.slot],
    references: [slot.id],
  }),
}));

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

export const termsCancelledEventRelations = relations(
  termsCancelledEvent,
  ({ one }) => ({
    slotRef: one(slot, {
      fields: [termsCancelledEvent.slot],
      references: [slot.id],
    }),
  }),
);

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

  // A slot names two addresses, and a SlotCollective can be BOTH of them. Each
  // link resolves to null when the address is an ordinary EOA, which is the
  // common case — these say "governed by / paid to a collective", not "has
  // one". Distinct relationNames because a slot may point at the same
  // collective twice, for different reasons.
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

  // Many, not one. Nothing stops two names resolving to the same space —
  // "ethereum" and "eth" are separate claims — so a slot carries a list of the
  // keys pointing at it rather than a name of its own.
  adKeys: many(adKey),

  accountSlots: many(accountSlot),
  operators: many(slotOperator),
  credits: many(slotCredit),
  cancelledOrders: many(cancelledOrder),

  createdEvents: many(slotCreatedEvent),
  buys: many(boughtEvent),
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
  termsCancellations: many(termsCancelledEvent),
  hookFailures: many(hookCallFailedEvent),
}));

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

// ═══════════════════════════════════════════════════════════
// COLLECTIVES
// ═══════════════════════════════════════════════════════════
//
// A SlotCollective fills BOTH of a slot's named addresses at once: `recipient`
// (tax flows to it) and `manager` (it may propose tax and hook changes).
// Indexed here so those two columns on `slot` stop being opaque addresses and
// become a join — "who governs this slot, and who actually gets paid".
//
// Split membership and role membership are the two things unavailable on-chain
// without replaying logs: `splitHash` is a hash, and AccessControl keeps no
// enumerable member list. Both are reconstructed below.
//
// ── What the port to the hook-based Slot changed here ──────────────────────
//
// TWO manager roles, not three. `UTILITY_MANAGER_ROLE` is gone with the
// utility head it governed; a hook is the old policy and the old utility
// unified, and `POLICY_MANAGER_ROLE` is the identifier that survived. So
// wherever this schema says "policy", read HOOK — the label is preserved
// deliberately (renaming a `keccak256` constant would move the role on every
// live collective) and only the meaning moved.
//
// The relay events narrowed with it: `Dimension` has two members where
// `UpdateKind` had three, and `LiquidationBountyRelayed` is gone entirely
// along with the bounty. `collectiveActionEvent.kind` is therefore
// "Tax" | "Hook", and its `action` no longer has a "bounty" value.

export const slotCollective = onchainTable(
  "slot_collective",
  (t) => ({
    id: t.hex().primaryKey(),
    chainId: t.integer().notNull(),
    /// DEFAULT_ADMIN_ROLE holder at deployment. Roles can move afterwards —
    /// `collectiveRole` is the live answer, this is only the founding one.
    admin: t.hex().notNull(),
    deployer: t.hex().notNull(),
    /// Mirrors the on-chain `splitHash`, read back from the collective at the
    /// block of the `SplitUpdated` that set it. The event carries the Split
    /// struct but not its hash, and the hash is what the contract checks a
    /// `distribute` against — so it is read rather than recomputed, and null
    /// when the read did not answer.
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
    /// keccak of the role name. Resolved to a label in `label` where known.
    role: t.hex().notNull(),
    account: t.hex().notNull(),
    chainId: t.integer().notNull(),
    granted: t.boolean().notNull(),
    /// Human-readable role name where the hash is one of the known ones.
    /// "POLICY_MANAGER" is the HOOK role — see the section note. Null for any
    /// role added later, rather than a guess.
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
/// @dev The reason this table can exist at all: the slot's own `TermsProposed`
///      and `TermsCancelled` carry NO actor, and `transaction.from` is wrong
///      whenever the role holder is a Safe or the call is bundled. `by` here is
///      the actual role holder, which is recoverable from nowhere else.
///
///      Join to the slot side on `tx` — one relay produces exactly one
///      `TermsProposed`/`TermsCancelled` on the slot in the same
///      transaction, so `collectiveActionEvent` supplies the WHO and the slot's
///      own tables supply the WHAT.
export const collectiveActionEvent = onchainTable(
  "collective_action_event",
  (t) => ({
    id: t.text().primaryKey(),
    collective: t.hex().notNull(),
    chainId: t.integer().notNull(),
    slot: t.hex().notNull(),
    by: t.hex().notNull(),
    /// "propose" | "cancel" | "cancelAll". The old "bounty" value went with
    /// `LiquidationBountyRelayed`.
    action: t.text().notNull(),
    /// "Tax" | "Hook" — null for cancelAll, which reaches across both.
    /// `Dimension` is positional across the ABI boundary, so an unrecognised
    /// ordinal stays null rather than being guessed at.
    kind: t.text(),
    /// Raw basis points for Tax, the left-padded address for Hook. Left as the
    /// widened bytes32 the event carries; null on every cancel, which carries
    /// no value.
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
    byRef: one(account, {
      fields: [collectiveActionEvent.by],
      references: [account.id],
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
