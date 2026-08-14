# Tax Accounting Utilities & Weighting Curves — design

**Status:** design only, not built.
**Builds on:** [`2026-08-02-slot-launchpad.md`](./2026-08-02-slot-launchpad.md) — read that first. It defines the raise (escrow, soft cap, refunds, launch trigger). This document defines the *accounting and weighting layer* underneath it.
**Supersedes:** `docs/TOKEN_LAUNCHER.md`, which targets a `SlotsHub` / `openLand` / Superfluid API that no longer exists in this codebase.

---

## 1. Scope

The launchpad draft assumes one allocation rule:

```
allocation[addr] = supply × Σ TaxPaid(addr).taxPaid / Σ all TaxPaid.taxPaid
```

Flat pro-rata. This document generalises that denominator into a **pluggable weighting curve**, so a launch can weight tax paid by amount (concave or convex), by *when* it was paid, or by how long the payer has held their slot — and adds the on-chain accounting contract that feeds it.

In scope: the ledger utility, the curve interfaces and four curves, the distributor, the close semantics.

Out of scope, owned by the launchpad draft: escrow, soft cap, refunds, launch trigger, LP seeding, the ERC-20 itself.

### Decisions taken as given

| Decision | Value | Where it came from |
|---|---|---|
| Launch scope | Many slots, one launch | Scoping |
| Supply model | Fixed pool, pro-rata at close | Scoping |
| Curves to ship | Flat, concave, convex, time-decay, tenure | Scoping |
| Source of truth | **On-chain ledger** | Scoping — see §2 |
| Upgradeability | Immutable, factory-deployed | §3 |
| Currency | One per launch, enforced at enrollment | §3 |

---

## 2. The decision that reverses the earlier draft

The launchpad draft made the opposite call, and its reasoning still stands on the facts:

> `Slot._notifyModule` is gas-capped at 500k and swallows failures. A module that reverts or runs out of gas **silently loses a contribution**, and the participant gets no revert telling them.

