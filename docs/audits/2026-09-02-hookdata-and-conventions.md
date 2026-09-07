# hookData audit + conventions sweep — 2026-09-02

Nine parallel read-only audits of the uncommitted `hookData` work and of the live
protocol's Solidity conventions. **Nothing was fixed.** This file is the record.

Scope of the change under audit: `hookData` — a `bytes32` on the slot holding
that slot's configuration for its hook, passed to the hook on every callback —
plus the `MinimumTenureHook` rewrite it enabled, the deletion of
`MinimumTenureHookFactory`, the `SlotStorage` regrouping, and the
`NAMESPACE` bump to `0xslots.v2`.

State at time of audit: 563 forge tests pass, `pnpm run build` passes, `tsc`
clean across every package.

## Verification legend

| | meaning |
|---|---|
| **✅ verified** | I reproduced it myself — traced the code, read the compiled IR, or measured it. Not taken on an agent's word. |
| **agent-confirmed** | The agent traced it and showed its work; I did not independently reproduce it. |
| **suspected** | Reasoned but not demonstrated. Treat as a lead. |

Severity is about consequence, not effort.

---

# Part 1 — Security: the `hookData` change

## CRITICAL

### C-01 · A slot can be locked out of forced sale permanently, for the price of gas ✅ verified

`src/hooks/MinimumTenureHook.sol:198` (`beforeSell`), `:268` (`_requireNoCutDuringTenure`)

`beforeSell` enforces only a **relative** price floor (`newPrice < currentPrice`)
and runs no tenure check and no re-entry check. Once the sitting price is already
dust, a self-deal at the *same* dust price passes every condition and resets
`occupiedSince`.

The loop, with the test suite's own parameters (TAX 1000bps, 7-day window):

1. `A` takes a vacant slot at `price = 1, deposit = 1`. The hook's basis is
   `max(1, 0) = 1`; `requiredDeposit(1, 1000, 604800) = 1` wei — the repo asserts
   exactly this in `test_TheRequirementRoundsUpAndNeverToZero`. **Total cost: 1 wei.**
2. For 7 days nobody can buy, at any price.
3. Before expiry, `A` sells to `B` (an address `A` controls) at `price = 1,
   deposit = 1`. Funding passes (basis 1, required 1). The cut check passes
   (`1 < 1` is false). No bar is consulted. Net transfer: zero.
   `occupiedSince` resets.
4. Repeat forever.

Liquidation never arms either: `taxFor` is
`mulDiv(price, taxBps * elapsed, 2.592e10)`, which at price 1 and 1000 bps is
**zero for 300 days**, so the 1-wei deposit never depletes.

There is no block in which the slot is buyable. A slot entered at a real price
reaches the same state atomically via the inherited `Multicall`:
`[selfAssess(1), sell(order to B at 1)]` at the first block the window has
elapsed.

Verified mechanically: `beforeSell`'s body, `SlotOccupancy.sol:172`
(`occupiedSince = uint64(block.timestamp)`), and `SlotMath.sol:56`.

**The comment at `MinimumTenureHook.sol:63-69` is false.** It claims the `sell`
channel "cannot be used … to restart protection at a price the tax rounds away."
That is exactly what it permits. I wrote that comment.

`test_ASaleCannotCutThePriceInsideTheWindow` only covers `currentPrice = 100
ether` — never the already-at-dust case.

### C-02 · `validateHookData` introduced an uncatchable revert on the eviction path ✅ verified

`src/SlotHooks.sol:91`

`_tryReadHookFlags` is the fail-open reader, called from `_applyPending`, which
runs inside `_liquidate`. Its whole contract is *"a hook that will not say what
it wants is attached as nothing."*

`validateHookData` returns nothing, so solc emits its contract-existence guard —
and that guard sits **before** the call, **outside** the `try`. From this repo's
own optimized IR (`forge inspect src/Slot.sol:Slot irOptimized`):

```
if iszero(extcodesize(_1))
revert(0, 0)                                    // <- uncatchable
let trySuccessCondition := staticcall(0x07a120, ...)
```

The `hooks()` call in the same function has no such guard, because solc skips the
check when return data is expected. **This is a guard the change introduced.**

A pending hook that has code at `proposeTerms` and none at `_applyPending`
(an EIP-7702-delegated EOA whose delegation is later revoked — 7702 is live on
Base) bricks the slot: `liquidate`, `buy`, `sell` and `release` all call
`_applyPending`. The only exit is `cancelProposal`, which is `onlyManager` — the
party who chose the hook.

**This violates rule 1.** Not "makes eviction expensive" — blocks it.

The codebase already documented the mechanic, in the file this change deleted:
*"`try` does NOT catch this: for a call to an address with no code the compiler's
extcodesize check reverts before the call is even made."* — `MinimumTenureHookFactory`.

Suggested direction: replace both `try` calls with a raw
`staticcall{gas: HOOK_GAS}` plus manual bounds checks — the same hand-decoding
already used in `_payOrCredit` (`SlotAccounting.sol:202`) for the identical reason.

