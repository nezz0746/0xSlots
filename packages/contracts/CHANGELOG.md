# @0xslots/contracts

## 0.18.0

### Minor Changes

- 0d4fc48: Expose the per-kind pending-update surface, and correct three ABIs that had drifted from the deployed contracts.

  A slot has always held up to three queued changes — tax, utility, occupancy policy — but they could only ever be cancelled as a set, and the log could not say which one had moved. The implementation now addresses them one at a time, and the ABI follows: `cancelPendingUpdate(uint8)` retracts a single dimension, `pendingUpdateOf(uint8)` reads one uniformly across both storage structs, and `taxProposedAt` / `utilityProposedAt` / `policyProposedAt` say when each was queued. Three events carry the same shape: `UpdateProposed(uint8,bytes32,uint64)`, `UpdateCancelled(uint8)`, `UpdateApplied(uint8,bytes32)`, where `kind` is `0` tax, `1` utility, `2` policy and `value` is the proposed value widened to 32 bytes.

  They are additions, not replacements. `TaxUpdateProposed`, `ModuleUpdateProposed`, `PolicyUpdateProposed`, `PendingUpdateCancelled`, `PendingUpdateApplied` and `PolicyUpdateApplied` all still fire, because changing an existing event's signature changes its topic0 and splits historical indexing across two shapes. What the new ones add is the thing the old ones structurally cannot express: `PendingUpdateApplied` carries BOTH tax and utility on every apply, filling the unchanged one in from current state, so a reader sees a utility "change" to the value it already had. `UpdateApplied` fires only for what actually moved.

  `getSlotInfo` returns three more `uint64` fields at the end of its tuple. A consumer on the previous ABI decodes the same tuple fine and ignores them. The reverse does not hold and does not fail loudly — see the note in the SDK changeset.

  **The correction is the breaking part.** `slot.ts`, `slotFactory.ts` and `erc721Slots.ts` still described `SlotConfig.mutableModule`, `SlotInitParams.module` and `SlotInfo.module` long after the contracts renamed those components to `mutableUtility` and `utility`. viem encodes and decodes a struct argument BY COMPONENT NAME, so anything reading `info.module` or building a config with `mutableModule` was working only because the ABI was wrong in the same direction as the caller. Regenerating from `forge inspect` fixes the ABIs, which means any code holding those field names now sees `undefined` and must move to the new spelling — `@0xslots/sdk` accepts either and normalises, so most consumers need no change.

  Regenerated wholesale rather than hand-edited, which also picked up entries these files had been missing entirely: `utility()`, `mutableUtility()`, `proposeUtilityUpdate`, and on the factory side `ModuleVerified`'s renamed `utility` parameter.

  New `Slot` implementations are live behind the existing beacons — `0x8eE2370CE8A1CE0139bdF868acC4F0F59D7C8EA3` on Base and `0x4EFd8917aea62B70B354AfD11AE97CF9096a901C` on Base Sepolia. Beacon-only: `Slot.initialize` did not change, the factory proxies are untouched, and no address exported from this package moves. The storage layout is strictly append-only — every pre-existing variable sits at its original slot and offset, and the three new timestamps pack into one previously-unused slot.

## 0.17.0

### Minor Changes

