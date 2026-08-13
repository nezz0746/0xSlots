# Migrating the read surface from the subgraph to Ponder

Status: planned, not started. The subgraph stays deployed and untouched throughout —
this is a swap of what the SDK points at, not a deletion.

Decisions taken: explorer is `apps/landing` (then `apps/api`, then `packages/mcp`);
feeds get indexed in Ponder for full parity; the policy registry and `ModuleCallFailed`
land after the migration, not before.

---

## Phase 0 — close the schema gap ✅ DONE (uncommitted)

> **Verified by running it.** `ponder dev` against base + base-sepolia: 0 errors,
> `SlotFactoryLegacy:SlotDeployed` climbing past 107, `SlotLegacy:Bought` 41 /
> `Settled` 31 / `Released` 2 / `Liquidated` 2, and the GraphQL API returning **103
> slots** where the previous config produced 2. Nested `many()` relations resolve
> (`slots { items { metadataUpdates { items { uri } } } }`).
>
> Not yet exercised by real data: `TaxPaid`, `OperatorSet`, `RefundCredited`,
> `RefundClaimed`, `PolicyUpdate*`. Those events only exist after the beacon upgrades
> (base 49494932, base-sepolia 44825297) and the backfill hadn't reached them. They
> typecheck and are registered; the local anvil stack (workstream B) is what will
> actually exercise them.

> **Baseline correction (re-verified against the working tree).** An earlier pass of
> this plan described Ponder as "at parity except two columns". That was measured
> against a working tree that no longer exists — `packages/ponder` was reverted to HEAD
> mid-session and the changes are not in the stash, the reflog, or any reachable or
> dangling git object. The numbers below are re-measured against what is actually on
> disk at `27fb24f`. Phase 0 is substantially bigger than first written.

Diff of `packages/subgraph/schema.graphql` (40 entities) against the **current**
`packages/ponder/ponder.schema.ts` (24 tables).

### 0a. Missing tables — 8

`taxPaidEvent`, `operatorSetEvent`, `slotOperator`, `policyUpdateProposedEvent`,
`policyUpdateAppliedEvent`, `refundCreditedEvent`, `refundClaimedEvent`, `slotRefund`.

The refund pair matters most: `_payOrCredit` credits `withdrawableOf` when a transfer
fails, and that's what keeps liquidation unconditional. Right now an outstanding credit
is invisible to the API.

### 0b. Missing handlers — 6

`Slot:TaxPaid`, `Slot:OperatorSet`, `Slot:RefundCredited`, `Slot:RefundClaimed`,
`Slot:PolicyUpdateProposed`, `Slot:PolicyUpdateApplied`.

Also: the pending-update handlers are duplicated across two generations —
`Slot:PendingUpdateApplied` / `Slot:PendingUpdateCancelled` alongside
`Slot:UpdateProposed` / `Slot:UpdateApplied` / `Slot:UpdateCancelled`, plus the older
`Slot:TaxUpdateProposed` / `Slot:ModuleUpdateProposed`. Pick one generation and delete
the rest before adding anything.

### 0c. Missing `slot` columns

`mutablePolicy`, `occupancyPolicy`, `isOccupied`, `occupiedSince`, `taxPaidTotal`, and
`slotDeployedEvent.mutablePolicy`. The pending-update columns are *ahead* of the
subgraph here (`pendingTaxPercentage`/`taxProposedAt`, `pendingUtility`/
`utilityProposedAt`, `pendingPolicy`/`policyProposedAt`) — keep that shape, it's better.

### 0d. The legacy `SlotDeployed` blindness is back

`ponder.config.ts` indexes only the current signature. As established earlier this
session by scanning both topic0s across full ranges: **64 slots on base and 237 on
base-sepolia were deployed under the pre-occupancy-layer signature, against exactly one
each under the current one — 301 of 303.** With only the current signature, Ponder
records two slots total, never registers the other 301 as `factory()` children so none
of their events index either, and the metadata pipeline silently no-ops because
`applyMetadataUpdate` returns early on a missing slot row.

Needs `SlotFactoryLegacy` + `SlotLegacy` sources against a hand-written legacy ABI, and
every slot handler registered against both. Two sources rather than one merged ABI,
because an overloaded event name makes `ponder.on` ambiguous.

### 0e. ERC721 still present

`nftCollection` / `nftToken` tables, `src/erc721.ts`, and the `ERC721SlotsFactory` /
`ERC721Slots` sources are all still wired in. Per the agreed scope these come out.

### 0f. No `many()` relations at all

The subgraph exposes `Slot.boughtEvents`, `.settlements`, `.metadataUpdates` etc. via
`@derivedFrom`, so the explorer gets them nested in one query. `ponder.schema.ts` has
`one()` relations only — every nested list becomes a second round trip. Add `many()` for
the event tables landing actually renders **before** rewriting queries, or the query
rewrite gets done twice.

