# @0xslots/sdk

## 0.22.0

### Minor Changes

- 27fb24f: Choose which subgraph deployment to read with a flag rather than a URL.

  `SubgraphSource` is a new export — `Network` for the decentralized network through `gateway.thegraph.com`, `Studio` for the development deployment. `SlotsClientConfig` takes it as `subgraphSource`, and `subgraphUrlFor(chainId, source)` resolves one to an endpoint. The Studio endpoints ship here as `STUDIO_SUBGRAPH_URLS`, alongside the gateway ones that were already exported.

  Studio exists in this package because of a gap the gateway has: a freshly published subgraph is not served there until an indexer allocates to it and syncs from `startBlock` — hours for these — and until then the gateway answers `subgraph not found: no allocations`. Studio serves a deployment as soon as it has indexed, so it is how a mapping or schema change gets exercised before the network catches up. It is rate-limited and a development surface; the default is unchanged and nothing switches to it on its own.

  Both endpoint maps living together is the point. The Studio slugs are NOT symmetrical — `0-xslots-base` but `0-x-slots-base-sepolia` — and cannot be derived from the chain, so every consumer that hand-wrote them was one transcription away from a silent failure: Studio answers an unknown slug with HTTP 200 and a `{"message":"Not found"}` body, which no status check catches. Consumers now carry a two-value flag instead of a pair of URLs.

  `subgraphApiKey` is withheld when this client resolves a Studio endpoint itself. The key authenticates against the gateway and is meaningless to Studio, so sending it would put a gateway credential in a request that has no use for it. An explicit `subgraphUrl` still receives the key — the caller named that endpoint and this package cannot tell what it is.

  `subgraphUrl` is unchanged and still wins over `subgraphSource`, so a local graph-node or a pinned deployment ID works exactly as before.

## 0.21.0

### Minor Changes

- 0d4fc48: Address a slot's three pending updates one at a time, and finish the utility rename on the read and write paths.

  `UpdateKind` is a new export — `Tax`, `Utility`, `Policy`, numbered to match the Solidity enum. It is the argument to `cancelPendingUpdate(slot, kind)`, which retracts one queued change and leaves the others standing. `cancelPendingUpdates(slot)` still exists and still drops all three; prefer the singular unless clearing everyone's queued work is genuinely what you mean. `useSlotAction` exposes both, and labels each cancel per dimension so a pending spinner lands on the row that is actually in flight rather than on all three at once.

  `proposePolicyUpdate(slot, newPolicy)` is new. The occupancy policy has been proposable on-chain since policies existed, but this client never offered it, so the one update that decides whether a slot can be taken from you was unreachable through the SDK. `proposeUtilityUpdate` joins it as the canonical name for `proposeModuleUpdate`, which is deprecated and now forwards to the same place.

  `SlotOnChain` gains `taxProposedAt`, `utilityProposedAt` and `policyProposedAt`. A `has*` flag says only THAT something is queued; these say how long it has been true, which is what separates a change queued last week from one queued against a transaction that is already in flight. Zero alongside a set flag means the slot predates the contract recording it — read the pair, never the timestamp alone.

  **Renames, with a bridge.** `SlotOnChain.module`, `mutableModule`, `hasPendingModule` and `pendingModule` are now `utility`, `mutableUtility`, `hasPendingUtility` and `pendingUtility`. The old names remain as deprecated aliases filled from the same source, mirroring the deprecated `module()` and `mutableModule()` getters the contract itself still ships, so existing code keeps working for one release.

  The write path could not be bridged with an alias, and this is worth knowing even if you never touched these types. `SlotConfig` and `SlotInitParams` are encoded by viem BY COMPONENT NAME, and both this package and the checked-in ABIs still used `mutableModule` / `module` after the contracts had renamed those components. The two were wrong in the same direction, so they agreed with each other and disagreed with the chain; correcting either one alone would have started silently creating slots with a zero utility and a dropped `mutablePolicy` flag. `createSlot` and `createSlots` now build the tuple explicitly through a normaliser that accepts either spelling, so a caller on the old names is unaffected and a missing field is a type error here rather than a zero address on-chain.

  **This version requires the upgraded `Slot` implementation.** `getSlotInfo` grew three fields, and reading a slot that has not been upgraded does not throw — because the tuple carries strings, the three extra reads land on tail bytes and return plausible-looking garbage for the timestamps while every other field decodes correctly. Base and Base Sepolia are both upgraded; point this at a fork or a chain that is not, and pending-update timestamps are meaningless rather than absent.

### Patch Changes

- Updated dependencies [0d4fc48]
  - @0xslots/contracts@0.18.0

## 0.20.1

### Patch Changes