- 4c4a412: Round the min-deposit floor and the tenure pre-payment UP, so a funding requirement cannot vanish at low prices.

  `Slot._minDepositFor` and `MinimumTenurePolicy._taxFor` both computed a funding requirement with truncating integer division. Below a threshold price the result rounded to **zero**, so a slot whose creator explicitly required N seconds of funded runway could be taken, repriced, or drained with no funding at all. Both now use `Math.ceilDiv`.

  The threshold was in raw token units, which is what makes this more than a dust-rounding curiosity: the same `(taxPercentage, minDepositSeconds)` pair was a real requirement in an 18-decimal token and no requirement at all in a low-decimal one. At 2%/month over 7 days of runway everything below 215 raw units was free — $0.000215 in USDC, but $2.15 in a 2-decimal stablecoin. Neither contract reads `decimals()`, so nothing on-chain could tell the difference. Rounding up makes "no deposit required" mean `minDepositSeconds == 0` and nothing else, in every currency.

  Three core call sites depended on that floor — `buy()`, `selfAssess()`, and `withdraw()` — so the old behaviour allowed taking a slot with a zero deposit, repricing to dust while keeping no runway, and withdrawing an entire live position. `MinimumTenurePolicy.checkBuy` was worse in kind: a zero-funded buyer took the slot and the tenure window then locked everyone else out of it for the full duration. Liquidation ignores the policy and clears such an occupancy immediately, which is why this was a griefing surface rather than a theft vector.

  **This is a breaking tightening.** `buy(account, 0, dustPrice)` on a slot with `minDepositSeconds > 0` succeeds today and will not afterwards, and a buy that exactly met a truncated floor may now be one unit short. Integrators computing a deposit client-side must round up the same way — a truncating copy will land one unit under and revert.

  `_accrue` is deliberately left truncating. `topUp(0)` is permissionless and has no zero-amount guard, so anyone can force a settle for the price of gas; rounding accrual up would let them charge the occupant a unit they do not owe on every such call. Requirement floors checked once and accrual integrated over repeated calls want opposite rounding, and the regression suite pins that reasoning so a later sweep does not "complete the pattern" here.

## 0.16.0

### Minor Changes

- ea74fab: Mark `buy` and `topUp` payable in the slot ABI, and point the price policy factory at its redeployment.

  A slot can now denominate its market in native ETH by taking `address(0)` as its currency. That is a contract change, but it reaches consumers here first: viem validates `stateMutability` before it sends, so with `buy` and `topUp` reading `nonpayable` it refuses to attach `value` at all, and every native write fails no matter what the caller does. The two entries are now `payable`.

  `InvalidValue` and `TransferFailed` join the error list so a reverted native call decodes to a name rather than a bare selector. `InvalidValue` covers both directions of the same rule — a native slot wants `msg.value` to equal the amount exactly, and an ERC-20 slot wants none, which is what stops ETH being stranded in a token-denominated slot.

  These ABIs are hand-maintained rather than generated, so the edit was verified against `forge inspect Slot abi`: the payable function sets match exactly, which is what proves no neighbouring entry was caught by it.

  `MINIMUM_PRICE_POLICY_FACTORY` moves to `0x6a1F9D1F78CD63cd969d500994CB333027A22844` on Base Sepolia and `0xe218F2e710D2B686fD4524236F3B79EC06E92091` on Base. The factory is not upgradeable, so teaching it to accept `address(0)` meant new bytecode at a new address — and because a factory is the CREATE2 deployer for everything it makes, every floor it predicts moved with it. Floors from the previous factories still work on the slots using them; they simply no longer verify against the current one, and are named from the SDK's vouched list instead.

## 0.15.1

### Patch Changes

- 8d11d57: Wire up the Base mainnet policy factories.

  `MinimumTenurePolicyFactory` at `0xE322cDADB8fd511788F0fA25BffD794b7A946125` and `MinimumPricePolicyFactory` at `0xF1cA0Fe72269AaEf1E5e34bfF484269f18e1b777`, added to the per-chain maps and to `POLICY_FACTORIES` so `resolvePolicy` can verify against them.

  Without these the SDK could not even address a policy factory on mainnet, so choosing a minimum tenure on the create form threw before building a transaction.

  The five starter policies they deployed — 1h/1d/7d tenures and $1/$10 USDC floors — are listed as vouched so the "Verified policy" picker has something to offer on mainnet. All five are derivable on-chain and do not need the entries to be named; this is the editorial list, not a naming fallback.

  `VouchedPolicy` gains optional `minPrice` and `currency`, and `resolvePolicy` forwards them. It checks the vouched list first and returns without touching the network, so a listed policy previously came back thinner than the same policy derived — losing exactly the fields a price floor is made of.

## 0.15.0

### Minor Changes