---

## HIGH

### H-01 · The `hooks()` decode also escapes the catch — pre-existing, same shape agent-confirmed

`src/SlotHooks.sol:95`

The ABI decode runs before the try's `switch`, so its reverts escape too:
`abi_decode_struct_HookFlags_fromMemory` reverts on returndata shorter than 256
bytes, and `validator_revert_t_bool` reverts on any word that is not 0 or 1.

Reachable today with no 7702: take `FlipHook` from `AuditRegressions.t.sol:22`
and have it `return(0, 32)` instead of reverting. Same brick as C-02, no
prerequisites. Fixing C-02 without fixing this leaves the hole open.

### H-02 · The re-entry ledger writes and reads different keys ✅ verified

`src/hooks/MinimumTenureHook.sol:179` (read, `ctx.slot`) vs `:220`/`:225`
(write, `msg.sender`)

`CompositeHook._each` dispatches with `children[i].call{...}`, so inside
`afterRelease` the child sees the **composite** as `msg.sender` while `ctx.slot`
is still the slot. The bar is written to `reentryAllowedAt[composite][account]`
and read from `reentryAllowedAt[slot][account]` — **it never fires for any
composite-using slot**, and every slot behind that composite shares one key.

Direct attachment is unaffected (`msg.sender == ctx.slot`).

`ISlotHook.sol:17` states the reason `ctx.slot` exists: *"passed explicitly so a
hook serving many slots does not have to trust its own call frame."* The write
side trusts its call frame. The comment at `:102` describes keying by
`(slot, account)`; the code keys by `(caller, account)`.

### H-03 · `beforeSell` never consults the re-entry bar agent-confirmed

`src/hooks/MinimumTenureHook.sol:198`

`A` releases → barred. `B` buys, then sells to `A` at a price ≥ current. `A` is
seated with a fresh window while still barred. Two addresses, one round trip, no
waiting. The comment at `:174-178` — *"This is what closes the renewal loop"* —
holds only for the `buy` path.

### H-04 · `release()` collapses the funding anchor ✅ verified

`src/hooks/MinimumTenureHook.sol:257`, `src/SlotAccounting.sol:219`

`_requireFunded`'s basis is `max(newPrice, currentPrice)`, justified as
*"anchoring to the price being displaced means undercutting the market no longer
buys protection cheaply."* But `_vacate()` sets `_price = 0`, and `release` is
not hook-gated — there is no `beforeRelease` in `ISlotHook`.

An occupant at 100 ether who is forbidden to cut can, from a contract, call
`release()` then `buy(sybil, 1, 1)` in one transaction: basis `max(1, 0) = 1`,
required deposit 1 wei, fresh window. Both conditions the hook exists to enforce
are satisfied for 1 wei. Only the bar on the releasing account stands in the way
— defeated by one extra address.

`test_AVacantSlotIsAlwaysClaimable` demonstrates the anchor collapse and reads it
as a feature.

### H-05 · The manager UI can no longer attach a tenure hook at all agent-confirmed

`apps/landing/src/app/app/slots/[slotAddress]/components/slot-terms.tsx:118`

Calls `proposeTerms(slot, { hook })` with no `hookData`; the SDK defaults to
`ZERO_HOOK_DATA`; `validateHookData(0)` reverts `TenureNotConfigured`. There is
no duration field in that form, so it is a dead end rather than a mis-entry.

The same form **silently wipes** configuration for permissive hooks: re-proposing
the same hook is the natural way to change only the window, and it clears
`hookData` with no warning.

### H-06 · The deployment ledger will record the wrong version for `SlotCollective` ✅ verified

`script/protocol/DeployProtocol.s.sol:177`

```solidity
record("SlotCollective", collectiveImpl, 1);   // hardcoded
```

`SlotCollective.version()` returns **2** (bumped in this same change), and the
salt on line 102 correctly uses `new SlotCollective(warehouse).version()`. Every
other `record(…)` call reads `version()` off the contract.

Confirmed against the live anvil record: `{"address":"0xB49A15A1…","version":1}`
for code that reports 2. `version` is the ledger's discriminator and is described
in-repo as load-bearing; the CLI will report a permanent pending upgrade for this
contract. Found independently by three agents.

**Fix before broadcasting to Base.**

---

## MEDIUM

### M-01 · 44% of the deploy's gas is thrown away, and six orphan contracts are left on chain ✅ verified

`script/protocol/DeployProtocol.s.sol:53-112`

Six `new Slot().version()` / `new SlotFactory().version()` / … calls sit **inside
`vm.startBroadcast()`**, purely to read a `pure` function. Forge broadcasts each
as a real deployment.

From the last local broadcast log, every implementation appears twice:

