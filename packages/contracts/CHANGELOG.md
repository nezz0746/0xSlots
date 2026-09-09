# @0xslots/contracts

## 0.25.0

### Minor Changes

- 5923351: Slots, collectives and slot-bound collections no longer share an address across chains.

  All three factories deployed their children with plain `new`, which is CREATE, whose address is `keccak(rlp(deployer, nonce))` and nothing else. Constructor arguments do not enter a CREATE address at all, so two slots with different recipients, currencies, hooks and tax rates still landed on the same address whenever the factory's nonce matched — nothing about a slot's own terms ever separated it from another chain's.

  Each factory is deployed at the same address on every chain, deliberately, and each therefore ran through the same nonce sequence on each of them. Slot #N on Base and slot #N on Ethereum Sepolia were consequently not merely at risk of colliding: they were the same address, by arithmetic. `SlotFactory` at `0x14df7d78` produced `0xf37e7bbf` as its first slot on both.

  That is what took the indexer down. Its `slot` table was keyed on the address alone, so the second chain's row was a duplicate primary key, the insert threw unhandled, and the container restart-looped. The indexer is now keyed on (address, chainId); this is the other half, so the chains stop producing the same address in the first place.

  `createSlot`, `createCollective` and `createCollection` now use CREATE2, salted with `keccak256(abi.encode(block.chainid, <counter>))` — `slotCount`, `collectives.length` and `collectionCount` respectively. Both halves are load bearing. The counter makes children distinct within a chain, and because it only ever increases, a salt never repeats and CREATE2 cannot revert on an occupied address. `block.chainid` makes them distinct across chains, and without it the collision would have survived the move untouched: a BeaconProxy's initcode is its beacon and its initializer calldata, both of which can be byte-identical on two chains.

  Factories keep one address across chains. That is deliberate and is not what changes here — only their children stop sharing one. Contracts deployed directly rather than through a factory, such as `MinimumTenureHook`, are unaffected and still land at one address everywhere, which is why anything indexing them must treat (chainId, address) as the identity regardless.

  No ABI change: all three creation signatures are unchanged, and an address is still returned the same way. `SlotFactory.version()` is now 4, `SlotCollectiveFactory.version()` 3, and `SlotBoundNFTFactory.version()` 2.

  This does not upgrade in place. The deployment namespace moved to `0xslots.v3`, so every recorded address changes on Base, Base Sepolia and Ethereum Sepolia — factories, implementations, `AdLand`, `OfferBook` and `MinimumTenureHook` alike. The previous deployment keeps working, untouched, at addresses this package no longer names, but nothing carries over: slots, collectives, collections and every AdLand key from it are orphaned, and any embed pointing at an old slot address resolves to a space the new deployment does not know about.

## 0.24.0

### Minor Changes

- a548f2a: `AdLand` is version 2: it can create the slots it hooks, and a key can have an owner.

  `createAdSlot(recipient, currency, taxBps, minDepositSeconds, tenureWindow, manager, key)` deploys through the recorded `SlotFactory` with `hook` fixed to AdLand. It removes the three fields of `SlotInit` that fail quietly: the hook address, which a form can fill with the wrong one and produce a valid slot that simply is not an ad space; `hookData`, a `bytes32` that is really seconds; and `mutableHook`, which is `false` here, so a slot made this way is an ad space permanently rather than currently. Anyone wanting the other trade still calls `SlotFactory.createSlot` directly — this gates nothing.

  A non-zero `key` claims a registry name in the same transaction, first come first served, recorded in the new `keyOwner` mapping. Only an UNCLAIMED key can be taken, so `primary` and anything already pointing somewhere are not available; the owner can still repoint any key through `setSlot`'s two-day path, so a squatted name costs a delay rather than being lost. A taken key reverts the whole creation rather than handing back a slot the caller believes is named and is not.

  `setSlot` accepts the key's owner as well as the contract owner. Everything else about it is unchanged, including that the first write to an unset key is immediate and every later one waits `CHANGE_DELAY` and needs `commitSlot`.

  New surface on `adLandAbi`: `createAdSlot`, `setSlotFactory`, `slotFactory`, `keyOwner`, and a `NotKeyOwner` / `KeyTaken` / `NoFactory` error each. `slotFactory` must be set by the owner once after upgrading, or `createAdSlot` reverts with `NoFactory`.

  Storage is append-only, so this upgrades the live proxies in place. The recorded AdLand address changes on Base, Base Sepolia and Ethereum Sepolia.

