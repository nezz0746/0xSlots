---
"@0xslots/contracts": patch
"@0xslots/sdk": patch
---

Bring both READMEs back in line with the packages they document.

Documentation only — no runtime change. Both files ship to npm as the package
page, so they are the first thing a consumer reads, and both had drifted far
enough to be actively misleading.

### @0xslots/contracts

Three of the four exports the README told you to import did not exist:

```diff
- import { slotsAbi, slotsHubAbi, slotsHubAddress } from "@0xslots/contracts";
+ import { slotAbi, slotFactoryAbi, slotFactoryAddress } from "@0xslots/contracts";
```

Every code sample was therefore uncompilable, and the single address it listed
(`0x268cfaB9…`) appears nowhere in `addresses.ts`. It also predated Base
mainnet, anvil, collectives and the occupancy policies entirely.

Now documents the full ABI and address surface, the current deployments, and —
the part that is easy to get wrong — why creating a policy and resolving one
read from different exports. `MINIMUM_*_POLICY_FACTORY` is where you create;
`POLICY_FACTORIES` is where you resolve, and it deliberately retains superseded
factories because a policy is immutable at a CREATE2 address and cannot migrate.

### @0xslots/sdk

Every method it listed still exists, so the drift was in the examples, which is
worse — they looked current and did not run:

```diff
- const { slots } = await client.getSlots({ first: 10 });
+ const { items, totalCount } = (await client.getSlots({ limit: 10 })).slots;
```

`first` is gone, results are `{ items, totalCount, pageInfo }`, and `buy()` was
missing its required `account`. The page still described reads as coming from a
subgraph.

Now covers the ponder read path and what changes because one deployment serves
every chain, the absent `apiKey` and why, the per-kind pending-update surface
(`UpdateKind`, `cancelPendingUpdate`), the policy predict/deploy helpers,
`getAccountChains` versus `getAccounts`, and the 22 methods the API list omitted.