| | throwaway probe | real deployment |
|---|---|---|
| Slot | `CREATE 0x5fbdb231…` | `CREATE2 0xb18de475…` |
| SlotFactory | `CREATE 0x9fe46736…` | `CREATE2 0x0c10a2d7…` |
| OfferBook | `CREATE 0xdc64a140…` | `CREATE2 0xef3c981f…` |
| SlotCollective | `CREATE 0xa513e6e4…` | `CREATE2 0xb49a15a1…` |
| SlotCollectiveFactory | `CREATE 0x8a791620…` | `CREATE2 0x7487f9ff…` |
| AdLand | `CREATE 0x9a676e78…` | `CREATE2 0xaad4c0d7…` |

Measured from the receipts: **12,623,359 gas wasted of 28,694,665 total — 44.0%.**

`UpgradeProtocol.s.sol:97` does the same reads *above* `startBroadcast` and pays
nothing. The fix is hoisting six lines above line 53.

### M-02 · A nested `CompositeHook` silently delivers zero `after` callbacks agent-confirmed

`src/hooks/CompositeHook.sol:209-221` — pre-existing, sharpened by this change

`CHILD_GAS = HOOK_GAS / MAX_CHILDREN` = 62,500. `_each`'s first loop guard is
`gasleft() < CHILD_GAS + GAS_FLOOR` = 72,500. An inner composite is entered with
at most 62,500 → the guard is **unconditionally true** → immediate return. This
is arithmetic, not a margin.

The inner `call` succeeds, so nothing emits `HookCallFailed`. Completely silent.

Sharpened here because `validateHookData` fans out through `_all`, which forwards
all gas and *does* reach the nested subtree — so a nested composite validates a
tree that will never be consulted.

Related: `CHILD_GAS * MAX_CHILDREN == HOOK_GAS` exactly, leaving nothing for
`GAS_FLOOR`. Worst case the **8th child is always dropped** — effective capacity
is 7, not 8. `test_TheChildStipendFitsTheBudget` asserts `<= 500_000`, which
passes at equality and does not model the runtime guard.

### M-03 · Untrusted gas on the eviction path grew 500k, contradicting the docstring agent-confirmed

`src/SlotHooks.sol:91,95`

Two separately-capped calls where there was one, so `_applyPending`'s ceiling
went 500k → 1,000,000. Whole-`liquidate()` worst case ≈ 2.2M → 2.75M.

The docstring at `:73-78` still claims *"`HOOK_GAS` is the same stipend `_after`
grants, so no hook gets a bigger claim on an eviction than any other."* No longer
true.

Rule 1 is not violated — both calls are capped and `try`-wrapped, so this is cost,
not liveness. But `Slots.t.sol:203` asserts eviction succeeds on `gas: 2_000_000`
and calls that "a normal budget"; with a hostile hook *also queued as pending*,
2M no longer covers it. Keeper and UI gas estimates need raising.

Benign cost measured from the trace: **150 gas**. Negligible normally.

### M-04 · `CompositeHook.validateHookData` puts an uncapped 8-child fan-out on the eviction path agent-confirmed

`src/hooks/CompositeHook.sol:158` → `_all` at `:198`

`_all` has no per-child cap (unlike `_each`), bubbles child reverts, and its
`bytes memory err` does a full `returndatacopy`. Before this change,
`_applyPending` on a composite cost ~2.9k (`hooks()` returns a stored struct).
Now it walks the whole untrusted subtree on every occupancy transition,
liquidation included. Stays fail-open, so rule 1 holds — but this is where
M-03's +500k actually gets spent.

### M-05 · Calibrated-gas detach griefing got materially easier agent-confirmed

`src/SlotAccounting.sol:161-171`

`_tryReadHookFlags` returning false is indistinguishable from "the hook
misbehaved": the slot detaches and `delete pending` **permanently discards the
manager's proposal**. Anyone can trigger this by calling `liquidate()`/`release()`
with gas calibrated to starve the hook read while still finishing the transition.

Pre-existing, but the starvation threshold moved from ~2.9k to a composite's whole
fan-out (8 cold children ≈ 21k of access cost alone). Calibration is now robust
rather than knife-edge. Destroys governance state, not evictability.

### M-06 · `_ctxFor` caches `hookData` but not `taxPercentage` agent-confirmed

`src/SlotHooks.sol:167`, reached from `SlotOccupancy.sol:218` and `:263`

Slot has hook A + data X at tax 500. Manager proposes tax 750; a day passes; the
occupant calls `release()`. `_applyPending` sets `taxPercentage = 750`, then the
context carries `ctx.hookData == X` (correctly cached) alongside
`ctx.taxPercentage == 750` — the successor's rate, on a tenure that ran at 500.

The change's own justification for adding `_ctxFor` — *"a context built from
storage would hand the outgoing hook its successor's configuration"* — applies
verbatim to the tax rate and was not applied to it. Nil impact today
(`MinimumTenureHook` reads it only in `before` callbacks); wrong for any
third-party hook closing per-tenure books.

`occupant`/`occupiedSince`/`currentPrice` are post-`_vacate()` zeros, which reads
as deliberate. `taxPercentage` is neither the old value nor an obviously
intended one.

### M-07 · The re-entry bar punishes the liquidated party, over-long and unclearable agent-confirmed