- 3976783: Add `SlotFactory.collectAll(address[])` — flush accrued tax out of many slots in
  one transaction, and `collectFrom(address)` for a single one.

  Collection is already permissionless and the money always goes to each slot's
  own `recipient`, so this grants no new authority: it is a gas convenience for a
  keeper, or for a recipient holding many slots.

  Each collection is isolated, so a slot that reverts — `NothingToCollect`, or a
  `strict` hook that reverts in `afterSettle` — leaves a zero in the returned
  array instead of denying every other recipient their rent. Addresses the factory
  did not create are skipped rather than rejected.

  The returned amounts are what actually moved, capped by each slot's deposit: for
  an insolvent slot the raw `taxOwed()` exceeds what settlement will pay out, and
  the excess is carried as arrears rather than transferred. Simulate the call to
  price a "collect all" button before showing it.

  Adds a `NotASlot` error. `SlotFactory.version()` is now 3; this is an
  implementation change with no storage change, so it upgrades in place.

  On the SDK: `collectAll(slots)`, `simulateCollectAll(slots)` and
  `collectFrom(slot)` on `SlotsClient`, plus a `collectAll` in the
  `useSlotsActions` React bindings. Simulate to price a "collect all" button — a
  transaction hash carries no return value, so that is the only way to show what a
  collection is worth before signing it. An empty batch is refused client-side:
  the contract accepts it, which is exactly why a UI should not be able to prompt
  for a signature that pays gas to do nothing.

## 0.23.0

### Minor Changes

- d4362f9: The hook-based protocol replaces the policy-based one, and this package is now generated rather than hand-written.

  **Entry points changed.** `./abis` and `./addresses` are gone; the package exports `.` and `./slots`. Both carry the same thing — `./slots` is the explicit path, the root re-exports it.

  **Everything is generated.** ABIs and addresses come from the Foundry build and the deployment records via the wagmi CLI, so a contract's ABI and the address it is deployed at can no longer disagree. `version()` reached none of the ABIs for a whole release under the previous hand-rolled generator, and the local test token pointed at an address with no code.

  **The protocol surface is different, not extended.** A slot takes one `SlotInit` struct with a `hook` and a `bytes32 hookData`; `taxPercentage` is `taxBps`; term changes are proposed and applied on a delay. The policy resolvers, the module gallery and the sell-order surface are gone. Nothing that compiled against 0.22.0 compiles against this.

  **New:** `knownHooks` and `findKnownHook` — the hooks a client can offer by name on a given chain, derived from the deployment records rather than typed, so a hook appears on exactly the chains it is deployed to. `KnownHook` carries `by` alongside `name` and `description`, with optional `url` and `logo`, so a client can say who maintains a hook rather than presenting every one as stock. `minimumTenureHookAddress` and `adLandAddress`. `CHAINS`, `DEFAULT_CHAIN` and `isDeployedOn`, all derived from where the factory actually exists, so a chain nobody can use is never offered.

  **Hook descriptors gained a schema.** `HookDescriptor` now carries a `signature` — a plain ABI type list such as `"uint256 window"` — beside `data`, which holds `abi.encode(HookBounds[])`: a name, a unit and the range the contract will accept for each value. A client renders a working configuration form for a hook it has never heard of, and the bounds come from the hook's own constants, so the form cannot offer a value the transaction would refuse.

  **Ethereum Sepolia** joins the chain map. Chains sort local, then testnets, then mainnets, off `chain.testnet` rather than a hard-coded id — which also fixes an ordering bug where any testnet other than Base Sepolia ranked as a mainnet and could become the default.

## 0.22.0

### Minor Changes

- 00e86d1: Add the Base mainnet SlotCollectiveFactory (`0x9DE033C5E2FAC9e096c91a83635d7a7Cf21b4486`, block 49962974).

  Collectives were base-sepolia only until now. Anything deriving availability from
  `slotCollectiveFactoryAddress` — notably `CollectiveUnavailable` in the app — starts
  offering collectives on Base with this entry.

  The factory admin is still the deployer EOA on both chains, and that key can
  `upgradeBeacon` every collective at once. `transferAdmin` exists; it has not been
  called yet.

- 7d25054: Add `buyAndUpdate` and `buyAndUpdateWithPermit` to MetadataModule (2.0.0 → 2.1.0).

  Taking a slot and putting something in it was two calls that cannot be reordered:
  `updateMetadata` is occupant-only, and `buy` clears the previous creative on its
  way through, so the gap between them is a slot showing nothing. Wallets that
  implement EIP-5792 closed that gap by bundling. A plain browser extension does
  not — and it failed dishonestly: each receipt was awaited, but the wallet's own
  RPC provider still had the previous occupant when it estimated gas for the
  metadata write, so the call reverted and surfaced as a bare `-32603 internal
error`. Moving the sequencing on-chain removes the class of bug instead of
  retrying it.

  `buyAndUpdateWithPermit` is the one that reaches a single transaction for a plain
  EOA, since USDC on Base implements EIP-2612. Plain `buyAndUpdate` remains two
  confirmations (approve, then buy-and-publish) for tokens without permit, and one
  for native slots, which are paid by value.

  The module is a UUPS proxy, so this shipped as an in-place upgrade: the address
  is unchanged and every slot already pointing at it gained both entry points at
  once. No address-book change, and `slotAbi`/`metadataModuleAbi` consumers keep
  working — this only adds.

  SDK: `client.modules.metadata.buyAndUpdate()`, `.buyAndUpdateWithPermit()` and
  `.quoteBuyCost()`. The permit signature is the caller's to produce; sign the
  token's `Permit` typed data with `spender` set to the module address and `value`
  covering `quoteBuyCost`.

  Also corrects `metadataModuleAbi`'s `initialize` entry, which declared no
  parameters while the contract has always taken `address initialOwner`.