- df9932d: Publish the occupancy-policy ABIs.

  **The one thing that breaks, and it breaks silently.** `createSlot` and `createSlots` keep their names and their arity — but two of their tuples changed shape:

  - `SlotConfig` gained a third bool, `mutablePolicy`, before `manager`: `(bool,bool,address)` → `(bool,bool,bool,address)`
  - `SlotInitParams` gained a trailing `occupancyPolicy` address: `(uint256,address,uint256,uint256)` → `(uint256,address,uint256,uint256,address)`

  Same function name, different calldata. Nothing about this surfaces as a type error for a JS consumer holding an older ABI — the call encodes fine and the factory rejects it at runtime. This is the reason to upgrade deliberately rather than incidentally.

  `mutablePolicy` is separate from `mutableModule` on purpose. Swapping what a slot _does_ and swapping whether it can be _taken from you_ are different promises, and a holder who accepted the first has not accepted the second.

  **Additions.** `getSlotInfo` grows from 25 fields to 31, a pure superset — `mutablePolicy`, `lastSettled`, `occupancyPolicy`, `occupiedSince`, `hasPendingPolicy`, `pendingPolicy`. `lastSettled` is the one financial fact a caller could not previously derive: `taxOwed` alone does not say when the clock last stopped.

  New on `Slot`: `occupancyPolicy`, `proposePolicyUpdate`, `pendingPolicyUpdate`, `occupiedSince`, `mutablePolicy`, `setOperator`, `isOperator`, `claim`, `withdrawableOf`. New events: `PolicyUpdateProposed`, `PolicyUpdateApplied`, `OperatorSet`, `TaxPaid`, `RefundCredited`, `RefundClaimed`.

  New on `SlotFactory`: `setPolicyVerified`, `verifiedPolicies`, `upgradeBeacon`, plus `PolicyVerified` and `BeaconUpgraded`. A new `policyFactory` ABI covers the `IPolicyFactory` interface (`policyKind()` / `verify()`).

  **Removals.** `Slot.initializeV2` and `SlotFactory.migrateSlots` — both completed migrations. Versioning now lives in `reinitializer(n)` and nowhere else, not in function names.

  Also adds the Base Sepolia addresses for both term-policy factories and the starter policies they deployed.

## 0.14.0

### Minor Changes

- fb5b9db: Point Base Sepolia at the canonical SlotFactoryV3.

  `slotFactoryAddress[baseSepolia.id]` was `0xc44De86e2A5f0C47f1Ba87C36DaBf54275814DEb`, an address recorded in no deployment file and indexed by no subgraph datasource. It has been that value since v0.7.1 (2026-03-22).

  The consequence was silent: creating a slot on Base Sepolia through the SDK succeeded on-chain and emitted a valid `SlotDeployed` event, but the subgraph never saw it, so the slot was invisible to every consumer — no error, no failed transaction, just a slot that never appeared. Base was unaffected, since its address already matched its deployment record.

  It now points at `0x6D87C1647f228Baf8DE0374FCd7FdEBF6900fdFF`, matching `apps/contracts/deployments/84532/SlotFactoryV3.json` and the `factory2Address` datasource in `packages/subgraph/config/base-sepolia.json`.

  **Slots created on Base Sepolia since 2026-03-22 remain unindexed** and will not appear after this change; they were created through the orphaned factory. Recreate them to have them indexed.

## 0.13.4

### Patch Changes

- 2ffaa38: FeedHub is now a UUPS-upgradeable proxy with pricing: admin-set `feeRecipient` / `feedCreationPrice` / `slotPrice`, payable `createFeed` (first 10 slots included in the creation price, extras at slotPrice each), payable `addSlots` (feed owner, slotPrice/slot), and `withdraw()` to the fee recipient. `Feed` mints its initial tiers during `initialize`, and slot-minting is hub-gated. Repointed `feedHubAddress` (Base Sepolia) at the new UUPS proxy `0xE4c0c374E3233b5174a1600AF1321cDa9b6B5cF8`.

