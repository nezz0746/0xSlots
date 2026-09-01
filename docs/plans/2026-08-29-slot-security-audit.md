# Security Audit — SlotFactory + Slot

**Scope** `Slot.sol` · `SlotFactory.sol` · `SlotModules.sol` · `base/SlotStorage.sol` ·
`base/SlotAccounting.sol` · `base/SlotOccupancy.sol` · `base/SlotEscrow.sol` ·
`base/SlotAdmin.sol` · `base/SlotViews.sol`

**Method** Two rounds of 8 parallel adversarial agents (math-precision, access-control,
economic, execution-trace, invariant, boundary, trust-gap, flow-gap). Round 2 was
given round 1's claims and told to confirm or **refute** them. Every finding below
was then independently verified by executable Foundry PoC — see
`test/AuditPoC.t.sol` (21 tests, all passing). Agent assertions alone were not
accepted as evidence, and four of them were overturned by the PoCs.

**Status** 499 tests pass. Nothing in this audit has been fixed yet.

---

## Severity summary

| # | Severity | Finding | Location | PoC |
|---|----------|---------|----------|-----|
| 1 | **CRITICAL** | `sell` treats a bare allowance as consent — occupant drains any approver | `SlotOccupancy.sell` | ✅ |
| 2 | **HIGH** | Unbounded price overflows `_accrue` — free, permanent slot brick | `SlotAccounting._accrue` | ✅ |
| 3 | **HIGH** | Manager rugs recipient's accrued tax via bounty + Multicall | `SlotAdmin.setLiquidationBounty` | ✅ |
| 4 | **HIGH*** | Legacy proxies may be re-initializable by anyone (*reachability unverified*) | `Slot.initialize` | ✅ mechanism |
| 5 | **MEDIUM** | Un-capped `staticcall` to utility inflates tax-flush gas ~8× | `SlotAccounting._distributeTax` | ✅ |
| 6 | **MEDIUM** | Liquidation bounty is levied on cross-tenure tax, front-runnable | `SlotEscrow.liquidate` | — |
| 7 | **MEDIUM** | `removeModule(head)` retroactively redirects the utility's accrued fee | `SlotModules.removeModule` | — |
| 8 | **LOW** | Module gallery is inert — never installed, never notified | `SlotModules` | ✅ |
| 9 | **LOW** | `setUtilityVerified` burns the admin's tx via un-capped `feeBps()` | `SlotFactory` | ✅ |
| 10 | **LOW** | `taxPercentage` unbounded — second lever into the same overflow | `Slot.initialize` | — |
| 11 | **LOW** | Stale in-flight utility update can refill the "shrink-only" head, unverified | `SlotAccounting._applyPendingUpdates` | — |

**Refuted / verified safe** (below): truncation tax-evasion · factory init front-run ·
return-bomb DoS · ERC-7201 collision · inheritance storage layout.

---

# CRITICAL

## 1. `sell` treats a standing ERC-20 allowance as consent to a forced, occupant-priced purchase

`SlotOccupancy.sell` — confirmed by 5 agents across both rounds, and by PoC.

`sell(buyer, agreedPrice, depositAmount)` pulls `agreedPrice + depositAmount` from
`buyer` via `safeTransferFrom`. The occupant chooses **both numbers**. The buyer's
only "consent" is an allowance they granted for an unrelated purpose — typically
their own `buy`, which requires exactly that approval.

The NatSpec states the assumption outright:

> the allowance is also the buyer's ONLY consent, and it is enough

and defends it with "a seller naming absurd terms simply reverts." That defence
holds only for the *total*. It fails two ways:

**(a) Infinite approvals.** `test_P1_SellDrainsAnyApprover` drains 5,000 tokens
from a victim who merely approved the slot, seats them at price 5,000 with zero
escrow, and leaves them instantly liquidatable.

**(b) The split is unconstrained — this breaks the intended OfferBook flow.**
A bidder posting `offer(price=100, deposit=50)` approves exactly 150, expecting to
pay 100 and keep 50 as recoverable escrow. The occupant instead calls
`sell(bidder, 150, 0)`: the whole 150 becomes seller proceeds, the deposit leg is
stolen, and the bidder is seated insolvent. `test_P1_ExactApprovalStillLosesTheDeposit`
proves it. **OfferBook's own safety argument — "the bidder only approves
price+deposit" — does not protect the bidder**, because `Slot.sell` never binds its
arguments to the offer's terms and the core holds no reference to the book.