- Updated dependencies [4c4a412]
  - @0xslots/contracts@0.17.0

## 0.20.0

### Minor Changes

- ea74fab: Offer native ETH as a slot currency, and pay for native slots by value rather than by approval.

  `NATIVE_CURRENCY`, `NATIVE_CURRENCY_ADDRESS` and `isNativeCurrency` are new exports. The sentinel is `address(0)`, which is sound rather than arbitrary: `Slot.initialize` rejected it outright before native support existed, so no slot predating that change can be holding it. `isNativeCurrency` accepts `undefined` deliberately — every call site in an app holds a possibly-unloaded address, and making each one guard separately is how one gets missed.

  ETH is appended last on both Base chains rather than inserted first, the same rule already applied to WETH: `getDefaultToken` returns index 0, so USDC stays the default and an untouched create form still produces exactly the slot it did before.

  Writes are the substantive change. `buy` and `topUp` both routed through a single private helper that read the slot's currency and approved it — which reverts against `address(0)`, so every native write failed. That helper now branches: native attaches `value` and never reads or grants an allowance, while the ERC-20 arm is unchanged, post-approval polling for node lag included. `buy` needed no new arithmetic, since the price-plus-deposit figure it already computed for the approval is exactly the `msg.value` the contract requires. The helper is renamed `withPayment`, having stopped being about allowances; it is private, so nothing downstream moves.

  `VouchedPolicy` gains `superseded`. Redeploying the price policy factory left the two mainnet USDC floors derivable no longer — the current factory predicts different addresses, so the provenance check correctly refuses them — while the slots using them still need a label. Marking them keeps `getVouchedPolicy` naming them and drops them from `vouchedPoliciesForChain` and `searchVouchedPolicies`, so a picker is not offered the same floor twice at two addresses.

  The package also gains its first tests. They cover only the payment branch, which is the one place a silent mistake sends real funds the wrong way and the one place neither the type checker nor any other check in the repo can see.

### Patch Changes

- Updated dependencies [ea74fab]
  - @0xslots/contracts@0.16.0

## 0.19.0

### Minor Changes

- 6ec2208: Offer WETH as a slot currency on Base and Base Sepolia, and name each token's logo.

  `WETH` is the OP-stack predeploy at `0x4200000000000000000000000000000000000006` — the same address on both chains. It is appended last on each chain rather than inserted first, so `getDefaultToken` keeps returning USDC (and Feed USDC on testnet) and an untouched create form still produces exactly the slot it did before.

  It is also the first 18-decimal currency the protocol has offered. Nothing needed changing for that — a price floor already converts with the selected token's own decimals, and `MinimumPricePolicy` reverts `WrongCurrency` on a mismatched pairing — but the path now actually gets exercised rather than only ever seeing 6-decimal USDC.

  `TokenInfo` gains an optional `logo` holding a slug (`"usdc"`, `"weth"`) rather than a URL or a path. This package is published and has more than one consumer: a path would encode one app's asset layout into shared data, and a URL would put a third-party host into every consumer's render path.

## 0.18.1

### Patch Changes

- 8d11d57: Wire up the Base mainnet policy factories.

  `MinimumTenurePolicyFactory` at `0xE322cDADB8fd511788F0fA25BffD794b7A946125` and `MinimumPricePolicyFactory` at `0xF1cA0Fe72269AaEf1E5e34bfF484269f18e1b777`, added to the per-chain maps and to `POLICY_FACTORIES` so `resolvePolicy` can verify against them.

  Without these the SDK could not even address a policy factory on mainnet, so choosing a minimum tenure on the create form threw before building a transaction.

  The five starter policies they deployed — 1h/1d/7d tenures and $1/$10 USDC floors — are listed as vouched so the "Verified policy" picker has something to offer on mainnet. All five are derivable on-chain and do not need the entries to be named; this is the editorial list, not a naming fallback.

  `VouchedPolicy` gains optional `minPrice` and `currency`, and `resolvePolicy` forwards them. It checks the vouched list first and returns without touching the network, so a listed policy previously came back thinner than the same policy derived — losing exactly the fields a price floor is made of.

- 33a9279: Report pre-flight failures in the policy create flows instead of failing silently.

  `createSlotWithTenure` and `createSlotWithPriceFloor` read the policy factory before offering any transaction — to predict the CREATE2 address and check whether that policy already exists. Those reads sat outside `exec`, the only place with a `catch` and an `onError`, and the call site does not await the returned promise. So on a chain with no policy factory deployed the read threw into an unhandled rejection: the Create button stayed enabled, clicking it did nothing, and no error appeared anywhere.

  Both now route through a `preflight` helper that reports through `onError` exactly as a failed transaction does. A chain without a policy factory is a configuration fact worth stating, not a mystery.