## 0.21.0

### Minor Changes

- e969a04: Add the Base mainnet SlotCollectiveFactory (`0x9DE033C5E2FAC9e096c91a83635d7a7Cf21b4486`, block 49962974).

  Collectives were base-sepolia only until now. Anything deriving availability from
  `slotCollectiveFactoryAddress` — notably `CollectiveUnavailable` in the app — starts
  offering collectives on Base with this entry.

  The factory admin is still the deployer EOA on both chains, and that key can
  `upgradeBeacon` every collective at once. `transferAdmin` exists; it has not been
  called yet.

### Patch Changes

- d799516: Bring both READMEs back in line with the packages they document.

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

## 0.20.0

### Minor Changes

- 1fde28a: **Breaking:** `moduleURI` → `metadataURI`, and new policy factory addresses.

  ### ABI

  `IUtility.moduleURI()` and `IOccupancyPolicy.policyURI()` are now one
  `IModuleMetadata.metadataURI()`. The exported `slotFactory` ABI follows: the
  last field of `ModuleVerified` and `PolicyVerified` is `metadataURI`.

  Event _signatures_ are unchanged — parameter names are not part of a topic0 —
  so log decoding keeps working. Only the field label moved, plus the function
  selector on the contracts themselves.

  This shipped to Base and Base Sepolia. Utilities are UUPS proxies and were
  upgraded in place, keeping their addresses; `moduleURI()` now reverts on them
  and `metadataURI()` answers.

  ### ERC-165 ids changed

  An id is the XOR of an interface's OWN selectors, and moving `name`/`version`/
  `metadataURI` to a parent narrows it. There are now two, and
  `SlotFactory.setUtilityVerified` asserts both:

  | interface          | id           | covers                           |
  | ------------------ | ------------ | -------------------------------- |
  | `IUtility`         | `0xe120614a` | the six hooks                    |
  | `IOccupancyPolicy` | `0xd8a073cb` | `checkBuy`, `checkPriceUpdate`   |
  | `IModuleMetadata`  | `0x51eed0df` | `name`, `version`, `metadataURI` |

  Anything hardcoding the old single id must move to checking both, or it will
  call a contract verified that the chain then rejects.

  ### Policy factory addresses moved — update required

  Policies are immutable and minted at a CREATE2 address derived from the INIT
  CODE, so new bytecode means new factories and new addresses for every set of
  terms they predict. `MINIMUM_TENURE_POLICY_FACTORY` and
  `MINIMUM_PRICE_POLICY_FACTORY` now point at the redeployed ones:

  | chain        | tenure             | price              |
  | ------------ | ------------------ | ------------------ |
  | base         | `0x6C90Ca1A…b30a5` | `0xFA64C889…0Ff1A` |
  | base-sepolia | `0x2a399E4D…14E4a` | `0x958088c4…C6551` |

  Creating a policy through the previous factory now produces one the upgraded
  `SlotFactory` will not verify, which is why these had to move rather than being
  left in place.

  `POLICY_FACTORIES` keeps the superseded factories so existing policies still
  resolve, ordered current-first. This also repairs an existing gap: the
  `2026-08-08` price factories (`0x6a1F9D1F…` / `0xe218F2e7…`) were never added to
  that list, so policies minted by them did not resolve at all.

  Slots already pointing at a pre-rename policy are unaffected — `Slot` only ever
  calls `checkBuy` and `checkPriceUpdate`, neither of which changed.

## 0.19.0

### Minor Changes

- 7f8f2a7: Add local anvil (31337) as a first-class chain.

  `slotFactoryAddress` gains a pinned anvil entry, matching the address
  `apps/contracts/script/DeployLocal.s.sol` deploys to. The address survives edits
  to the Solidity — see `LocalBootstrap.sol` for why a plain CREATE2 would not,
  since CREATE2 hashes the initcode and so moves whenever the contract changes.

  `CHAINS` filters anvil out unless `NODE_ENV === "development"`. Bundlers inline
  `NODE_ENV`, so a production build drops the entry at compile time rather than
  shipping a chain option that resolves to nobody's localhost.

  The address table itself is unconditional — it is only data. Whether a chain is
  _offered_ is `CHAINS`'s decision, and keeping those separate means a consumer
  that knows it wants the local factory can still ask for it by id.

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