`src/hooks/MinimumTenureHook.sol:224`

The ledger's justification is closing a *free* renewal loop. Liquidation is not
one — it costs the occupant their whole deposit. But `afterLiquidate` bars them
anyway, for a full window measured from the liquidation. On a slot at
`MAX_TENURE`, one second of insolvency locks an account out for **ten years**,
while the liquidator buys in with full protection. No clearing path exists, and
the deadline is derived from the `hookData` in force at exit — reducing a slot's
window later does not shorten bars already written.

### M-08 · `generated.ts` is mid-flight: stale on every chain ✅ verified

`packages/contracts/src/generated.ts`

Still pins the base/base-sepolia addresses whose records were deleted, and the
31337 entries are stale too (local redeploy under the new namespace without a
codegen). `packages/contracts/src/index.ts:57` derives `CHAINS` from
`slotFactoryAddress`, so a production build still offers Base and Base Sepolia,
where the slot detail page throws (`hookData()` does not exist on the deployed
Slot; `pending()`'s 5 words decode into a 6-output ABI) and `createSlot` reverts
on a changed selector.

Self-heals on the real chains — the CLI runs codegen after a successful broadcast.
Does **not** self-heal for 31337 until the next `dev:local`. Nothing catches it:
`.github/workflows/` holds only `publish.yml`, so there is no codegen-diff check.

### M-09 · Ponder treats "same hook, new `hookData`" as no hook change agent-confirmed

`packages/ponder/src/slot.ts:776`

`hookChanged` is computed from the address alone. Re-proposing the same hook with
different data — now the *only* way to change a window — writes
`termsAppliedEvent` with `hookChanged: false` while `previousHookData !==
hookData`, and there is no `hookDataChanged` column.

Worse: the `else` branch at `:783-796` reuses the row's flag snapshot instead of
re-reading, whereas `_applyPending` re-reads unconditionally. For an upgradeable
hook at the same address the `hook*` flag columns then drift permanently.

`slot.hookData` itself is written unconditionally and stays correct.

### M-10 · `MAX_TENURE` is mirrored nowhere in TypeScript agent-confirmed

`apps/landing/src/app/app/create/schema.ts:101`

Only enforces `tenureValue > 0`. `"months"` is an offered unit, so `200 months`
passes zod and reverts `TenureTooLong(315360000)` on chain. Single-slot creation
has a `simulateCreateSlot` preflight that surfaces it; `slotCount > 1` has none,
so the first wallet prompt is the error. Separately, `toSeconds` does
`BigInt(Math.round(n * mult))` — an input large enough to reach `Infinity` throws
an unhandled `RangeError` inside the submit handler.

---

## LOW / structural

- **L-01** `UpgradeProtocol.s.sol`'s layout check compares a contract to itself ✅ verified.
  `_reference(name)` returns `_artifact(name)`, so `validateUpgrade` is vacuous and
  `"storage layout: compatible"` always prints. Mitigated by the script being
  **fully orphaned** — grep finds only its own self-references; the CLI runs
  `DeployProtocol` and gates layout in TypeScript. Delete it or fix both.
- **L-02** `ProtocolConfig.deployedVersion()` reads `.version` unguarded ✅ verified,
  where `deployed()` guards with `vm.keyExistsJson` *specifically because pre-port
  records lack that key*. On exactly the chains that guard exists for,
  `deployedVersion` reverts where `deployed` returns 0. Currently unreachable —
  no Solidity script calls it.
- **L-03** `SeedSlots._minDeposit` hand-writes the deposit formula against its own
  local `MONTH`/`BASIS_POINTS` instead of calling `SlotMath.depositFor`. It uses
  the plain product `price * tax * window` — precisely the overflow `SlotMath`
  was written to eliminate — and hardcodes the constants `SlotConstants` exists
  to stop consumers hardcoding. Last hand-inlined copy in non-v1 code.
- **L-04** A hook predating the interface fails closed but **illegibly**: a contract
  compiled against the old `ISlotHook` reverts with empty revert data on the
  missing selector, bubbled bare out of `proposeTerms`. Nothing distinguishes
  "hook is too old" from "hook rejected your data". Live slots are unaffected —
  an attached hook is never re-validated.
- **L-05** A composite that validates at proposal time can be silently detached at
  apply time: `_readHookFlags` calls `validateHookData` uncapped, `_tryReadHookFlags`
  caps it at `HOOK_GAS`, and `_all` applies no per-child budget. Fail-open, so
  recoverable, but two validations disagreeing is what an attach-time check exists
  to rule out.
- **L-06** On a hook swap during `buy`/`sell`, the outgoing hook is never told its
  tenure ended — `_afterOn`/`_ctxFor` close this for `release`/`liquidate` only.
  Small blast radius (needs a proposal plus `TERMS_DELAY`); `AdLandCreatives` is
  immune by construction and `MinimumTenureHook` does not subscribe.
- **L-07** Pre-existing return bomb on the eviction path: `SlotHooks.sol:220`'s
  discarded tuple element still compiles to a full `returndatacopy`. A hook
  spending its stipend on memory can cost the slot ~585k **uncapped**, on
  `afterSettle` and again on `afterLiquidate`. Cannot block eviction; it is the
  largest uncapped term in the M-03 table. `assembly { pop(call(...)) }` removes it.
- **L-08** A fallback-bearing child launders both `before` and `validateHookData`:
  `ChildHasNoCode` checks `code.length != 0`, which does not imply the child
  implements the selector. A permissive fallback returns success, and `_all`
  reads success as assent. The change extends this to the validation path — the
  one path whose purpose is catching attach-time mistakes.
- **L-09** "At most one child may take configuration" is enforced against
  *validation*, not against *reading*. Two children with disjoint requirements
  genuinely fail closed (good). But a child that validates permissively and then
  reads `ctx.hookData` in its own units is unconstrained — `{MinimumTenureHook,
  SomeFloorHook}` with `hookData = 604800` gives one a 7-day window and the other
  a 604,800-wei price floor, both "validated".
- **L-10** SDK asymmetry: `proposeTerms` rejects `hookData` without `hook`, but not
  `hook: zeroAddress` + non-zero `hookData`, which the contract reverts on.
  `assertSlotInit` covers the equivalent case at creation. Also never
  length-checks `hookData`, so a short hex throws from inside viem's encoder
  rather than as a `SlotsError`.
- **L-11** A failed `hookData` read in ponder is indistinguishable from "no
  configuration" and is never retried (`helpers.ts:417` → `factory.ts:134`). Reads
  are pinned to the creation block with `allowFailure: true`. This indexer runs
  free-RPC-only by design, so `eth_call` failures are the expected mode.
- **L-12** `UpdateRelayed` does not carry `hookData` (`SlotGovernance.sol:117`):
  `proposeHook` now takes `newHookData` but still emits only `_asValue(newHook)`.
  An indexer sees a hook proposal with no record of its configuration.
- **L-13** Third copy of the zero literal — `packages/ponder/src/helpers.ts:19`
  redefines `ZERO_DATA` instead of importing the SDK's `ZERO_HOOK_DATA`.
- **L-14** Pending panel hides the window; the explorer never selects
  `hookData`/`pendingHookData`; `use-tenure-window` discards `isLoading` and so
  renders "no window" on first paint.
- **L-15** The tenure hook is anvil-only until the redeploy, so `section-hook.tsx:74`
  hides the option on every real chain while `docs/sdk/client.mdx:204` presents
  `minimumTenureHookAddress[chainId]` as if it resolves.
- **L-16** `packages/mcp/src/index.ts` is entirely V1 and imports a type the SDK no
  longer exports; it builds only because tsup does not typecheck.

## Verified clean

Worth recording, because these were the likely failure modes:

- **`hookData` lifecycle has no desync.** Six write sites total; every one writes
  `hook` and `hookData` in the same unbranched statement group. Traced:
  propose-then-propose, tax-only, cancel-one-dimension, detach, fail-open apply.
  `delete pending` zeroes the new field (`Pending` has no mappings).
  `mutableHook == false` genuinely freezes both halves.
- **Storage layout is correct**, computed with `forge inspect`: terms 0–4, gap
  5–54 · hooks 55–56, gap 57–106 · occupancy 107–110, gap 111–160 · economics
  161–164, gap 165–214 · pending 215–217, gap 218–267 · orders 268–270, gap
  271–320. Every group ends in exactly 50 gap slots. No derived contract declares
  state. `recipient` genuinely is slot 0 — the OZ bases use ERC-7201 namespaced
  storage.
- **`SlotContext` has exactly one construction site** (`_ctxFor`), so a missed
  field is structurally impossible. All eight call sites carry the right data;
  `_settle()` always precedes `_applyPending()`, so `afterSettle` gets the
  outgoing pair.
- **hook / flags / data can never desync** — written as a set of three in exactly
  two places, and `_applyPending` is reachable only from `nonReentrant`
  transitions.
- **Encoding round-trip is an exact inverse** across all three layers:
  `toHex(seconds, {size: 32})` ↔ `uint256(bytes32)` ↔ `BigInt(hookData)`.
- **`SlotInit`'s nine fields line up by name**; appending `hookData` after
  `proposedAt` means every existing 5-element `pending()` destructure still lines up.
- **Ponder writes `hookData`/`pendingHookData` on every path** that changes them
  and clears them exactly where the contract does.
- **No lingering references** to `MinimumTenureHookFactory`, `predictTenureHook`,
  `getOrDeployTenureHook`, or `minimumTenureHookFactoryAddress`.
- **Return bombs on the two new calls are impossible** — the staticcall output
  buffer is size 0 for `validateHookData` and 256 bytes for `hooks()`.
- **Fail-closed is correct at both attach sites** — neither is reachable from
  `_liquidate`, and the caller is the party that named the hook.
- **The namespace bump is load-bearing**: old slot 3 was `hook`, new slot 3 is
  `taxPercentage`; old `lastSettled` lived in slot 2's high bytes and now lives at
  162. An old slot running new code reads `lastSettled == 0` and is instantly,
  permanently insolvent. **Do not revert the bump.**

---

# Part 2 — Conventions, naming, clean code

## Highest reader impact

### N-01 · Stranded NatSpec — five blocks attached to the wrong declaration

solc attaches a doc block to the *next* declaration. Five blocks describe
function A and land on function B, leaving A undocumented:

| location | describes | actually documents |
|---|---|---|
| `SlotHooks.sol:56-69` | `_readHookFlags` ("Deliberately NOT fail-open") | `_tryReadHookFlags`, which **is** fail-open |
| `SlotAccounting.sol:119-125` | `_applyPending` | `pendingApplies()` |
| `DeployProtocol.s.sol:224-242` | `_proxy` | `_beacon` |
| `SlotOrders.sol:9-27` | `contract SlotOrders` | `struct SellOrder` |
| `SeedSlots.s.sol:165-170` | `_record` | `_deployed` |

The first is the worst: two functions that form a fail-closed/fail-open pair,
with the block asserting the opposite of what the function below it does. This
change *added* the `hookData` paragraph into that stranded block.

Plus three dead blocks documenting functions that moved:
`SlotFactory.sol:31-36` and `OfferBook.sol:92-97` both document
`initializedVersion()` (now on `VersionedUUPS`) — and the OfferBook one is
ABI-visible: `forge inspect OfferBook userdoc` returns
`"initialize(address)": {"notice": "Which migration has run against THIS proxy's storage."}`.

### N-02 · False invariant claims

- `MinimumTenureHook.sol:45` — *"this hook does not subscribe to [liquidation] at
  all"*, contradicted by `f.afterLiquidate = true` at `:165`, which **writes
  storage**.
- `MinimumTenureHook.sol:161` — *"the ONE transition the protected party
  controls"* introduces a block subscribing to two, one of which (liquidation) is
  precisely the transition they do not control.
- `MinimumTenureHook.sol:22` — *"this contract holds no per-slot state at all"*,
  contradicted by `reentryAllowedAt` at `:107`. Should read *no per-slot
  configuration*.
- `MinimumTenureHook.sol:90` — the named overflow site is wrong. Verified
  numerically: `uint256(bytes32("7 days"))` = 2.49e76 and `occupiedSince + window`
  does **not** overflow. What reverts is `taxBps * window` (2.5e80) inside
  `depositFor`, reached from `_requireFunded` — which runs first. Conclusion
  holds, mechanism named does not.
- `Versioned.sol:30` — *"CI enforces this"*. `.github/workflows/` holds only
  `publish.yml`; no job builds contracts. CI was deliberately dropped earlier.
- `AdLandLens.sol:12` — *"Nothing here reverts"*, but `creativeOf` makes two
  unguarded external calls with no `try`, unlike `ad()` which guards both.
- `OfferBookInternals.sol:14` — `_fundable` checks `price + deposit` but
  `SlotOccupancy.sell` pulls `price + deposit + arrearsOf[buyer]`. A bidder with
  arrears is reported fundable and their fill reverts — the "button that lies"
  this file exists to prevent.

### N-03 · Stale designs in prose

- `CompositeHook.sol:104` — *"the way `MinimumTenureHook`'s duration does"*. It
  doesn't any more; that is this change's whole point.
- `SlotCollective.sol:26` — *"three governable dimensions"*; there are two.
  `:112` — *"admin of all four manager roles"*; there are three. `:16` still uses
  v1 vocabulary ("utility", "occupancy-policy"). `:46` names
  `proposeTaxUpdate(9999)`, which no longer exists.
- `SlotCollectiveFactory.sol:16` — same stale counts; `:121` claims a contrast
  with `SlotFactory` that `SlotFactory.initialize:84` no longer supports (it now
  creates the beacon owned by itself). Two files, opposite accounts of one fact.
- `SlotGovernance.sol:103` quotes two events that exist only in `src/v1/`;
  `:140` cites `Slot._asValue`, also v1-only.
- `interfaces/ISlot.sol:6` — describes a location (the storage base) and a
  completeness ("the only way to see it whole") that are both now false; nine
  more slot events live in `SlotAccounting`, `SlotHooks` and `SlotOrders`.
- `SlotStorage.sol:27` — "twelve slots from the `hook`"; the old layout made it
  fourteen. `:141`'s "APPEND BELOW THIS LINE ONLY" contradicts the new rule at
  `:30` ("a new field REPLACES gap space").
- `foundry.toml:38` justifies `via_ir` by "Feed.initialize's wide param list";
  `Feed` does not exist anywhere in `src/`, `script/` or `test/`.

## Naming

- **`taxPercentage` holds basis points.** Six names for one quantity:
  `taxPercentage`, `taxBps`, `MAX_TAX_BPS`/`maxTaxBps`, `newTax`, `newPct`, `tax`.
  `SlotConstantsInfo` returns `maxTaxBps` beside `SlotInfo.taxPercentage` — two
  structs a client fetches together, disagreeing about the unit's name. **Public.**
- **`buy` is the only place where deposit precedes price.** Everything else is
  price-first: `SellOrder`, `SlotContext`, `Bought`/`Sold`, `Offered`,
  `depositFor`, `requiredDeposit`. Two adjacent `uint256`s in a non-obvious order.
  **Public** — reorder in a break that is already happening, or never.
- **`manager` means two things.** The slot's propose-terms role, and
  `SlotCollectiveFactory`'s product (`createManager`, `managers`, `managerCount`,
  `SlotCollectiveDeployed(address indexed manager, …)`) — while the registry two
  lines away is `isSlotCollective`.