Every funded bidder in the offer book is therefore a target of the slot's own
occupant.

```diff
- // The allowance is the buyer's ONLY consent, and it is enough.
- currency.safeTransferFrom(buyer, address(this), owedByBuyer);
+ // Bind the pull to terms the buyer actually agreed to: an EIP-712 order
+ // (buyer, maxPrice, minDeposit, deadline, nonce), or read the buyer's own
+ // posted OfferBook entry. A bare allowance is authorisation to spend, not
+ // agreement to a price the counterparty picks.
+ _requireSignedOrder(buyer, agreedPrice, depositAmount, order);
+ currency.safeTransferFrom(buyer, address(this), owedByBuyer);
```

---

# HIGH

## 2. Unbounded self-assessed price overflows `_accrue`, permanently bricking the slot

`SlotAccounting._accrue` — confirmed by 5 agents, and by PoC.

```solidity
uint256 owed = (_price * taxPercentage * elapsed) / (MONTH * BASIS_POINTS);
```

Checked arithmetic, multiplication before division, and **no ceiling on `_price`**
anywhere — `buy`, `sell` and `selfAssess` reject only `price == 0`. Setting
`_price` above `(2^256-1) / taxPercentage` makes every later `_settle()` revert,
and `_settle()` is the first statement of `buy`, `sell`, `release`, `liquidate`,
`collect`, `withdraw`, `topUp` and `selfAssess`. The slot is permanently frozen,
its occupant permanently un-evictable, and any `collectedTax` already owed to the
recipient permanently locked. `taxOwed()`, `isInsolvent()` and `getSlotInfo()`
revert too, so the slot cannot even be *observed* as broken.

This directly defeats the protocol's stated first invariant — that liquidation is
unconditional.

**Precondition, established by PoC:** `minDepositSeconds == 0`. With a non-zero
value, `_minDepositFor` performs `price * taxPercentage * minDepositSeconds`, which
overflows *first* and reverts the buy — an accidental defence
(`test_P2_NonZeroMinDepositSecondsBlocksTheBrick`). With zero, `_minDepositFor`
returns `0` before any multiplication, so taking a vacant slot costs **nothing**:
`buy(attacker, 0, type(uint256).max)` is a free, permissionless, permanent brick.

Realistic prices are unaffected (`test_P2_RealisticPricesAreSafe`), so this is
purely a deliberate-grief vector.

**Two amplifications, both PoC-proven:**

- **An operator can do it too** — `selfAssess` is reachable by an approved
  operator, not just the occupant (`test_P2_OperatorCanBrickViaSelfAssess`).
- **One bricked slot poisons batch collection.** `SlotFactory.collectAll` wraps
  `collect()` in `try/catch` but calls `s.taxOwed()` **outside** it, so a single
  bricked slot reverts the entire batch and blocks every other recipient in the
  array (`test_P2_OneBrickedSlotBreaksCollectAll`).

```diff
- uint256 owed = (_price * taxPercentage * elapsed) /
-     (MONTH * BASIS_POINTS);
+ // 512-bit intermediate: the one multiplication the unconditional-liquidation
+ // invariant runs through must not be able to overflow.
+ uint256 owed = Math.mulDiv(_price, taxPercentage * elapsed, MONTH * BASIS_POINTS);
```

Apply the same to `_minDepositFor` and `taxOwed`, and additionally bound `_price`
in `buy`/`sell`/`selfAssess`. Fix `collectAll` by moving `taxOwed()` inside the
`try`.

## 3. Manager captures the recipient's accrued tax via `setLiquidationBounty` + Multicall

`SlotAdmin.setLiquidationBounty` + `SlotEscrow.liquidate` — PoC-proven.

`setLiquidationBounty` is `onlyManager`, **immediate** (unlike tax, utility and
policy changes, which all defer to the next occupancy transition), and permits up
to `BASIS_POINTS` — 100%. The bounty is paid to `msg.sender`, and `Slot` inherits
`Multicall`, which delegatecalls to self and preserves `msg.sender`.

