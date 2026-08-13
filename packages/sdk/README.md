# @0xslots/sdk

Unified SDK for the 0xSlots protocol — indexer reads plus on-chain writes, with
automatic ERC-20 approval handling.

## Install

```bash
pnpm add @0xslots/sdk viem
```

## Usage

### Read-only

```ts
import { createSlotsClient, SlotsChain } from "@0xslots/sdk";

const client = createSlotsClient({ chainId: SlotsChain.BASE_SEPOLIA });

const { items, totalCount } = (await client.getSlots({ limit: 10 })).slots;
const { slot } = await client.getSlot({ id: "0x..." });
```

### Read + write

```ts
import { createSlotsClient, SlotsChain } from "@0xslots/sdk";

const client = createSlotsClient({
  chainId: SlotsChain.BASE_SEPOLIA,
  publicClient, // viem PublicClient
  walletClient, // viem WalletClient
});

// `account` is who becomes occupant — it need not be the signer.
// ERC-20 approval is handled automatically.
await client.buy({
  slot: "0x...",
  account: "0x...",
  depositAmount: 1000000n,
  selfAssessedPrice: 5000000n,
});

await client.topUp("0x...", 500000n);
await client.release("0x...");
await client.collect("0x...");
```

## Reads

Reads come from a [Ponder](https://ponder.sh) GraphQL API, not from a subgraph.

**One deployment serves every chain**, so `chainId` is a `where: { chainId }`
filter merged into every list query rather than a choice of endpoint. The client
applies it for you — an unfiltered query returns rows from every chain
interleaved, which is worse than an error because it looks like a result.

```ts
import { DEFAULT_API_URL, LOCAL_API_URL } from "@0xslots/sdk";

new SlotsClient({ chainId, apiUrl: LOCAL_API_URL }); // pnpm dev:local
```

There is no `apiKey`. The API is unauthenticated, so a key bought nothing — and
passed through `NEXT_PUBLIC_*` it shipped a credential to every visitor. If you
put your own deployment behind auth, `headers` carries it:

```ts
new SlotsClient({ chainId, apiUrl, headers: { Authorization: `Bearer ${token}` } });
```

### Result shape

Lists return `{ items, totalCount, pageInfo }` — not a bare array. Pagination is
`limit` with either `offset` or the `after` / `before` cursors from `pageInfo`.
There is no `first` / `skip`, and no `block:` time-travel argument.

### Query methods

**Slots** — `getSlots`, `getSlot`, `getSlotsByRecipient`, `getSlotsByOccupant`,
`getSlotsWithMetadata`, `getSlotRefunds`, `getSlotOperators`

**Accounts** — `getAccounts`, `getAccount`, `getAccountChains`,
`getAccountWithSlots`, `getAccountSlot`, `getAccountSlots`

**Events** — `getSlotActivity`, `getRecentEvents`, `getSlotDeployedEvents`,
`getBoughtEvents`, `getReleasedEvents`, `getLiquidatedEvents`,
`getPriceUpdatedEvents`, `getDepositedEvents`, `getWithdrawnEvents`,
`getSettledEvents`, `getTaxPaidEvents`, `getTaxCollectedEvents`

**Other** — `getFactory`, `getModules`, `getMeta`

Use `getAccountChains` rather than `getAccounts` for any per-chain view: an
account row has no `chainId` and carries protocol-wide totals, so an unscoped
list shows one chain's recipients with another chain's counts.

Escape hatches: `getClient()` returns the underlying `GraphQLClient`, `getSdk()`
the generated operations, for queries this client does not wrap.

## On-chain reads

`getSlotInfo(slot)` — full slot state via RPC. `getSlotsInfo(slots)` — the same
over multicall.

## Writes

Require `walletClient` + `publicClient`. All return `Promise<Hash>`.

| Method | Description |
| --- | --- |
| `createSlot(params)` | Deploy a slot via the factory |
| `createSlots(params)` | Deploy several with identical parameters |
| `buy(params)` | Take a slot (auto-approves ERC-20) |
| `topUp(slot, amount)` | Add to the deposit (auto-approves ERC-20) |
| `withdraw(slot, amount)` | Withdraw surplus deposit |
| `selfAssess(slot, price)` | Set the self-assessed price |
| `release(slot)` | Leave, reclaiming the remaining deposit |
| `collect(slot)` | Push accrued tax to the recipient |
| `collectAll(slots)` | The same across many slots |
| `liquidate(slot)` | Remove an insolvent occupant, earn the bounty |
| `multicall(slot, calls)` | Batch several slot calls |

### Manager operations

A slot holds at most one pending update per kind — tax, utility, occupancy
policy — each proposed and cancelled independently.

```ts
import { UpdateKind } from "@0xslots/sdk"; // Tax = 0, Utility = 1, Policy = 2

await client.proposeTaxUpdate(slot, newPct);
await client.proposeUtilityUpdate(slot, newUtility);
await client.proposePolicyUpdate(slot, newPolicy);

await client.cancelPendingUpdate(slot, UpdateKind.Policy); // one dimension
await client.cancelPendingUpdates(slot);                   // all three

await client.setLiquidationBounty(slot, newBps);
```

`proposeModuleUpdate` remains as a deprecated alias for `proposeUtilityUpdate`.

### Occupancy policies

Policies are minted per set of terms at a CREATE2 address, so one can be
computed before it exists:

```ts
await client.predictTenurePolicy(sevenDays);
await client.isTenurePolicyDeployed(sevenDays);
await client.deployTenurePolicy(sevenDays);

await client.predictPricePolicy(currency, minPrice);
await client.isPricePolicyDeployed(currency, minPrice);
await client.deployPricePolicy(currency, minPrice);
```

`resolvePolicy`, `getVouchedPolicy`, `vouchedPoliciesForChain`,
`searchVouchedPolicies` and `formatDuration` turn a policy address into
human-readable terms.

### Field names

`SlotConfig` and `SlotInitParams` renamed `mutableModule` → `mutableUtility` and
`module` → `utility` to match the contracts. **The SDK accepts either and
normalises**, so most callers need no change. If you build the tuple yourself
and hand it to viem, use the new spelling — viem encodes a struct argument by
component name, so the old keys encode a silent zero address rather than
erroring.

## Modules

```ts
await client.modules.metadata.getSlots({ limit: 10 });
await client.modules.metadata.getURI(moduleAddress, slotAddress);
await client.modules.metadata.updateMetadata(moduleAddress, slotAddress, "ipfs://...");

await client.modules.feed.socialGroupPost(slot, "ipfs://...");
```

`module.moduleURI` is now `module.metadataURI`, following the `IModuleMetadata`
rename on the contracts. There is no compatibility window: the indexer serves
one schema and GraphQL rejects a document containing an unknown field, so an SDK
on the other spelling gets an **empty list** rather than a missing field.
Upgrade the SDK and the indexer together.

## React

```tsx
import { useSlotsClient, useSlotAction, useSlotOnChain } from "@0xslots/sdk/react";
```

Requires `wagmi`, `viem` and `@tanstack/react-query` as peer dependencies.
`useSlotsClient(chainId?)` takes one argument — the old second parameter was the
removed API key.

## License

MIT