- **`NotManager()` means three unrelated things**: genuine authorization
  (`SlotStorage.sol:146`), *configuration is wrong* (`Slot.sol:75,77` — nobody was
  unauthorized), and `msg.sender != admin` on a factory that has no manager
  (`SlotFactory.sol:68`). Similarly `InvalidRecipient()` is thrown for a zero
  buyer and a zero admin. Three admin-error vocabularies across four contracts.
- **`TermsProposed` carries `hook_`** purely to dodge a collision with `hook`;
  the propose/cancel flags have three spellings (`changeTax`/`tax`/`cancelTax`).
  `hook_` will land in generated TS looking like a typo. **Public.**
- **Five names for "smallest acceptable deposit"** — and one of them (L-03)
  re-derives the formula.
- **The order book renames both of `SellOrder`'s identity fields**:
  `bidder`/`expiry` against `buyer`/`deadline`, translated at the boundary.
- **Two live structs named `Pending`**; their timelocks are `TERMS_DELAY` and
  `CHANGE_DELAY`.
- **`ISlotHook.hooks()`** reads as "this hook's hooks"; everything downstream
  calls the result *flags*. **Public — breaks every third-party hook.**
- Uniform and needing no work: every internal symbol underscored, every constant
  `CONSTANT_CASE`, every interface `I`-prefixed, 560 uniformly-named tests, zero
  `require` strings in `src/`, and `hook` has fully displaced
  `policy`/`utility`/`module` in the core.