`manager` and `recipient` are independent addresses (`createSlot` takes `recipient`
as a parameter separate from `config.manager`), so this is **cross-party theft, not
self-harm**. In a collective it is worse: `recipient` is the members' split while
`manager` is governance.

`test_NEW_ManagerRugsRecipientViaBountyMulticall` — manager took the full **10.0**
accrued tax; recipient received **0**.

This clears the admin-action bar through the *retroactive sweep* amplifier: the
update rewrites the split of tax **already accrued** to the recipient.

```diff
  function setLiquidationBounty(uint256 newBps) external onlyManager {
-     if (newBps > BASIS_POINTS) revert InvalidLiquidationBounty();
+     // A bounty is a keeper incentive, not a claim on the recipient's revenue.
+     // Capped well below 100%, and deferred like every other term change so it
+     // cannot rewrite the split of tax that has already accrued.
+     if (newBps > MAX_LIQUIDATION_BOUNTY_BPS) revert InvalidLiquidationBounty();
      liquidationBountyBps = newBps;
```

## 4. Legacy proxies may be re-initializable by anyone — *reachability unverified*

`Slot.initialize` — mechanism PoC-proven; **on-chain reachability cannot be
determined from source.**

`initialize` is `external initializer` with **no caller gate** — no `onlyFactory`,
no `onlyAdmin`. Its only protection is OZ v5's namespaced `_initialized` counter.

`SlotStorage` documents `_legacyInitialized` (slot 14) as *"a hand-rolled init flag
that `reinitializer` replaced"* — proving an earlier generation of slots was
initialized **without** OZ Initializable. Any such proxy whose OZ counter is still
`0` passes the `initializer` check and can be seized by anyone.

`test_NEW_LegacyProxyIsReinitializableByAnyone` simulates exactly that state
(`vm.store` of the ERC-7201 Initializable slot to zero) on a live, occupied slot,
and an unprivileged attacker rewrites `recipient` and `manager` to themselves.
`test_NEW_CurrentGenerationSlotsAreProtected` confirms slots created through the
current factory are safe.

**This is a lead, not a confirmed exploit** — whether any live proxy sits at OZ
version 0 is on-chain state I cannot read from source. The repo already ships
`script/AuditInitVersions.s.sol`, which reads precisely this slot and flags
version-0/1 slots, so the risk surface is known.

**Action:** run that script against all 237+ live proxies before the next beacon
upgrade. If any is at version 0, it is seizable today. Regardless, add a caller
gate — `initialize` has no reason to be callable by anyone but the factory.

---

# MEDIUM

## 5. Un-capped `staticcall` to the utility inflates tax-flush gas ~8×

`SlotAccounting._distributeTax` (lines 239, 253).

The `feeBps()` and `feeRecipient()` staticcalls carry **no gas cap**, while the
structurally identical `_notifyUtility` call ~20 lines below is deliberately capped
at `{gas: 500_000}` and `_payOrCredit` caps native sends at `{gas: 30_000}`. The
one call the unconditional-liquidation invariant runs through is the one left
unbounded.

Reachability is real: `SlotFactory._validateConfig` checks only
`utility.code.length != 0` — it **never** consults `verifiedUtilities`, so the head
is fully creator-chosen and unvetted.

**Severity settled by measurement, against two agent claims.** Round 1 called it a
hard DoS; round 2 escalated it to a scale-invariant return bomb. Both are wrong:

| Scenario | Result |
|---|---|
| Baseline liquidation | **525k** gas |
| With gas-burning utility | **4,193,990** gas minimum (binary-searched) |
| Exceeds a 30M block limit? | **No** |
| At a normal 500k budget | reverts |
| Return bomb (16MB returndata) | `collect()` **succeeds** at ≥10M gas |

The return bomb self-defeats: expanding 16MB costs the callee ~538M gas, so it
OOGs first, `ok` comes back `false`, and the fail-open `if (ok && data.length >= 32)`
correctly skips the fee.

So it is **griefing, not denial** — but real: any keeper, bot or UI using a normal
gas estimate fails, and an immutable-utility slot (`mutableUtility == false`, which
forces `manager == address(0)`) can never detach the head.

