# @0xslots/ponder

The 0xSlots indexer. [Ponder](https://ponder.sh) watches `SlotFactory` and every
slot it deploys — plus AdLand, the collective factory and the slot-bound NFT
factory — and serves the result as GraphQL at `/graphql` (and `/sql/*` for
Ponder's SQL client). `@0xslots/sdk` exports the endpoints as `DEFAULT_API_URL`
and `LOCAL_API_URL`; its `SlotsClient` reads the chain directly.

Contract addresses and start blocks come from the versioned records in
`apps/contracts/deployments/<chainId>/`, or from env overrides
(`SLOTS_FACTORY_<CHAIN>`, `ADLAND_<CHAIN>`, …). A chain with neither indexes
nothing.

## Scripts

```bash
pnpm codegen      # regenerate ponder types
pnpm dev:index    # index against a local chain
pnpm serve        # serve the GraphQL API
pnpm start        # production entrypoint (scripts/start.sh)
pnpm typecheck
```

From the repo root, `pnpm dev:local` starts a chain, deploys the protocol and
runs this against it. The local API is `http://localhost:42069/graphql`, exported
as `LOCAL_API_URL` from the SDK.

## One deployment, every chain

A subgraph is one deployment per network. This is not: a single instance indexes
every configured chain into one database, so the chain is a `where: { chainId }`
filter on the query rather than a property of the endpoint.

That is the shape difference that matters most for consumers. An unfiltered list
query returns every chain's rows interleaved — a plausible-looking result that is
quietly wrong. Anything querying the endpoint must filter on `chainId`.

The API is served **unauthenticated**. There is no key.

## Schema

`ponder.schema.ts` is the source of truth. The shape differs from the subgraph it
replaced in four ways:

- Plural fields return `{ items, totalCount, pageInfo }`, not a bare list.
- Pagination is `limit` with `offset`, or the `after` / `before` cursors from
  `pageInfo`. No `first` / `skip`.
- Foreign keys are scalar columns; the joined row is the `*Ref` sibling —
  `module` is an address, `moduleRef` is the row.
- No `block:` argument. There is no time-travel query.

### Entities

| Entity | Notes |
| --- | --- |
| `slot` | Terms, the module and the scopes the slot accepted, live financials, and queued terms |
| `module` | A module contract: the scopes it declared, `slotCount`, `failedCallCount` |
| `account` | Protocol-wide totals. Has **no** `chainId` |
| `accountChain` | The same counters per chain — read this for any per-chain view |
| `currency` | Token metadata |
| `creative`, `adKey` | AdLand's current creative per slot, and its name registry |
| `slotCollective`, `collection`, `wrapper` | Collectives and slot-bound NFT collections |
| `*Event` | Immutable event rows, all carrying `chainId` |

`accountChain` exists because `account` cannot cheaply gain a `chainId`, and
without it a per-chain recipient list shows one chain's accounts with another
chain's counts. Its three counters are not interchangeable: `occupiedCount`
counts slots the account *occupies*, `slotCount` counts slots where it is the
*recipient*, and `occupiedAsRecipient` is the only honest numerator for an
occupancy percentage.

On `slot`, read the `pendingHas*` booleans (or `pendingMask`) to know what is
queued, never the value columns. The zero address is a real proposed value —
`pendingModule` = zero with `pendingHasModule` = true is a deliberately queued
"remove the module".

## Schema changes are breaking, in both directions

The indexer serves exactly one schema, and GraphQL rejects a whole document
containing an unknown field. So a renamed column does not degrade to a missing
field — it returns an **empty list**, and a table simply renders nothing.

Deploy this and its consumers together.

## Indexing status

```graphql
{ _meta { status } }
```

Keyed by chain, carrying the latest indexed block. There is no
`hasIndexingErrors` counterpart: ponder stops rather than serving stale rows
behind a flag, so an erroring indexer is a failed request, not a `true` here.
