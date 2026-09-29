# @0xslots/sdk

Type-safe SDK for the 0xSlots protocol — contract reads and writes over viem,
with ERC-20 approval handled for you. Full reference:
[docs.0xslots.org](https://docs.0xslots.org/sdk/client).

## Install

```bash
pnpm add @0xslots/sdk @0xslots/contracts viem
```

## Usage

```ts
import { SlotsClient } from "@0xslots/sdk";
import { slotFactoryAddress } from "@0xslots/contracts";

const client = new SlotsClient({
  publicClient,                                  // viem PublicClient
  walletClient,                                  // viem WalletClient, for writes
  factoryAddress: slotFactoryAddress[chainId],   // only createSlot / collectAll need it
});

const state = await client.slotState(slot);      // one SlotLens.getSlotInfo call

// `account` is who becomes occupant — it need not be the signer.
await client.buy({
  slot,
  account,
  selfAssessedPrice: 5_000_000n,
  depositAmount: 1_000_000n,
});

await client.topUp(slot, 500_000n);
await client.release(slot);
await client.collect(slot);
```

`SlotsClient` reads the chain, not the indexer. The indexer endpoints are
exported as `DEFAULT_API_URL`, `LOCAL_API_URL`, `API_URLS` and `apiUrlFor(env)`
for querying it directly — see [Indexer](https://docs.0xslots.org/indexer).

## Surface

| Area | Methods |
| --- | --- |
| Reads | `slotState`, `slotStates`, `quoteBuy`, `minDepositForBuy`, `minDepositToHold`, `pending`, `hasRipeTerms`, `terms`, `module`, `scopes`, `fee`, `moduleUpdate`, `debtOf`, `claimableOf`, `isOperator`, and getters for the common fields |
| Create | `createSlot`, `simulateCreateSlot` |
| Occupancy | `buy`, `simulateBuy`, `liquidateAndBuy`, `release`, `liquidate` |
| Holding | `selfAssess`, `topUp`, `withdraw`, `manageTerms`, `setOperator` |
| Money out | `collect`, `collectAll`, `simulateCollectAll`, `collectFrom`, `claim` |
| Manager | `proposeTerms`, `cancelTerms`, `acceptFee`, `acceptScopes`, `setManager` |
| Modules | `validateSettings`, `readScopes`, `readFee`, `moduleMetadata`, `moduleSettings` |
| OfferBook | `offerBoard`, `offerAt`, `isOfferFundable`, `offerCost`, `postOffer`, `cancelOffer`, `approveOfferBook`, `authorizeOfferBook`, `acceptOffer` |

`buy` sends the quote it just read as `maxPayment`, so it pays what it was
quoted or reverts; pass `maxPayment: 0n` to disable the ceiling on purpose.
Call `simulateBuy` first to surface a module's refusal with its own error.

Terms are proposed by presence, and land at the next buy after a one-day delay:

```ts
import { NO_MODULE, TERMS } from "@0xslots/sdk";

await client.proposeTerms(slot, { taxRateBps: 200 });
await client.proposeTerms(slot, { moduleTerms: { module, settings } });
await client.proposeTerms(slot, { moduleTerms: NO_MODULE }); // remove the module
await client.cancelTerms(slot, TERMS.MODULE);
```

`CollectionsClient` (slot-bound NFT collections) and `CollectivesClient`
(`SlotCollective` governance, roles in `COLLECTIVE_ROLES`) ship beside it.

## React

```tsx
import { useSlotAction, useSlotsClient } from "@0xslots/sdk/react";
```

Requires `wagmi`, `viem` and `@tanstack/react-query` as peer dependencies.
`useSlotsClient({ factoryAddress?, offerBookAddress?, chainId? })` memoizes a
client from wagmi's clients; `useSlotAction` wraps every write with shared
pending and receipt state. `useCollectivesClient` does the same for collectives.

## License

MIT