## Style and idioms

- **Two shadowing warnings**, both in `SlotFactory` (`:72`, `:121` shadow
  `implementation()` at `:126`). Not deliberate — the same signature already uses
  `admin_`. Rename to `implementation_`.
- **Seven unused imports in `src/`**: `Slot.sol:5,10,11` (four in one 108-line
  file), `SlotAccounting.sol:6`, `SlotViews.sol:4`, `OfferBook.sol:4`,
  `SlotCollective.sol:10`. Plus ten in `test/`. (`Versioned` imports that look
  unused are load-bearing for `@inheritdoc` resolution — not dead.)
- **Dead errors and events**: `SlotErrors.AlreadyInitialized`, `SlotErrors.Occupied`,
  `CompositeHook.NotOwner`, `CompositeHook.ChildAdded`. The last two are
  documented leftovers from the removed `add()`; `CompositeHook.owner` is now
  read by nothing and reads to an integrator as authority.
- **Dead script members**: `ProtocolConfig.deployedVersion()`,
  `MainnetNeedsAnExplicitFlag`, `ChainConfig.explorerVerify` (parsed from every
  chain JSON, read by no script — the real consumer is `chains.ts`).
- **Missing events**: `SlotCollectiveFactory.initialize` and `OfferBook.initialize`
  emit no genesis `AdminTransferred`, where `SlotFactory.initialize:85` does
  specifically so an indexer sees it. `MinimumTenureHook`'s re-entry bar is
  invisible to any indexer.