### 0g. `taxPaidEvent.matchedOccupant`

The subgraph's tripwire for "payer disagreed with the occupant on record". Cheap to add
once `taxPaidEvent` exists, and worth keeping as an assertion.

### 0b. Feed indexing (the bulk of this phase)

Reverses the earlier "none of the other ones" call. Scope:

- **8 tables** — `feedHub`, `feed`, plus `feedCreatedEvent`, `feedNameUpdatedEvent`,
  `feedMetadataURIUpdatedEvent`, `feedRecipientUpdatedEvent`, `feedSlotAddedEvent`,
  `feedSlotRemovedEvent` — and a `feed` column on `slot`, written by the
  SlotAdded/SlotRemoved handlers.
- **3 new Ponder sources**: `FeedHub` (static address per chain), `Feed` (children
  derived from `FeedCreated` via `factory()`), and the FeedPostModule **V2**
  `MetadataUpdated(slot, updatedBy, uri)` overload.
- ⚠️ **The V2 overload is the `SlotDeployed` trap again.** It shares a name with the V1
  `MetadataUpdated(slot, uri)` the `MetadataModule` source already watches, but has a
  different topic0. It needs its own source with its own hand-written ABI, exactly like
  `abis/legacy.ts` — an overloaded event name makes `ponder.on` ambiguous otherwise.

**Ponder makes the IPFS side strictly better, and this is worth exploiting.** The
subgraph resolves feed metadata through File Data Sources, which are asynchronous and
*cannot write back to the `Feed` entity*. That's why `schema.graphql` carries the caveat
that `displayName` is always `onchainName` for any IPFS feed, and why `metadataName`,
`description`, `image`, `banner`, `externalLink` are null there — the file hadn't
arrived yet. A Ponder handler can just `await fetch(gateway)` inline and resolve all of
it deterministically in the same write. So: drop the `IpfsContent` indirection entirely,
populate the fields directly, and let `displayName` mean what it was supposed to mean.
Note this changes behaviour rather than porting it — worth a glance at how landing
renders feed names today.

**Mainnet has no FeedHub.** `config/base.json` is an explicit placeholder reusing the
base-sepolia address with the note that there's no code at it on mainnet, so it indexes
nothing. Feeds are base-sepolia-only in practice. Either omit the base source until the
hub ships or point it at a real address — do not copy the placeholder across, since a
Ponder source with a bad address is noisier than a subgraph one.

### 0c. Not ported — confirm still right

- `NFTCollection` / `NFTToken`.
- `TransferScheduledEvent` and the `Slot` epoch fields (`epochSeconds`, `pendingBuyer`,
  `pendingPrice`, `pendingDeposit`, `pendingEffectiveAt`) — the contracts no longer emit
  these after the epoch-scheduling removal.
- `SlotCreated` is declared in `ISlot.sol` but never emitted; `SlotFactory.emitEvent` /
  `SlotEvent` has no on-chain caller. Both dead — ignore.

**Don't port this subgraph bug:** `subgraph.yaml` never registered a
`PendingUpdateCancelled` handler, yet `schema.graphql` defines
`PendingUpdateCancelledEvent` and `Slot.pendingUpdateCancellations`. That entity has
never been written. Ponder already handles the event correctly.

### 0d. Housekeeping in the same pass

- `packages/ponder/src/erc721.ts` is back on disk (collateral from the config revert) —
  delete it and confirm it isn't imported from `src/index.ts`.
- `ponder.config.ts:80` — `console.log({ ALCHEMY_KEY })` prints the Alchemy key to
  stdout. Must go before anything reaches Railway logs.
- `packages/ponder/package.json` still carries `"generated": "workspace:*"` from the
  Envio detour.

---

## Phase 1 — SDK onto the Ponder API

Three shape changes drive the whole rewrite:

- **One endpoint, not one per chain.** The subgraph is one deployment per network, so
  the SDK keeps `SUBGRAPH_URLS: Record<SlotsChain, string>`. Ponder indexes base *and*
  base-sepolia into a single database with a `chainId` column on every table. That map
  collapses to one `url` plus `where: { chainId }` on every query — and the
  `SubgraphSource` enum (network vs studio) disappears entirely. Biggest simplification
  and the biggest breaking change.
- **Cursor pagination.** `first` / `skip` becomes `limit` / `after`, and every plural
  field returns `{ items, totalCount, pageInfo { hasNextPage, endCursor } }` — the shape
  you wanted. Anything doing offset math needs reworking, not renaming.
- **`_meta`.** Subgraph `_meta { block { number hash timestamp } hasIndexingErrors }` has
  no equivalent; Ponder exposes `_meta { status }`. `getMeta()` and anything gating on
  sync state get rewritten against that.

