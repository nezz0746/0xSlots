# @0xslots/contracts

Contract ABIs and addresses for the 0xSlots protocol.

## Installation

```bash
pnpm add @0xslots/contracts viem
```

## Usage

### Import from the root

```typescript
import {
  slotAbi,
  slotFactoryAbi,
  slotFactoryAddress,
  getSlotsHubAddress,
} from "@0xslots/contracts";
```

### Import from a subpath

```typescript
import { slotAbi, slotFactoryAbi } from "@0xslots/contracts/abis";
import { slotFactoryAddress, getSlotsHubAddress } from "@0xslots/contracts/addresses";
```

### Use with viem

```typescript
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { slotFactoryAbi, getSlotsHubAddress } from "@0xslots/contracts";

const client = createPublicClient({ chain: baseSepolia, transport: http() });

const factory = getSlotsHubAddress(baseSepolia.id);

if (factory) {
  // The beacon implementation every slot proxy points at.
  const implementation = await client.readContract({
    address: factory,
    abi: slotFactoryAbi,
    functionName: "implementation",
  });
}
```

## Exports

### ABIs

| Export | Contract |
| --- | --- |
| `slotAbi` | An individual `Slot` |
| `slotFactoryAbi` | `SlotFactory` — deploys slots behind one beacon |
| `slotCollectiveAbi` | `SlotCollective` — split + role-gated governance |
| `slotCollectiveFactoryAbi` | `SlotCollectiveFactory` |
| `metadataModuleAbi` | `MetadataModule` utility |
| `feedModuleAbi`, `feedRouterAbi`, `feedSocialGroupAbi` | Feed utilities |
| `minimumTenurePolicyFactoryAbi` | Deploys one policy per duration |
| `minimumPricePolicyAbi`, `minimumPricePolicyFactoryAbi` | Price-floor policy and its factory |
| `policyFactoryAbi` | The shared `IPolicyFactory` surface (`policyKind`, `verify`) |
| `batchCollectorAbi` | Batch tax collection |
| `erc721SlotsAbi` | ERC-721 wrapper |

### Addresses

`slotFactoryAddress`, `slotCollectiveFactoryAddress`, `batchCollectorAddress`,
`erc721SlotsAddress`, `feedModuleAddress`, `feedRouterAddress`,
`feedSocialGroupAddress`, `feedHubAddress`.

Helpers: `getSlotsHubAddress(chainId)`, `isSlotsHubDeployed(chainId)`,
`getSupportedChainIds()`. Type: `SupportedChainId`.

### Policies

`MINIMUM_TENURE_POLICY_FACTORY` and `MINIMUM_PRICE_POLICY_FACTORY` are where you
**create** a policy. `POLICY_FACTORIES` is where you **resolve** one — it holds
superseded factories too, ordered current-first.

The two are deliberately different exports. A policy is immutable and lives at a
CREATE2 address derived from its init code, so every factory redeploy strands
the policies the previous one minted at addresses only that older factory can
claim. Creating through a superseded factory mints a policy the current
`SlotFactory` will refuse to verify.

```typescript
import { POLICY_FACTORIES, policyFactoryAbi } from "@0xslots/contracts";

for (const factory of POLICY_FACTORIES[chainId] ?? []) {
  const mine = await client.readContract({
    address: factory,
    abi: policyFactoryAbi,
    functionName: "verify",
    args: [policyAddress],
  });
  if (mine) break; // genuine policy — read its terms and format them
}
```

Factories predating `IPolicyFactory` are deliberately absent: they have no
`verify()`, so slots still pointing at their policies read as unrecognised,
which is the honest answer rather than a guess.

### Chains

```typescript
import { CHAINS, DEFAULT_CHAIN } from "@0xslots/contracts";
```

`CHAINS` is derived from `slotFactoryAddress`. Anvil is filtered out unless
`NODE_ENV === "development"` — bundlers inline `NODE_ENV`, so a production build
drops it at compile time rather than shipping a chain option that resolves to
nobody's localhost. The address tables themselves are unconditional; they are
only data, and a consumer that knows it wants the local factory can ask for it
by id.

### Feed events

`FEED_EVENT_TYPES`, `FeedEventType`, `feedEvent`.

## Supported networks

| Chain | ID | SlotFactory |
| --- | --- | --- |
| Base | 8453 | `0xbf2F890E8F5CCCB3A1D7c5030dBC1843B9E36B0e` |
| Base Sepolia | 84532 | `0x6D87C1647f228Baf8DE0374FCd7FdEBF6900fdFF` |
| Anvil (local) | 31337 | `0x78F614D6e3489a90BD2584D2ab1D90F5C35722F6` |

Collectives are Base Sepolia and anvil only — `base` is deliberately absent from
`slotCollectiveFactoryAddress`, and consumers derive their "not deployed here"
messaging from those keys.

`addresses.ts` is the source of truth; the table above is a convenience. Use the
exported values rather than copying them.

## License

MIT