- **`OperatorSet` cannot be replayed against its tenure.** `setOperator` writes
  `_operatorOf[tenureId][operator]` but emits no `tenureId`. Since the whole
  design is that approvals die with the tenure, an indexer cannot reproduce
  `isOperator` from logs.
- **`TermsProposed`/`TermsApplied` index nothing.** `hook` should be indexed —
  "which slots proposed hook X" is the query, and `HookAttested` already indexes it.
- **`pragma ^0.8.23`** in all three `collectives/` files against `^0.8.24`
  everywhere else; nothing needs 0.8.23.
- **`abi.encodeWithSignature` in the deploy scripts** where the codebase uses
  type-checked `abi.encodeCall` throughout. `require(ok, "upgradeBeacon failed")`
  swallows the revert reason of the most consequential call in the protocol.
- **`list.length` re-read from storage per iteration** in `OfferBook.best`,
  `liveCount`, `board` — the sibling files already cache it.
- `CompositeHook`'s declarations interleave constants and state four times with no
  banner. `TENURE_HOOK_VERSION` and `_IMPL_SLOT` are buried mid-file in
  `DeployProtocol`.
- **Upgradeability idioms are clean**: no `selfdestruct`, no untrusted
  `delegatecall`, `_disableInitializers()` present everywhere it is needed,
  `VersionedUUPS` used by everything that should and nothing that shouldn't, and
  exactly one `immutable` in the live tree (on a contract that is not proxied).