Order of work:

1. Point `codegen.yml` `schema:` at the Ponder endpoint (local `:42069/graphql` while
   iterating).
2. Rewrite `src/queries/*.graphql` — six files: `slots`, `accounts`, `accountSlots`,
   `events`, `factory`, `metadata`.
3. `pnpm codegen`, then rework `client.ts`: constructor/URL config, meta, pagination
   helpers, and the `chainId` filter threading through every read.
4. `src/modules/feed.ts` re-points at Ponder like everything else (phase 0b makes this
   possible) — no second GraphQL client, no legacy surface.
5. Cut a major. `hooks/`, `policies/`, `native.ts`, `tokens.ts` are write-path or pure
   and shouldn't move.

---

## Phase 2 — consumers ✅ DONE (uncommitted)

`apps/landing`, `apps/api` and `packages/mcp` are all on the ponder API and
typecheck clean.

The network/Studio switch was **deleted, not ported** — one endpoint means there is
nothing to choose. That removed `SubgraphSourceProvider`, the sidebar switch, and the
`withSource` query-key discriminator; server prefetch and client hydration now match by
construction rather than by keying the two deployments apart.

Shape changes that hit call sites: plural results became `{ items, totalCount, pageInfo }`,
`first`/`skip` became `limit`/`offset`, foreign keys split into a scalar column plus a
`*Ref` row (`module` is an address, `moduleRef` is the row), and `_meta` returns a
per-chain `status` blob instead of `{ block, hasIndexingErrors }`.

Relations added along the way, for parity with `@derivedFrom`: `currencyRef` on all 14
event/refund tables, `authorRef` on `metadataUpdatedEvent`, and `slotsAsRecipient` /
`slotsAsOccupant` on `account` (bounded pages, not unbounded lists).

Fixed in `packages/mcp` while passing through, unrelated to the indexer move — it had
not been updated after the occupancy-layer work: `buy()` was missing `account`,
`createSlot` was missing `mutablePolicy` and `occupancyPolicy`, and `updateMetadata`
was being called with two of its three arguments.

---

## Phase 3 — Railway ✅ DONE

Live at `https://0xslots-production.up.railway.app/graphql`, fully synced —
`/ready` 200, both chains at head.

**303 slots: 65 on base, 238 on base-sepolia.** That is the 301 legacy + 2 current
split predicted from the topic0 scan, confirmed on real data. Without the
`SlotFactoryLegacy` / `SlotLegacy` sources this endpoint would serve 2 slots.

The SDK now defaults to that URL (`DEFAULT_API_URL`), with `LOCAL_API_URL` for
chain 31337 and `NEXT_PUBLIC_PONDER_URL` as a per-branch override.

Two things bit on the way up, both now fixed in `ponder.config.ts`:

- **The RPC key was read under the wrong name.** The config wanted
  `ALCHEMY_API_KEY` while `turbo.json` and the deployment both use
  `ALCHEMY_KEY`; `?? ""` swallowed the miss and produced `.../v2/`, which
  Alchemy answers with "Must be authenticated!" — eight retries per chain,
  forever, reading like a provider outage. Both names are accepted now, full
  `PONDER_RPC_URL_*` URLs take priority, and a missing endpoint throws at boot
  naming the variable.
- `ponder start` refuses to run without `--schema`, which the root
  `start:ponder` script supplies from `DATABASE_SCHEMA`.

### Original notes

- Postgres service + a Ponder service off `packages/ponder`.
- Env: `DATABASE_URL`, and the RPC keys as real env vars — the config currently falls
  back to `""` when `ALCHEMY_API_KEY` is unset, which fails at request time rather than
  boot. Make it throw on missing.
- **Healthcheck must be `/ready`, not `/health`, with a generous timeout.** `/ready`
  only returns 200 once historical indexing finishes; two chains from the factory
  deployment blocks is not a 30-second backfill, and a short healthcheck will kill the
  first deploy mid-sync in a loop.
- Give it a stable `--schema` per deploy so a crash resumes instead of reindexing from
  scratch.
- Splitting `ponder start` (indexer) from `ponder serve` (read replicas) is a later
  optimisation, not day one.
- Last step: flip the SDK's default URL to the Railway domain and release.

---

## Phase 4 — additive, after the migration is green

Neither indexer has these today; they're gains, not parity, and were deliberately held
back so the SDK rewrite targets a schema that has stopped moving.

- **Policy registry.** `PolicyVerified` (SlotFactory) is indexed nowhere, so
  `slot.occupancyPolicy` is a bare address while `slot.module` resolves to a full
  `Module` with name/version/image/description. Mirror the `module` table and handler.
- **`ModuleCallFailed`.** The utility hook is fail-open — it swallows the revert and
  emits this. A module failing on every callback is currently invisible in both
  indexers. One table, no new source.