- Updated dependencies [8d11d57]
  - @0xslots/contracts@0.15.1

## 0.18.0

### Minor Changes

- df9932d: Occupancy policies, and a resolver that only names a policy it can actually vouch for.

  **New `policies` module.** `resolvePolicy`, `getVouchedPolicy`, `vouchedPoliciesForChain`, `searchVouchedPolicies`, plus the `ResolvedPolicy`, `VouchedPolicy`, `VouchedPolicyEntry`, `PolicyKindId` and `PolicyImpact` types.

  The raw registry is deliberately **not** exported. Resolution walks `IPolicyFactory.verify()` on each known factory, so a policy's name is a claim the chain confirms rather than a lookup in a hardcoded table. Two consequences worth knowing: a policy made by a superseded factory resolves to its bare address — the honest answer, not a bug — and every accessor is chain-scoped, because without that a Sepolia policy would have been confidently named on mainnet.

  **New client methods** for the two term-policy factories: `predictTenurePolicy`, `isTenurePolicyDeployed`, `deployTenurePolicy`, and the `predict`/`is…Deployed`/`deploy` trio for price floors. Policies are content-addressed via CREATE2, so their terms _are_ their address and `predict` is exact.

  **New actions** on `useSlotAction`: `createSlotWithTenure` and `createSlotWithPriceFloor`. Each wraps deploy-then-create and waits for the policy to land before creating — a rejected or reverted policy deploy bails rather than failing the create a second time, more confusingly. Two transactions only the first time anyone uses a given set of terms; afterwards the policy already exists and it is one.

  Also exports `formatDuration` and `getFaucetToken`.

  **Breaking, though nothing is removed.** The whole surface above is additive; what breaks is underneath:

  - `SlotOnChain` follows `getSlotInfo` and gains `mutablePolicy`, `lastSettled`, `occupancyPolicy`, `occupiedSince`, `hasPendingPolicy`, `pendingPolicy`. Widened, not reshaped — but exhaustive handling of the object needs updating.
  - Slot queries now request occupancy fields, so **a subgraph that has not been redeployed with the occupancy schema will error** rather than return partial data. Deploy and sync the subgraph before shipping this.
  - Depends on `@0xslots/contracts` at the matching version, where `SlotConfig` and `SlotInitParams` changed tuple shape under unchanged function names. That break produces no type error — see that package's notes.

### Patch Changes

- Updated dependencies [df9932d]
  - @0xslots/contracts@0.15.0

## 0.17.5

### Patch Changes

- Updated dependencies [fb5b9db]
  - @0xslots/contracts@0.14.0

## 0.17.4

### Patch Changes

- Updated dependencies [2ffaa38]
  - @0xslots/contracts@0.13.4

## 0.17.3

### Patch Changes

- Updated dependencies [e950731]
  - @0xslots/contracts@0.13.3

## 0.17.2

### Patch Changes

- Updated dependencies [9815e1c]
  - @0xslots/contracts@0.13.2

## 0.17.1

### Patch Changes

- Updated dependencies [24fa98d]
  - @0xslots/contracts@0.13.1

## 0.17.0

### Minor Changes

- bc91033: update

### Patch Changes

- Updated dependencies [95c954c]
- Updated dependencies [bc91033]
  - @0xslots/contracts@0.13.0

## 0.16.0

### Minor Changes

- 6156afc: feat: include slot managing methods to sdk for social groups in feed and isOccupied bool prop for slots

### Patch Changes

- Updated dependencies [6156afc]
  - @0xslots/contracts@0.12.0

## 0.15.1

### Patch Changes

- ee01045: include the updatedBy proper in the metadata update event

## 0.15.0

### Minor Changes

- a0a9e54: feat: add social group contracts & methods

### Patch Changes

- Updated dependencies [a0a9e54]
  - @0xslots/contracts@0.11.0

## 0.14.1

### Patch Changes

- Updated dependencies [5434154]
  - @0xslots/contracts@0.10.0

## 0.14.0

### Minor Changes

- 8bde58c: include aggregates for account & new entity account_slot

## 0.13.7

### Patch Changes

- bd5779e: add collectAll to factory
- Updated dependencies [bd5779e]
  - @0xslots/contracts@0.9.1

## 0.13.6

### Patch Changes

- 60504e9: add getSlotsWithMetadata query in sdk

## 0.13.5

### Patch Changes

- 0ec196a: add taxPercentage to slot object in feed metadata query

## 0.13.4

### Patch Changes

- 341f244: fix: bad slots event filtering

## 0.13.3