```diff
- (bool ok, bytes memory data) = utility.staticcall(
-     abi.encodeWithSignature("feeBps()"));
+ (bool ok, bytes memory data) = utility.staticcall{gas: 100_000}(
+     abi.encodeWithSignature("feeBps()"));
```

Same for `feeRecipient()`. Ideally also bound the returndata copy.

## 6. Liquidation bounty is levied on cross-tenure tax and is front-runnable

`SlotEscrow.liquidate`.

`collectedTax` is flushed only by `collect`/`release`/`liquidate` — never by `buy`
or `sell` — so it accumulates across many tenures. The bounty is
`collectedTax * liquidationBountyBps / BASIS_POINTS`, i.e. a cut of the recipient's
**entire un-flushed pot**, not of anything the defaulter forfeited (their deposit is
provably `0` at that point — the line above requires it).

Worked example: 10%/mo on a 10,000 price, two tenures over ~3 months →
`collectedTax ≈ 3,000`. At 500 bps a liquidator takes **150** from the recipient's
revenue, having risked nothing. Conversely, the permissionless `collect()` can
front-run a pending `liquidate()` to strip the bounty to ~0, so the incentive is
unreliable in both directions.

**Fix:** derive the bounty from the liquidated occupant's own forfeited value
(snapshot at their settlement), and/or flush `collectedTax` on every occupancy
transition including `buy`.

## 7. `removeModule(head)` retroactively redirects the utility's accrued fee

`SlotModules.removeModule` → `Slot._clearModuleHead`.

Head removal is **immediate** — deliberately, as the emergency lever. But
`_distributeTax` reads `feeBps()`/`feeRecipient()` live at flush time and applies
them to the whole `collectedTax` accumulator, with no checkpoint of what the head
earned while it was installed.

So `multicall([removeModule(utility), collect()])` vacates the head and routes tax
that accrued **under that head** entirely to `recipient`. A third-party module
integrator can be zeroed out on fees they already earned, with no defence.

**Fix:** settle the head's owed fee out of `collectedTax` before the head can be
cleared, or defer the fee-relevant effect of vacating to the next flush.

---

# LOW

## 8. The module gallery is inert

`SlotModules._applyPendingModules` / `_notifyModules` — **confirmed by 6 agents and
by PoC; independently verified by grep.**

Both functions are defined and never called. Every hot path (`buy`, `sell`,
`release`, `liquidate`, `_accrue`) still calls the legacy `_notifyUtility`, and
`_applyPendingUpdates` never calls `_applyPendingModules`.

`test_P4_GalleryNeverInstalls`: a verified module is queued, a **full occupancy
transition** runs, and the module is still in `pendingAdds`, never in
`galleryModules()`, and never notified of anything.

No fund loss — but `addModule` succeeds, emits `ModuleAddQueued`, charges gas, and
does nothing. `ModuleInstalled` can never fire. Managers and indexers get a false
success signal.

This is a wiring regression from the base-contract split; the standalone
`SlotModules` draft was never spliced into the hot paths.

```diff
  function _applyPendingUpdates() internal {
+     _applyPendingModules();
      if (pendingPolicyUpdate.hasPolicyUpdate) {
```
plus replacing `_notifyUtility(...)` with `_notifyModules(...)` at the 6 call sites.

**Note:** `MAX_MODULES`, the per-module gas stipend and the failure-swallowing in
`_notifyModules` only become load-bearing *once wired*. Finding #5's lesson —
that an un-capped call on the liquidation path is a real hazard — applies directly
to that wiring. Do not wire it without re-reviewing those bounds.

## 9. `setUtilityVerified` burns the admin's transaction

`SlotFactory.setUtilityVerified` — PoC-proven, found while writing the P4 test.

The function calls `mod.feeBps()` un-capped inside its event emission:

```solidity
emit ModuleVerified(_utility, verified, mod.name(), mod.version(), mod.feeBps(), mod.metadataURI());
```

Verifying a module whose `feeBps()` loops consumes the admin's whole transaction
(`test_NEW_SetUtilityVerifiedIsGriefableByFeeBps`). Admin-only and self-inflicted,
so low — but it means verification cannot even be *attempted* on a hostile module,
and it is the same missing-cap pattern as #5.

## 10. `taxPercentage` is unbounded — a second lever into the same overflow

