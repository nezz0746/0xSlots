---
"@0xslots/sdk": minor
---

The SDK now speaks the hook-based protocol. 0.28.0 still shipped `resolvePolicy` and the retired protocol's client; this replaces it.

**New entry points:** `@0xslots/sdk/slots` and `@0xslots/sdk/slots/react`. The package root exports the same surface — it previously exported a *different* `createSlotsClient` and `SlotsClient` for the old protocol, 68 query methods against an indexer where the live one has 48 that talk to contracts. Importing the wrong one type-checked, which is why the root is now the live protocol rather than a second one.

**Clients:** `createSlotsClient` (`slotState`, `quoteBuy`, `quoteLiquidateAndTake`, buy, deposit, withdraw, self-assess, release, liquidate, terms proposal and application, operators) and `createCollectionsClient` (slot-bound NFT collections, `quoteMint`, `depositFor`).

**Reads moved from the subgraph to ponder.** One endpoint serves every chain and the chain is a query filter, so the per-chain URL map is gone. `SlotsEnvironment` (`production` | `development`) and `apiUrlFor` name which instance to read; `LOCAL_API_URL` is the indexer `pnpm dev:local` starts.

**Ethereum Sepolia** is a supported chain: `SlotsChain.SEPOLIA`, with native ETH as its default currency alongside Circle's USDC and WETH. ETH leads rather than a stablecoin because Sepolia has no mintable test token — leading with USDC would put a faucet trip and an ERC-20 approval between a new user and their first slot.