That is true. [`Slot.sol:1047`](../../../apps/contracts/src/Slot.sol#L1047) is `call{gas: 500_000}` with `if (!ok) emit ModuleCallFailed(name)`. `TaxPaid` is the authoritative record; the hook is not.

The on-chain design is chosen anyway, on three grounds:

1. **The gas limb of the risk is measurable and small.** The hook path below is ~5 storage writes, one `staticcall`, and one fixed-point op. If it is tested to fit in a fraction of 500k (§10), the remaining failure mode is a *bug*, not a gas cliff — and a bug is equally fatal to an off-chain indexer's assumptions.
2. **Loss becomes detectable rather than silent.** The ledger tracks `creditedFrom[slot]` and compares it against the slot's own cumulative `collectedTax()`. Any divergence is a public, queryable number (§8).
3. **For the amount curves, loss becomes *repairable*.** Because `rawTax` is credited before the curve is consulted, and because the amount curves are path-independent, `resyncWeight(payer)` recomputes an affected payer's weight exactly (§6).

**What it costs you:** trustlessness is bought with a real reduction in accuracy guarantees. Points 2 and 3 detect and repair drift in `weight`; they cannot repair a hook that failed *entirely*, because then `rawTax` never incremented either. Against that, only an off-chain reduction over `TaxPaid` is exact by construction.

**If accuracy is worth more than trustlessness, the earlier draft was right and this document should be re-scoped to approach C** (ledger for live state, merkle root as settlement authority at close, ledger totals usable to challenge a bad root). The contracts below are deliberately shaped so that C is an additive change: `TaxDistributor` is a separate contract that reads final weights, so a `MerkleDistributor` can replace it without touching the ledger or the curves.

---

## 3. Components

Four contracts, each with one job.

```
TaxLedgerFactory ──deploys──> TaxLedger  (IUtility, immutable)
                                 │  attached as utility on every enrolled Slot
                                 │  reads ─────> IWeightCurve
                                 │                  ├── IAmountCurve      (Linear | Power)
                                 │                  └── IPaymentMultiplier[] (TimeDecay | Tenure)
                                 │
                                 └──read by────> TaxDistributor (holds supply, pays claims)
```

### 3.1 `TaxLedger` — the accounting core

Implements [`IUtility`](../../../apps/contracts/src/interfaces/IUtility.sol). One instance per launch, attached as the utility on every enrolled slot.

State:

```solidity
mapping(address payer => uint256) public rawTax;       // currency units actually paid
mapping(address payer => uint256) public weight;       // curve-adjusted
uint256 public totalWeight;
mapping(address slot  => bool)    public enrolled;
mapping(address slot  => uint256) public creditedFrom; // for drift detection
uint256 public closedAt;                               // 0 while open
```

Immutable config: `owner`, `currency`, `curve`, `opensAt`, `closesAt`, `decimalsScale`, `excludeRecipients`.

**`enroll(address slot)`** — owner-only, and asserts:

- `SlotFactory.isSlot[slot]` ([`SlotFactory.sol:81`](../../../apps/contracts/src/SlotFactory.sol#L81)) — the factory already maintains a public registry of genuine slots, so no bespoke allowlist is needed and no counterfeit contract can mint itself credit.
- `Slot.currency() == currency` — **this is how multi-currency is resolved.** A launch is single-currency. Summing 6-decimal USDC against 18-decimal WETH into one weight is meaningless, and the alternatives (fixed per-currency multipliers, or an oracle) add a manipulation surface to the one number the whole launch turns on. A genuinely multi-currency launch runs one ledger per currency and splits the supply between them explicitly.

**`unenroll(address slot)`** stops future credit and **never erases credit already earned** — otherwise the owner could rug a payer retroactively.

`onSettle` is the only mutating hook. Order is load-bearing:

```
1. if (!enrolled[msg.sender])                              → forward downstream, return
2. if (excludeRecipients && payer == Slot(..).recipient()) → forward downstream, return
3. rawTax[payer]           += paid       ← always, before the curve is consulted
   creditedFrom[msg.sender] += paid      ← always, even after close (§9)
4. if (closedAt != 0)                                      → forward downstream, return
5. staticcall curve (gas-budgeted)
     ok  → weight/totalWeight updated per §6
     !ok → emit CurveCallFailed; rawTax stands, weight repairable via resyncWeight
6. forward all hooks to `downstream` utility, gas-budgeted, in try/catch
```

Two orderings here are load-bearing. Step 3 preceding step 5 is what makes §2's repairability argument work. Step 3 preceding step 4 is what keeps `rawTax` and `creditedFrom` complete after close — the drift check (§8) must stay meaningful for the historical record, and `weight` is what freezes at close, not the accounting.

### 3.2 `IWeightCurve` — the weighting layer

See §5.

### 3.3 `TaxDistributor` — custody and claims

Holds the supply, reads `weight[payer]` and `totalWeight` from a **closed** ledger, pays `supply × weight / totalWeight`.

Kept separate from the ledger rather than merged, for two reasons: one ledger can back several distributions (a later airdrop can reuse the same accounting history without re-running the raise), and it is the seam at which approach C could substitute a `MerkleDistributor`.

### 3.4 `TaxLedgerFactory`

Mirrors [`MinimumPricePolicyFactory`](../../../apps/contracts/src/policies/MinimumPricePolicyFactory.sol).

### 3.5 Immutable, not UUPS

The repo has both precedents: utilities are UUPS-upgradeable ([`FeedPostModule`](../../../apps/contracts/src/modules/FeedPostModule.sol)), policies are immutable constructor args plus a factory ([`MinimumPricePolicy.sol:57`](../../../apps/contracts/src/policies/MinimumPricePolicy.sol#L57)).

**Follow the policy precedent.** A UUPS ledger means its owner can rewrite every participant's allocation after they have paid for it. That is the exact trust assumption the on-chain approach was chosen to avoid, and shipping it upgradeable would make §2's whole argument moot.

The curves are immutable for the same reason, and a launch's curve is fixed at ledger construction.

### 3.6 Hook forwarding — why the ledger is a pass-through

A `Slot` has exactly **one** utility. Attaching a `TaxLedger` therefore means the slot cannot also run `FeedPostModule` — a launch board could not be on the Feed, which for this protocol is close to disqualifying.

So `TaxLedger` holds an optional `downstream` address and forwards all five `IUtility` hooks to it, proxying `metadataURI()` but **not** `feeBps()` (§7). Two rules:

- **Credit first, forward second.** A broken downstream utility must never cost anyone their allocation.
- **Sub-budget the forward** (~250k of the 500k) inside `try/catch`, so downstream gas exhaustion cannot starve the ledger's own writes.

---

## 4. Slot configuration required of an enrolled slot

Carried forward from the launchpad draft, unchanged, because each item is a correctness requirement and not a preference:

| Setting | Value | Why |
|---|---|---|
| `recipient` | the Escrow | tax flows into the raise — and see §7.2 |
| `utility` | the TaxLedger | receives `onSettle` |
| `mutableTax` | **false** | a manager changing the rate mid-raise silently rescales everyone's accrual |
| `mutableUtility` | **false** | swapping the ledger mid-raise breaks the accounting |
| `mutablePolicy` | **false** | the occupancy policy is the only brake on §7.1; a manager relaxing it mid-raise reopens sybil splitting |
| `occupancyPolicy` | `MinimumTenurePolicy` | a participant sniped seconds after buying is a terrible experience — and it is the main brake on §7.1 |
| `minDepositSeconds` | > 0 | forces a real deposit, so declared prices are backed |

---

## 5. The curve layer

Four curves were requested. Shipping them as four monolithic `IWeightCurve` implementations would duplicate the fixed-point maths four times and permit no combinations. They factor cleanly instead, because two of them are functions of *amount* and two are functions of *this payment's circumstances*:

```solidity
struct CurveContext {
    address slot;
    address payer;
    uint256 timestamp;      // block.timestamp at settle
    uint256 opensAt;
    uint256 closesAt;
    uint256 tenureSeconds;  // from Slot.occupiedSince(); 0 if unknown
}

interface IAmountCurve is IModuleMetadata {
    /// Non-decreasing, f(0) == 0. Pure.
    function cumulativeWeight(uint256 raw) external view returns (uint256);
}

interface IPaymentMultiplier is IModuleMetadata {
    /// Wad-scaled multiplier for this single payment.
    function multiplierWad(CurveContext calldata ctx) external view returns (uint256);
}

interface IWeightCurve is IModuleMetadata {
    function newWeight(
        uint256 prevRaw,
        uint256 prevWeight,
        uint256 paid,
        CurveContext calldata ctx
    ) external view returns (uint256);

    function pathIndependent() external view returns (bool);
}
```

`WeightCurve` is the single `IWeightCurve` implementation the ledger ever talks to. It composes one `IAmountCurve` with zero or more `IPaymentMultiplier`s (§6).

### 5.1 `LinearCurve` — flat %

`cumulativeWeight(raw) = raw`. Allocation is share of money paid. The launchpad draft's rule, unchanged, and the default.

### 5.2 `PowerCurve(k)` — concave *and* convex

`cumulativeWeight(raw) = raw^k`, one contract covering both requested shapes:

- **k < 1 (e.g. 0.5) — concave, anti-whale.** Doubling your tax gives ~1.41× the allocation, so breadth of participation beats concentration. Quadratic-funding shaped.
- **k > 1 — convex, superlinear.** Concentrates allocation in the largest taxpayers; sybil-proof by construction, since splitting across addresses strictly hurts you.
- k = 1 degenerates to `LinearCurve`; use `LinearCurve` instead, it is far cheaper.

Implementation notes: Solady is **already a dependency** (`solady/=lib/solady/src/`), so `FixedPointMathLib` covers this with no new library — a `sqrtWad` fast path at k = 0.5 and `powWad` otherwise. Confirm exact symbol names against the pinned Solady version at implementation time. Inputs must be scaled to wad first via the immutable `decimalsScale` (`raw × 10^(18 − currencyDecimals)`), since raw amounts are in currency decimals and `powWad` is wad-domain.

### 5.3 `TimeDecayMultiplier` — early bird

`multiplierWad(ctx)` decays linearly from `startMultiplierWad` at `opensAt` to `endMultiplierWad` at `closesAt`, with `timestamp` clamped to that range.

Linear rather than exponential: cheaper, legible to participants, and easier to reason about at the boundaries. Curves over *when* you paid rather than how much, so it composes with either amount curve, and it is sybil-resistant — splitting across addresses does not change timing.

### 5.4 `TenureMultiplier` — committed holders

`multiplierWad(ctx)` scales from `1.0` at zero tenure to `maxBonusWad` at `maxTenureSeconds`, on `ctx.tenureSeconds`.

Each payment is weighted by the tenure *at the moment it was paid*. This is what avoids retroactive recomputation: a long continuous hold earns increasingly weighted payments over its life, with no need to ever revisit past credits.

**`tenureSeconds` is read from the slot, not tracked locally.** [`Slot.occupiedSince`](../../../apps/contracts/src/Slot.sol#L73) is public, so the ledger `staticcall`s it. This matters: tracking occupancy locally via `onTransfer`/`onRelease` would inherit the same swallowed-hook drift as everything else, and a missed transfer would corrupt tenure indefinitely. Reading it is drift-free.

**Subtle correctness point that makes this work:** `onSettle` fires from `_accrue` inside `_settle()`, which is the first statement of every mutating entry point, *before* occupancy is reassigned. During a `buy()`, `occupiedSince` therefore still describes the outgoing occupant — who is exactly the payer being credited ([`Slot.sol:860-869`](../../../apps/contracts/src/Slot.sol#L860)). The same holds for `release` and `liquidate`, which zero `occupiedSince` only after `_settle()` has run. The pre-operation state is the correct state to read here. This must be pinned by a test, since it depends on statement ordering inside `Slot`.

### 5.5 Composition

`WeightCurve(amountCurve, multipliers[])` gives every combination from five small contracts — sqrt × early-bird, convex × tenure, and so on. An empty multiplier list is the canonical no-multiplier path.

**YAGNI applied:** no on-chain curve governance (the curve is immutable per launch), no user-supplied arbitrary curve bytecode, no epoch tranches (the protocol deliberately removed epochs from `Slot` in `UpgradeV4NoEpochs`).

---

## 6. Weight accumulation

One formula, evaluated at each settle:

```
Δbase    = A(prevRaw + paid) − A(prevRaw)
newWeight = prevWeight + Δbase × Π multiplierWad(ctx) / WAD
```

Then `totalWeight += newWeight − prevWeight`, `weight[payer] = newWeight`.

O(1) per settle. No iteration over payers, ever — weight is separable per payer, which is what makes a non-linear curve affordable on-chain at all.

### Correctness properties

**Exactness with no multipliers.** If `prevWeight == A(prevRaw)`, then `newWeight == A(prevRaw + paid)` exactly. By induction from `A(0) = 0`, weight is always exactly `A(rawTax[payer])`, regardless of how many settles occurred. **A hundred small settles and one large settle produce identical weights.** This is the property that makes on-chain incremental accumulation equivalent to computing the curve once at the end, and it is worth a fuzz test (§10).

**Path-dependence with multipliers is intentional** — time-decay and tenure exist precisely to make *when* you paid matter. `pathIndependent()` returns `multipliers.length == 0`. Per-settle truncation in the `× m / WAD` step introduces drift bounded by one wei per settle per payer; negligible against any realistic supply, but it should be asserted rather than assumed.

**Monotonicity is enforced by the ledger, not trusted from the curve.** If a curve returns `newWeight < prevWeight`, the ledger clamps to `prevWeight` rather than reverting. Reverting would lose the credit outright, since the hook's failure is swallowed upstream — clamping degrades gracefully instead.

**`resyncWeight(address payer)`** recomputes `weight = A(rawTax[payer])` and corrects `totalWeight`. Permissionless, and enabled **only** when `curve.pathIndependent()`, because it is meaningless otherwise. This is the repair path for a failed curve call (§3.1 step 4).

---

## 7. Economic risks

These are the parts most likely to actually go wrong. None is a contract bug; all three are mechanism design.

### 7.1 Sybil splitting under concave curves — the significant one

Slot occupancy is permissionless and this protocol has no identity layer. Under `PowerCurve(0.5)`, one actor splitting tax equally across N addresses multiplies their weight by **√N**. Unbounded and cheap.

This is not a flaw in the implementation — it is what concave curves *are* without identity. Ship `PowerCurve` with k < 1, but document it as requiring a gating occupancy policy, and note the partial brakes:

- `MinimumTenurePolicy` (already in the repo) raises the cost of churning addresses across slots.
- Composing with `TenureMultiplier` means a split participant dilutes their own tenure bonus.
- `minDepositSeconds > 0` forces real capital per address.

None of these bounds the attack; they only price it. **A launch that wants concave weighting and cannot gate identity should use `LinearCurve` instead.** Say so in the docs rather than discovering it during a raise.

### 7.2 Self-dealing

A slot's `recipient` receives the tax paid into it. If a launch insider is both the recipient and the payer, they farm weight at near-zero net cost — the money round-trips.

**The launchpad draft's `recipient = Escrow` already neutralises this**, provided the escrow's non-negotiable property holds: *escrowed funds can only move to the Launcher or to refunds; there is no path to the project owner*. Tax paid into the escrow is then a genuine cost even to an insider.

The `excludeRecipients` flag (§3.1 step 2) exists for launches that enroll third-party slots whose recipients are not the escrow. It closes only the literal case — the same actor paying from a different address is not detectable on-chain — so it is a guard rail, not a solution.

### 7.3 Reflexive pricing

Straight from the launchpad draft, and unchanged by the curve layer: if a slot's only worth is the allocation it accrues, the self-assessed price is circular — you are pricing a claim on a token whose value depends on what everyone else declared. Attach something concrete to occupancy (a sponsor position, a role at launch, a governance seat) so the declared price has a non-reflexive anchor.

The curve layer makes this *sharper*, not softer: a time-decay multiplier gives an explicit reason to pay early, which is a real signal, but a convex curve amplifies whatever reflexivity is already there.

### 7.4 Carried forward, non-negotiable

- **Weight on `paid`, never on `owed`, never on `price × time`.** `_accrue` caps the charge at the remaining deposit, so a large self-assessed price with a tiny deposit accrues enormous `owed` while paying almost nothing. Any weighting derived from `owed` hands that address a large share of supply for no money. `owed − paid` is a distress signal, not an input. This is the single most dangerous available mistake in the design.
- **`feeBps()` returns 0.** `feeBps` is skimmed in `_distributeTax` at collect time, so a non-zero fee means the sum of allocations does not match the money raised — and a launch that skimmed tax would be competing with the very recipients it is trying to attract. The ledger must **not** proxy a downstream utility's `feeBps()`, or a forwarded fee silently reintroduces the mismatch.
- **Unspent deposit is not a contribution.** Only consumed deposit is. Participants need to understand that topping up is not contributing.
- **ERC-20 denominated.** An "ETH raise" is WETH, or native-ETH slots (`Slot.isNative()`), which the enrollment currency check must handle for `address(0)`.

---

## 8. Failure modes and integrity

| Failure | Effect | Handling |
|---|---|---|
| `onSettle` swallowed entirely | Credit lost, silently | Detected by drift check below; **not** repairable |
| Curve `staticcall` fails | `rawTax` credited, `weight` stale | `resyncWeight` repairs exactly, if path-independent |
| Downstream utility reverts | None on accounting | Credited before forward; forward is try/catch |
| Curve returns decreasing weight | None | Clamped to `prevWeight` |
| Non-enrolled slot calls `onSettle` | None | Rejected on `enrolled[msg.sender]` |
| Insolvent occupant (`paid < owed`) | Correctly credited `paid` | By design — §7.4 |
| `taxPercentage` changed mid-launch | Economics shift, accounting still correct | Prevented by `mutableTax = false` (§4) |

**Drift detection.** `creditedFrom[slot]` versus the slot's own cumulative `collectedTax()` gives a public `drift(slot)` view, and `totalDrift()` across enrolled slots. This detects loss without being able to attribute it to a payer. Surfacing it in the indexer and the UI matters more than it sounds — a launch closing with non-zero drift is a launch whose allocations are known to be wrong, and everyone should be able to see that before claiming opens.

**`slotId` is always 0.** `Slot` passes a literal `0` ([`Slot.sol:868`](../../../apps/contracts/src/Slot.sol#L868)) because a Slot *is* the position. Identity is `msg.sender`. Nothing may key on `slotId`.

**Reentrancy.** The ledger's calls back into the slot are `staticcall`s only. The downstream forward is a real `call`, so the ledger updates its own state first and carries its own `nonReentrant` on the hook. `Slot` is itself `nonReentrant`, blocking reentry into the settling slot — but not into a *different* enrolled slot, which the state-first ordering handles.

---

## 9. Lifecycle

```
Configuring ──enroll(...)──> Open ──closesAt reached──> Closed ──> Distributing
```

**The close is a settlement step, not a timestamp.** Tax accrues into each slot's `collectedTax` and is only attributed on a settle. A launch that simply lets `closesAt` pass leaves the last stretch of every occupant's tenure uncredited, and the amount uncredited depends on who happened to transact last — the launchpad draft flags this as gap #1.

So `close()`:

1. is callable by **anyone** once `block.timestamp >= closesAt`, so the owner cannot stall it;
2. sweeps every enrolled slot via [`BatchCollector.collectAll`](../../../apps/contracts/src/BatchCollector.sol) — which already exists and already skips reverting slots — forcing a final `_settle()` and therefore a final `onSettle` on each;
3. sets `closedAt`, freezing `totalWeight`.

Settles arriving after `closedAt` still record `rawTax` (for the historical record) but do not move `weight`. For large boards the sweep may need chunking across transactions before a final `close()` — worth deciding at implementation time, since a board large enough to exceed the block gas limit is a board whose close can be griefed.

**Claims** open on `closedAt`, are pull-based, permanent, and have **no deadline** — no reclaim path for the owner, which keeps the distributor credibly neutral. Integer division leaves dust in the distributor; it stays there. This is deliberate: an owner-reclaim path on unclaimed supply is exactly the kind of hook that turns a neutral distributor into a discretionary one.

---

## 10. Testing

The existing [`TaxAttribution.t.sol`](../../../apps/contracts/test/TaxAttribution.t.sol) already contains a `LedgerModule` sketch commented *"the shape a launchpad would use"* and a `RevertingModule` proving a broken utility cannot brick a slot. Extend that harness rather than starting fresh.

**Unit**
- Each curve: `f(0) == 0`, monotonic non-decreasing, known reference values at k ∈ {0.5, 1, 2}.
- Multiplier clamping at and beyond `opensAt` / `closesAt` / `maxTenureSeconds`.
- Decimal scaling for a 6-decimal currency.

**Fuzz / invariant**
- **Path-independence**: N random settle splits totalling X produce the same final weight as one settle of X, for every `IAmountCurve` with no multipliers. This is §6's central claim.
- `Σ weight[payer] == totalWeight` after arbitrary settle/enroll/unenroll sequences.
- `Σ claimed ≤ supply`, and no payer can claim twice.
- `weight` is non-decreasing per payer across any sequence.

**Integration**
- Full raise: N slots, buys/releases/liquidations interleaved, close via sweep, claims sum to supply minus dust.
- Insolvent occupant credited `paid`, not `owed` — the §7.4 case, extending `test_Insolvent_PaidIsCappedByDeposit_OwedIsNot`.
- Reverting downstream utility costs nobody credit.
- Non-enrolled and counterfeit slots rejected.
- Tenure read during `buy()` attributes to the **outgoing** occupant (§5.4) — pins the statement-ordering dependency inside `Slot`.

**Gas**
- The whole hook path — ledger writes plus worst-case curve (`powWad` with a fractional exponent and two multipliers) plus a 250k downstream — asserted under 500k, with headroom. **This is the test §2's entire argument rests on.** It should fail loudly on regression.

**Adversarial**
- Sybil split under `PowerCurve(0.5)`: assert the √N advantage as a documented, expected number, so a future change that alters it is visible.

---

## 11. File layout

```
apps/contracts/src/
  interfaces/IWeightCurve.sol          IWeightCurve, IAmountCurve, IPaymentMultiplier, CurveContext
  launch/TaxLedger.sol
  launch/TaxLedgerFactory.sol
  launch/TaxDistributor.sol
  launch/curves/LinearCurve.sol
  launch/curves/PowerCurve.sol
  launch/curves/TimeDecayMultiplier.sol
  launch/curves/TenureMultiplier.sol
  launch/curves/WeightCurve.sol        composes one IAmountCurve + N IPaymentMultiplier
apps/contracts/test/
  TaxLedger.t.sol  Curves.t.sol  TaxDistributor.t.sol  LaunchInvariants.t.sol  LaunchGas.t.sol
```

Follow-ups, not in this scope: Ponder/subgraph entities for ledger state and drift, SDK query surface, and the launch UI.

---

## 12. Open questions

1. **§2 is the one to settle first.** A or C. Everything else survives either answer, but the choice is easier now than after the contracts exist.
2. **Chunked close** for boards too large to sweep in one transaction — needed, or is the board bounded small enough that it cannot be griefed?
3. **Does the default launch actually want a curve at all?** `LinearCurve` is the safest and the cheapest, and §7.1 means concave weighting is unsafe without identity. The curve layer may be better framed as an opt-in for launches that have solved gating, with flat as the strong default.
4. **`opensAt` and enrollment**: may the owner enroll new slots mid-launch? Allowing it keeps a growing board workable; forbidding it stops an owner adding a slot they control late. Currently specified as allowed-with-events — worth a second look.