Validated only `!= 0` in `Slot.initialize`, `SlotFactory._validateConfig` and
`proposeTaxUpdate`. The overflow in #2 is the product `_price * taxPercentage`;
bounding only the price leaves this lever open to a manager on a `mutableTax` slot.
Bound both.

## 11. A stale in-flight utility update can refill the "shrink-only" head

`SlotAccounting._applyPendingUpdates` still lands `utility = pendingUpdate.newUtility`
for any proxy carrying a proposal queued **before** `proposeUtilityUpdate` was
retired. That old path checked only `code.length`, never verification.

Two consequences: it can install a head the factory never verified — re-opening
the exact door the retirement closed — and it violates the documented
"head is SHRINK-ONLY, never refilled" invariant, since a manager could vacate the
head and then have it refilled from the stale queue on the next transition.

Keeping that branch is **correct** (dropping it would silently strand in-flight
proposals — see the migration notes in the module-gallery spec). But it should
verify before landing, and it is worth auditing which live proxies carry a queued
utility update.

---

# Refuted and verified-safe

Recorded so they are not re-raised.

| Claim | Verdict | Evidence |
|---|---|---|
| Truncation tax-evasion by frequent settling | **REFUTED** | `_accrue` early-returns when `upTo <= lastSettled`, so same-block loops accrue nothing. Dodging 1 USDC needs >1,000,000 separate txs; the required price is so low the seat is trivially buyable. Dust. |
| `SlotFactory.initialize` front-run | **REFUTED** | Every deploy script initializes atomically — `new ERC1967Proxy(impl, initData)` in `DeployV3`/`DeployERC721Slots`, `upgradeToAndCall` in `DeployLocal`. No window exists. |
| `_distributeTax` return-bomb = permanent DoS | **REFUTED** | `collect()` succeeds at ≥10M gas. The bomb cannot afford to build itself; the callee OOGs and the fail-open path skips the fee. |
| ERC-7201 namespace collision in `SlotModules` | **SAFE** | Constant recomputed and matches; distinct from OZ's Initializable and ReentrancyGuard namespaces. Pinned by `test_NamespaceSlotIsCorrectlyDerived`. |
| Base-split inheritance broke storage layout | **SAFE** | `forge inspect` confirms `recipient`@0 → `policyProposedAt`@24, byte-identical to pre-split. `SlotModules` is namespaced and contributes nothing. |
| `proposeUtilityUpdate` retirement left the head door open | **CLOSED** | No live code sets `pendingUpdate.hasUtilityUpdate`. The head can only be vacated, never newly set — except via #11's stale-queue path. |
| Reentrancy on any mutating entry point | **SAFE** | All `nonReentrant`; policies are `external view`; `_payOrCredit` caps native sends at 30k. |
| `msg.value` reuse via `Multicall` | **SAFE** | OZ v5.5.0 `Multicall` is not payable; subcalls see `msg.value == 0` and native `buy` reverts. |

**Open leads** (not scored, worth manual attention): fee-on-transfer / rebasing
currencies break the face-value accounting in `buy`/`sell`/`topUp` (creator-chosen
currency, but the harm lands on later occupants); a dynamic utility can return a
low `feeBps` during accrual and flip to 100% before a permissionless `collect()`,
retroactively skimming the recipient.

---

# Recommended order

1. **#1 `sell`** — the only finding that lets one user take another's funds, and it
   breaks the OfferBook flow you built. Blocks any beacon upgrade shipping `sell()`.
2. **#4 init versions** — run `AuditInitVersions` now; it is the only item that
   could already be exploitable on-chain.
3. **#2 overflow** — one-line `Math.mulDiv`, plus the `collectAll` `try` fix.
4. **#3 bounty cap** — small, and it protects collectives specifically.
5. **#5 / #9 gas caps** — one-liners, same pattern.
6. **#8 wire the gallery** — re-review its bounds while doing it, per #5.

Findings #2, #3, #5, #8 are one-to-few-line fixes. #1 needs a design decision:
signed orders, or binding `sell` to the OfferBook entry.

---

*Audit performed by AI agents with executable PoC verification. AI analysis cannot
establish the absence of vulnerabilities. An independent human review and a bug
bounty are strongly recommended before the next beacon upgrade, which is
irreversible across all 237+ live proxies.*