### Patch Changes

- f28499a: add slot ids in recentEventsQuery

## 0.13.2

### Patch Changes

- 09a62ec: add getSlotsInfo method

## 0.13.1

### Patch Changes

- 54e266f: add module data in getSlotsMetadata query

## 0.13.0

### Minor Changes

- e27cc99: include full where filter in the metadata queries

## 0.12.0

### Minor Changes

- 5ed4d22: include feed router & feed module functions to 0xSlots sdks

### Patch Changes

- Updated dependencies [5ed4d22]
  - @0xslots/contracts@0.9.0

## 0.11.1

### Patch Changes

- ddc11a7: adding feeBps & feeRecipient to modules
- Updated dependencies [ddc11a7]
  - @0xslots/contracts@0.8.1

## 0.11.0

### Minor Changes

- 2e92125: update buy function args
- dea4abc: update metadata module constant & metadata failing silently

### Patch Changes

- Updated dependencies [2e92125]
  - @0xslots/contracts@0.8.0

## 0.10.2

### Patch Changes

- 41b227c: fix: approval amount bug in buy/topUp

## 0.10.1

### Patch Changes

- 0d3484f: centralized packages
- Updated dependencies [0d3484f]
  - @0xslots/contracts@0.7.1

## 0.10.0

### Minor Changes

- Add Base mainnet support and export React hooks from SDK

  **@0xslots/contracts:**

  - Add Base mainnet factory address (`0xbf2F890E8F5CCCB3A1D7c5030dBC1843B9E36B0e`)
  - Add Base chain to CHAINS array

  **@0xslots/sdk:**

  - Add `SlotsChain.BASE` (8453) with subgraph URL
  - New `@0xslots/sdk/react` entrypoint with wagmi-wired hooks:
    - `useSlotAction(callbacks?)` — unified write executor with pending/confirming/success state tracking
    - `useSlotOnChain(address, chainId)` — real-time RPC slot reads with auto block invalidation
    - `useSlotsOnChain(addresses[], chainId)` — batch multicall variant
    - `useSlotsClient(chainId?)` — memoized SlotsClient from wagmi providers
  - Export `SlotOnChain` and `SlotActionCallbacks` types

### Patch Changes

- Updated dependencies
  - @0xslots/contracts@0.7.0

## 0.9.2

### Patch Changes

- 894c0ee: include metadata module address in module methods

## 0.9.1

### Patch Changes

- 8659e51: fresh deploy on testnets
- Updated dependencies [8659e51]
  - @0xslots/contracts@0.6.1

## 0.9.0

### Minor Changes

- 64d821b: Fresh testnet deployment

### Patch Changes

- Updated dependencies [64d821b]
  - @0xslots/contracts@0.6.0

## 0.8.3

### Patch Changes

- 5d86bd9: Add `subgraphApiKey` option to SDK config. When provided, sends `Authorization: Bearer <key>` header on all subgraph queries. Update Base Sepolia subgraph URL to decentralized gateway.

## 0.8.2

### Patch Changes

- 34c4ec8: Add `client.modules.metadata` namespace to SDK for MetadataModule read/write operations. Includes subgraph queries for MetadataSlot entities, RPC `getURI()`, and `updateMetadata()` write. Export `metadataModuleAddress` and `getMetadataModuleAddress()` from contracts package.
- Updated dependencies [34c4ec8]
  - @0xslots/contracts@0.5.1

## 0.8.1

### Patch Changes

- ef795a9: add deployement events to sdk

## 0.8.0

### Minor Changes

- 5c27235: upgrade sdk

## 0.7.0

### Minor Changes

- c453c38: add write methods to sdk

### Patch Changes

- Updated dependencies [c453c38]
  - @0xslots/contracts@0.5.0

## 0.5.0

### Minor Changes

- 037b454: v3 update

## 0.4.0

### Minor Changes

- e30c844: add arb
- 56f8181: Add arbitrum

## 0.3.0

### Minor Changes

- c66f1a8: Add flexible event queries and price update events
  - Make `getSlotCreatedEvents` accept optional parameters instead of requiring `landId`
  - Add `getPriceUpdates` query to fetch price update events
  - Update all event queries to support flexible filtering with optional `where`, `orderBy`, and `orderDirection` parameters

## 0.2.0

### Minor Changes

- 950fbc7: Initial release of @0xslots/sdk package
  - Type-safe GraphQL client for querying 0xSlots subgraph data
  - Generated from GraphQL schema with complete TypeScript support
  - Chain selection support (Base Sepolia)
  - Query methods for hub, lands, slots, and events
  - Built on graphql-request with GraphQL Code Generator
  - Full ESM support with tree-shaking