## 0.13.3

### Patch Changes

- e950731: `FeedHub.createFeed` is now permissionless — anyone can deploy a Feed and becomes its owner (the hub owner still controls only beacon upgrades). Added `Feed.removeSlot(address)` (owner-only, order-preserving delist; the Slot contract itself is untouched). Repointed `feedHubAddress` (Base Sepolia) at the redeployed hub `0xf732cc00640BC7fC7802DDf969c76BcAEaF51Af1` (Feed #0 = 41 slots).

## 0.13.2

### Patch Changes

- 9815e1c: FeedHub now deploys Feeds whose owner mints slots incrementally via `Feed.createSlots(SlotTier[])` — each minted slot carries the FeedPostModule (injected, immutable) and is module-verified; arbitrary addresses can never be added. Batched minting keeps each tx under RPC gas caps, so feeds can hold many slots. Point `feedHubAddress` (Base Sepolia) at the redeployed hub `0xC3bE9AB91A57Dc8eb640Eb27B40833A1a4dB5bf9`; Feed #0 ("The Testnet Feed") has 41 module-verified slots across a 6-tier tax ladder with per-tier liquidation bounty and min-deposit.

## 0.13.1

### Patch Changes

- 24fa98d: Point `feedHubAddress` (Base Sepolia) at the redeployed FeedHub (`0x36a5aedd3256CA750c44D71A0aFB663453Bb62B7`). The v2 FeedHub mints each feed's slots via the SlotFactory with the FeedPostModule attached and verifies the module on every slot, instead of accepting slot addresses. Feed #0 now has 10 module-verified slots across the tax-tier ladder.

## 0.13.0

### Minor Changes

- 95c954c: Add `feedHubAddress` export for the new FeedHub/Feed on-chain feed registry. FeedHub is deployed on Base Sepolia (`0x3B5eC015339b654F1220C32a5D29679C527Fb3B7`) with feed #0 ("The Testnet Feed") seeded from the curated 42-slot list. Base (mainnet) deploy is pending.
- bc91033: update

## 0.12.0

### Minor Changes

- 6156afc: feat: include slot managing methods to sdk for social groups in feed and isOccupied bool prop for slots

## 0.11.0

### Minor Changes

- a0a9e54: feat: add social group contracts & methods

## 0.10.0

### Minor Changes

- 5434154: add events & new router addresses

## 0.9.1

### Patch Changes

- bd5779e: add collectAll to factory

## 0.9.0

### Minor Changes

- 5ed4d22: include feed router & feed module functions to 0xSlots sdks

## 0.8.1

### Patch Changes

- ddc11a7: adding feeBps & feeRecipient to modules

## 0.8.0

### Minor Changes

- 2e92125: update buy function args

## 0.7.1

### Patch Changes

- 0d3484f: centralized packages

## 0.7.0

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

## 0.6.1

### Patch Changes

- 8659e51: fresh deploy on testnets

## 0.6.0

### Minor Changes

- 64d821b: Fresh testnet deployment

## 0.5.1

### Patch Changes

- 34c4ec8: Add `client.modules.metadata` namespace to SDK for MetadataModule read/write operations. Includes subgraph queries for MetadataSlot entities, RPC `getURI()`, and `updateMetadata()` write. Export `metadataModuleAddress` and `getMetadataModuleAddress()` from contracts package.

## 0.5.0

### Minor Changes

- c453c38: add write methods to sdk

## 0.4.0

### Minor Changes

- 037b454: v3 update

## 0.3.0

### Minor Changes

- e30c844: add arb
- 56f8181: Add arbitrum

## 0.2.0

### Minor Changes

- 34542fa: Initial release of @0xslots/contracts package
  - Export slotsAbi and slotsHubAbi for use with viem
  - Export slotsHubAddress with helper functions (getSlotsHubAddress, isSlotsHubDeployed)
  - Support for Base Sepolia (chain ID 84532)
  - TypeScript support with full type definitions
  - ESM module format with tree-shaking support