## Structure and tests

- **`script/protocol/UpgradeProtocol.s.sol` is fully orphaned** (see L-01). Its
  `_candidateVersion` also knows only three of the six entries in `inspect.ts`'s
  `PROXIES`.
- **The v1-era `script/` tree can still overwrite the v2 address book.**
  `script/Base.s.sol:87 _saveDeployment` writes the *same* paths
  `ProtocolConfig.record` uses, with no `version` field — the exact hazard
  `ProtocolConfig.sol:192-208` and commit `b0ff4c6` describe, still reachable by a
  stray `forge script`. Eleven of its dependents are referenced by nothing at all.
  Suggest moving them under `script/v1/`.
- **Three writers and three readers of the deployment-record JSON**, with three
  different field sets — and `ProtocolConfig`'s `keyExistsJson` guard, documented
  at length as load-bearing, is absent from `SeedSlots._deployed` 60 lines away.
- **`src/interfaces/ISlot.sol` is a third placement convention** for one file
  (core interfaces are top-level; module interfaces sit beside their
  implementation). It declares no functions, only events — v1 named this exact
  thing `ISlotEvents`. Suggest `src/ISlot.sol`, or rename.
- **`buy`/`sell` share two copy-pasted blocks** (arrears settlement, seating), and
  `release`/`liquidate` share a third — this change had to add
  `bytes32 outgoingData` to both independently, which is the drift arriving.
- **Coverage gaps in the core**: `SlotEscrow` 8.33% branch (1/12), `SlotOccupancy`
  22.22% (4/18), `Slot` 40% (4/10). Never called by any V2 test:
  `SlotEscrow.withdraw` — *including the `_requireFunded` floor that
  `MinimumTenureHook.sol:48-61` explicitly relies on to bound its escrow leak* —
  and `SlotEscrow.claim`. Never asserted: `PaymentAboveMax`,
  `CannotBuyFromYourself`, `SellNeedsErc20`, `NotInsolvent`, `OrderExpired`,
  `HookCallFailed`, `Credited`, and **the entire arrears carry-forward
  mechanism** (`grep arrearsOf` across V2 tests returns nothing).
- **`CompositeHook`'s veto semantics are untested** — 46.67% function coverage.
  `_all` runs only via `validateHookData`, never with a child that refuses, so
  "any child that reverts vetoes the action" — the claim its header argues for —
  has no test.
- **The new call is untested against every guard it relies on.** Every hostile
  hook in the suite implements `validateHookData` as a benign no-op. The
  2×`HOOK_GAS` path is never executed by any test:
  `test_AGasBurningHookCannotBlockLiquidation` attaches the burner at creation, so
  `pendingApplies()` is false and `_applyPending` returns early.
- **`_requireFunded`'s `max(newPrice, currentPrice)` anchoring is never asserted**
  — every buy test enters at or above the sitting price, and the one test that
  takes the `currentPrice` branch passes `deposit: 0` under a bare
  `vm.expectRevert()`, so it would pass under either basis.
- **`reentryAllowedAt` appears in zero test files.**
- **25 bare `vm.expectRevert()`** across the V2 suite accept any revert. In hook
  tests this cannot distinguish "the hook refused" from "the slot's funding check
  refused" — the exact distinction those tests exist to draw.
- **Duplicated scaffolding**: a byte-identical mock ERC20 in five files,
  `MockSlot` in two, the same factory-and-proxy setup in thirteen, and six
  hand-rolled `ISlotHook` implementations each restating all eight callbacks.
- `forge coverage` does not run without `--ir-minimum` (stack-too-deep in
  `SeedSlots.s.sol:101`). Worth pinning in a package script.

---

# Suggested order of work

Not started — recorded for a decision.

**Before any broadcast:**

1. **C-02** — the uncatchable revert. Rule 1 is the protocol's first promise.
2. **H-01** — same shape, reachable with no 7702; fixing C-02 alone leaves it.
3. **H-06** — one line; the ledger otherwise lies about what is behind the beacon.
4. **M-01** — one hoist; saves 44% of the deploy and six orphan contracts.

**Before the hook is offered to anyone:**

5. **C-01** — the sell-loop. Needs a design decision, not a patch: an absolute
   floor on `sell`, or a bar consulted on the `sell` path, or `SlotContext`
   carrying the displaced occupant (it currently cannot — see L-06).
6. **H-02** — one-word fix (`ctx.slot` on the write side).
7. **H-03**, **H-04** — the same class as C-01; worth solving together.
8. **H-05** — the manager UI, which currently cannot express a window at all.

**Then:** M-02 through M-10, the false-invariant comments (N-02) and the stranded
NatSpec (N-01) — the latter two matter more than usual here, because this
codebase deliberately leans on its prose to document invariants.

**Deliberately not proposed:** any public rename (`taxPercentage` → `taxBps`,
`buy`'s parameter order, `hooks()` → `subscriptions()`). Each is defensible only
inside a break that is already happening, and that window is the redeploy now
being staged.
