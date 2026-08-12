---
"@0xslots/sdk": minor
---

**Breaking:** read from the ponder API instead of the subgraph.

Every read path now targets one ponder deployment. The subgraph package still
exists, but it is no longer what the SDK queries.

### Configuration

`SlotsClientConfig.subgraphUrl` → `apiUrl`, `subgraphApiKey` → `apiKey`.
`SUBGRAPH_URLS`, `STUDIO_SUBGRAPH_URLS`, `SubgraphSource`, `subgraphUrlFor` and
`SubgraphMeta` are gone; `DEFAULT_API_URL`, `LOCAL_API_URL` and `IndexerMeta`
replace them.

`chainId` changes meaning. It used to pick an endpoint — one subgraph per chain.
One ponder deployment holds every chain, so it is now a `where: { chainId }`
filter that the client merges into every list query. That merge is not optional:
omitting it does not fail, it silently returns rows from every chain at once,
which is worse than an error because it looks like a result.

### Result shape

Reads return `{ items, totalCount, pageInfo }` rather than a bare array.
Pagination is `limit` with either `offset` or the `after`/`before` cursors from
`pageInfo`; `first`/`skip` are gone, as is the subgraph's `block:` time-travel
argument, which ponder has no equivalent for.

Callers that iterated a response directly need `.items` — the failure mode is
`object is not iterable` at the call site.

### New surface

- `SlotsChain.ANVIL` (31337) for local development, with a `CHAIN_TOKENS` entry
  for the mintable `USDX` test token that `SeedLocal.s.sol` deploys.
- Feed types, now that feeds are indexed: metadata resolved from the URI rather
  than left null. The subgraph could not do this — File Data Sources fetch
  asynchronously and cannot write back to the entity that spawned them, so every
  IPFS-hosted feed had a null name and a `displayName` stuck on the on-chain one.
- Tax attribution, operators, policy updates and refunds, matching the events the
  contracts already emitted but nothing indexed.

### Fixed

`useSlotOnChain` no longer calls ERC-20 methods on `address(0)` for native-currency
slots. It did, and the failed reads fell back to `?? 6` decimals and `?? "USDC"` —
so half an ETH rendered as "500.00B USDC". Native slots now resolve through
`NATIVE_CURRENCY`, and formatting uses the token's real decimals.
