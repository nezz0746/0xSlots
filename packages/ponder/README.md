# @0xslots/ponder

The 0xSlots indexer. [Ponder](https://ponder.sh) watches `SlotFactory` and every
slot it deploys, and serves the result as GraphQL. This is what `@0xslots/sdk`
reads.

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
query returns Base and Base Sepolia rows interleaved — a plausible-looking result
that is quietly wrong. `SlotsClient` merges the filter into every list query for
exactly this reason; anything querying the endpoint directly must do the same.

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
| `slot` | Terms, live financials, and the pending update per dimension |
| `account` | Protocol-wide totals. Has **no** `chainId` |
| `accountChain` | The same counters per chain — read this for any per-chain view |
| `currency` | Token metadata |
| `module` | Verified utilities, with `metadataURI` |
| `metadataSlot` | Per-slot metadata, plus resolved IPFS content |
| `*Event` | Immutable event rows, all carrying `chainId` |

`accountChain` exists because `account` cannot cheaply gain a `chainId`, and
without it a per-chain recipient list shows one chain's accounts with another
chain's counts. Its three counters are not interchangeable: `occupiedCount`
counts slots the account *occupies*, `slotCount` counts slots where it is the
*recipient*, and `occupiedAsRecipient` is the only honest numerator for an
occupancy percentage.

On `slot`, a `NULL` pending column means **nothing is queued**. It is not
interchangeable with the zero address, which is a real proposed value for both
address dimensions — "remove the utility" and "drop the occupancy policy" are
changes someone deliberately queued.

## Schema changes are breaking, in both directions

The indexer serves exactly one schema, and GraphQL rejects a whole document
containing an unknown field. So a renamed column does not degrade to a missing
field — it returns an **empty list**, and a table simply renders nothing.

Deploy this and publish the SDK together. The `moduleURI` → `metadataURI` rename
is the worked example.

## Indexing status

```graphql
{ _meta { status } }
```

Keyed by chain, carrying the latest indexed block. There is no
`hasIndexingErrors` counterpart: ponder stops rather than serving stale rows
behind a flag, so an erroring indexer is a failed request, not a `true` here.
