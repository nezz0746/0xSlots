# 0xSlots protocol — security audit

**Date:** 2026-08-12
**Auditor:** Claude (manual review, self-directed)
**Scope commit:** `main` @ working tree (see `git rev-parse HEAD`)
**Focus (as requested):** `Slot.sol` — pricing / deposit / tax math; the external-module attack surface (occupancy **policy** + **utility**); and general contract hygiene (naming, upgradeability).

## Files reviewed

| Contract | Lines | Role |
|---|---|---|
| `src/Slot.sol` | 1062 | **Core.** One slot = one beacon proxy. Harberger tax, escrow, buy/release/liquidate, pending updates. |
| `src/SlotFactory.sol` | 342 | UUPS factory + beacon owner + event hub + verification registries. |
| `src/SlotManager.sol` | 495 | Role-split governance wrapper over a 0xSplits PushSplit. |
| `src/interfaces/ISlot.sol` | 244 | Structs, events, `UpdateKind`. |
| `src/interfaces/IOccupancyPolicy.sol` | 38 | Fail-**closed** veto interface. |
| `src/interfaces/IUtility.sol` | 75 | Fail-**open** advisory interface. |
| `src/policies/MinimumTenurePolicy.sol` | 93 | "Cannot be bought out for N seconds." |
| `src/policies/MinimumPricePolicy.sol` | 101 | Reserve price floor. |
| `src/modules/FeedPostModule.sol` | 182 | Utility: per-slot URI for the feed. |
| `src/modules/MetadataModule.sol` | 117 | Utility: per-slot URI. |

Out of scope this pass (read only for context): the ENS resolver, `FeedHub`/`Feed`/`FeedRouter`, `ERC721Slots*`, `BatchCollector`, the `*Factory` policy deployers.

---

## Summary

This is a **carefully written, defensively-coded protocol.** The core invariants the design cares about — *liquidation is never vetoable*, *a broken module can never trap funds*, *storage layout is append-only across 237 live proxies* — are respected in the code, not just the comments. Payment paths use try-push-then-credit so a hostile recipient/currency degrades to a claimable credit instead of bricking an entry point. The occupancy policy is invoked through a compiler-enforced `staticcall` (interface methods are `view`), which structurally removes reentrancy from the single most dangerous external call.

I found **no unprivileged-attacker path to steal funds or brick a slot.** The real residual risk is concentrated in **privileged roles** (what a `manager` / factory `admin` can do) and a few **economic-precision leaks** that the code already half-documents.

### Findings at a glance

| ID | Severity | Title | Status |
|---|---|---|---|
| M-1 | Medium | A `UTILITY_MANAGER` can set a 100%-fee utility and divert **all** tax away from the recipient/split | Confirmed |
| M-2 | Medium | Factory `admin` / beacon owner is a single point of total control over every slot's funds | By design (centralization) |
| L-1 | Low | Pending **tax** update applies *after* the occupancy-policy check in `buy()` → `MinimumTenurePolicy` pre-funds at the stale rate | Confirmed |
| L-2 | Low | A reverting or non-conforming occupancy policy permanently DoSes `buy()`/`selfAssess()` | By design, but sharp edge |
| L-3 | Low | `SlotFactory.initialize` is front-runnable if proxy deploy + init are not atomic | Deployment-dependent |
| L-4 | Low | Utility fee is read fresh from an untrusted contract on every tax distribution (griefing/gas surface) | Confirmed, low impact |
| N-1 | Note | `Multicall` + `payable` — the classic `msg.value`-replay footgun was checked and does **not** apply | Non-issue (documented) |
| N-2 | Note | Non-upgradeable `ReentrancyGuard` under a beacon proxy — safe here (ERC-7201 namespaced) | Non-issue (documented) |
| Q-* | Quality | Naming, deprecated aliases, inert storage, minor observations | Informational |

Severity uses the usual likelihood × impact lens; "By design" means the behaviour is intended and documented, flagged so the trust assumption is explicit.

---

## Medium

### M-1 — A utility can skim up to 100% of tax, bypassing the recipient/split-manager boundary

**Where:** `Slot._distributeTax` (`Slot.sol:1017`), reached from `collect()`, `release()`, `liquidate()`; utility set via `SlotInitParams.utility` or `proposeUtilityUpdate` (gated on `mutableUtility`).

**Root cause.** The utility fee is bounded only by `bps <= BASIS_POINTS`:

```solidity
uint256 bps = abi.decode(data, (uint256));
if (bps > 0 && bps <= BASIS_POINTS) {   // 10_000 == 100%
    feeBps_ = bps;
    utilityFee = (amount * bps) / BASIS_POINTS;
}
...
_payOrCredit(feeTarget, utilityFee);
_payOrCredit(recipient, amount - utilityFee);  // recipient can get 0
```

So a utility that reports `feeBps() == 10000` and `feeRecipient() == attacker` causes **every** tax distribution to send 100% to the attacker and **0** to the slot's `recipient`.

**Why it's more than "creator's choice."** The protocol's stated design separates *who receives money* (`recipient`) from *who governs* (`manager`), and `SlotManager` refines that further into distinct roles: `SPLIT_MANAGER_ROLE` controls **who gets paid**, `UTILITY_MANAGER_ROLE` controls **what the slot does**. This finding lets a `UTILITY_MANAGER_ROLE` holder cross that boundary: by proposing a 100%-fee utility (applied on the next ownership transition), they redirect the entire tax stream away from the split the `SPLIT_MANAGER` governs — a privilege they were never meant to have. The whole point of the role split is defeated by one lever in the adjacent role.

**Proof.** `amount = 1_000e6`, malicious utility returns `feeBps()=10000`, `feeRecipient()=attacker`. `utilityFee = 1_000e6 * 10000 / 10000 = 1_000e6`; `recipient` leg = `amount - utilityFee = 0`. Attacker receives the full tax; the split receives nothing.

**Fix (recommended).** Cap the honoured fee well below 100% — a utility fee is a service cut, not a claim on the whole base:

```diff
-                if (bps > 0 && bps <= BASIS_POINTS) {
+                // A utility earns a *cut*, never the whole base. Anything above
+                // this is a redirect of the recipient's income, not a fee.
+                uint256 MAX_UTILITY_FEE_BPS = 2_000; // 20%, pick to taste
+                if (bps > 0 && bps <= MAX_UTILITY_FEE_BPS) {
```

Note this only binds *new* behaviour; already-deployed slots read the utility live, so the cap must live in the slot (beacon upgrade) to be effective. Alternatively, require the utility fee change to be co-signed by `recipient`, but a hard cap is simpler and needs no new signer.

---

### M-2 — Factory `admin` / beacon owner is a single point of total control

**Where:** `SlotFactory.upgradeBeacon` (`SlotFactory.sol:289`), `_authorizeUpgrade` (`SlotFactory.sol:294`), beacon ownership set in `initialize`.

**Root cause.** All slots delegate to one `UpgradeableBeacon`. Whoever holds `admin` can `upgradeBeacon(newImplementation)` and thereby replace the logic of **every** live slot at once — including replacing it with an implementation that transfers out every slot's `_deposit` and `collectedTax`. The same `admin` also authorises UUPS upgrades of the factory itself.

This is the standard beacon-proxy trade-off and is clearly intended (the contract documents beacon ownership handoff). It is listed so the assumption is explicit: **the security of all deposited funds reduces to the security of the `admin` key.**

**Recommendation.** Hold `admin` behind a multisig with a timelock on `upgradeBeacon` and `upgradeToAndCall`. A timelock is the meaningful control here — it gives occupants a window to exit (`release`/`withdraw`) before a malicious or mistaken implementation goes live. Consider emitting the pending implementation ahead of the switch so indexers can alert.

---

## Low

### L-1 — Tenure pre-funding is checked against the pre-update tax rate

**Where:** `Slot.buy` (`Slot.sol:255`–`270`) ordering; `MinimumTenurePolicy.checkBuy` (`MinimumTenurePolicy.sol:53`).

**Root cause.** In `buy()`, the order is: `_settle()` → **`checkBuy` (policy)** → `_applyPendingUpdates()` → `_enforceMinDeposit`. `_occupancyCtx` passes the **current** `taxPercentage`, but `_applyPendingUpdates()` may raise it immediately afterward. `MinimumTenurePolicy.checkBuy` computes the required tenure escrow as `ceilDiv(newPrice * taxPercentage * tenureSeconds, …)` using the **stale (pre-update)** rate.

**Consequence.** If a `manager` has a pending tax *increase* queued, an incoming occupant pre-funds their tenure window at the old, lower rate, then is charged going forward at the new, higher rate — so they can be underfunded for the protection window the policy is supposed to guarantee. The core's own `minDepositSeconds` floor *is* enforced at the new rate (`_enforceMinDeposit` runs after `_applyPendingUpdates`), so this is bounded to the gap between `minDepositSeconds` and `tenureSeconds`. It is an economic leak, not a fund loss, and only manifests when a tax update is pending *and* a tenure policy is active.

**Fix.** Either apply pending updates before the policy check (so the policy sees the rate the buyer will actually pay), or pass the post-update rate into `_occupancyCtx`. Applying first is cleaner but changes what the policy sees for *all* dimensions — verify no policy relies on seeing the pre-transition value. Minimal version:

```diff
-        if (occupancyPolicy != address(0)) {
-            IOccupancyPolicy(occupancyPolicy).checkBuy(
-                _occupancyCtx(account, selfAssessedPrice, depositAmount)
-            );
-        }
-        uint256 currentPrice = _price;
-        address prev = _occupant;
-        _applyPendingUpdates();
+        uint256 currentPrice = _price;
+        address prev = _occupant;
+        _applyPendingUpdates();               // tax/utility/policy now current
+        if (occupancyPolicy != address(0)) {  // NB: reads the *new* policy too
+            IOccupancyPolicy(occupancyPolicy).checkBuy(
+                _occupancyCtx(account, selfAssessedPrice, depositAmount)
+            );
+        }
```

⚠️ This reordering also means the check runs against the **newly-applied** policy rather than the outgoing one. That may be desirable or not depending on intended semantics ("the policy in force when you buy" vs "the policy the previous terms promised"). Decide deliberately; if the outgoing policy must gate the buy, keep the current order and instead thread the post-update tax rate into the context only.

---

### L-2 — A hostile or malformed occupancy policy permanently DoSes buys and price updates

**Where:** `Slot.buy` (`Slot.sol:259`), `Slot.selfAssess` (`Slot.sol:382`); set at `initialize` or via `proposePolicyUpdate`. Only `code.length > 0` is checked — never `supportsInterface`.

**Root cause.** `checkBuy`/`checkPriceUpdate` are `staticcall`ed (safe from reentrancy), but a policy that reverts unconditionally — or a non-conforming contract with no such selector — makes `buy()` and `selfAssess()` revert forever. A slot can be created with any code-bearing address as `occupancyPolicy`, and there is no interface probe at set time.

**Why it's Low, not higher.** The protocol's first invariant holds: `liquidate()` and `release()` never route through a policy, so an occupant can always exit and an insolvent one can always be removed. Funds are never trapped — only the *buyout* and *repricing* channels are. For a `mutablePolicy` slot the `manager` can propose a working policy to recover; for an immutable slot it is self-inflicted at creation. The `verifiedPolicies` registry exists precisely to steer creators, but it is informational and non-blocking.

**Recommendation.** At minimum, validate `supportsInterface(type(IOccupancyPolicy).interfaceId)` in `initialize` and `proposePolicyUpdate`, mirroring what `setPolicyVerified` already does. It won't stop a deliberately-malicious-but-conforming policy, but it eliminates the "wrong address / EOA / wrong-chain contract" footgun, which is the common case. Same argument applies to `utility` (there it only degrades function, since utility calls are fail-open, so it's lower priority).

---

### L-3 — `SlotFactory.initialize` is front-runnable if not deployed atomically

**Where:** `SlotFactory.initialize` (`SlotFactory.sol:94`), guarded by a plain `_initialized` bool, not `initializer`, and callable by anyone.

**Root cause.** If the factory proxy is deployed in one transaction and `initialize(admin, impl)` is called in a later transaction, an observer can front-run the init and set themselves as `admin` (and pick the beacon implementation). Given M-2, that is total control.

**Recommendation.** Deploy the proxy with the init calldata baked into its constructor (e.g. `ERC1967Proxy(impl, abi.encodeCall(initialize, …))`) so creation and initialization are atomic — which the slot proxies already do correctly (`_deploySlot` passes `initData` into the `BeaconProxy` constructor). Confirm the *factory's* own deployment script does the same; if it does, downgrade this to informational.

---

### L-4 — Utility fee parameters are read live from an untrusted contract during distribution

**Where:** `Slot._distributeTax` (`Slot.sol:1020`–`1047`).

**Root cause.** `feeBps()` and `feeRecipient()` are `staticcall`ed on the utility on *every* tax flush. The code handles the obvious hazards well (staticcall so no reentry; `data.length >= 32` guard; `bps <= BASIS_POINTS`; `feeTarget == 0` skips the fee). Residual surface: the utility can return different values over time (a fee that changes between `collect()`s), and the two staticcalls add gas to every distribution. Beyond M-1's magnitude issue, there is no correctness bug here — noting it so the "utility is fully trusted with its own fee terms" assumption is explicit.

**Recommendation.** None required beyond the M-1 cap. Optionally snapshot the effective fee at the ownership transition rather than reading it live, so the fee a buyer sees is the fee they pay.

---

## Notes / non-issues (checked and cleared)

### N-1 — `Multicall` + `payable` `msg.value`-replay does NOT apply

`Slot` inherits OZ `Multicall`, and `buy`/`topUp` are `payable` and read `msg.value`. This is the exact shape of the well-known payable-multicall replay bug (delegatecall preserves `msg.value`, so N sub-calls each "see" the same value and can double-count native funds).

**It does not apply here** because OZ v5.5's `multicall(bytes[])` is **not** `payable`:

```solidity
function multicall(bytes[] calldata data) public virtual returns (bytes[] memory results) { … }
```

Sending value to a non-payable function reverts at the call-value check, so any `multicall` entry forces `msg.value == 0`. Inside the delegated sub-calls, a native `buy`/`topUp` then requires `msg.value == owed`/`amount`, which with `msg.value == 0` fails for any positive amount. The replay is structurally impossible. (For ERC-20 slots it never applied anyway — each `safeTransferFrom` pulls real tokens.) **No action needed**, but if `multicall` is ever overridden to be `payable`, this becomes a critical bug — worth a one-line comment on the inheritance.

### N-2 — Non-upgradeable `ReentrancyGuard` under a beacon proxy is safe here

`Slot` imports the **non**-upgradeable `ReentrancyGuard`, whose constructor does not run against proxy storage — normally a red flag. Verified safe: OZ v5.6's `ReentrancyGuard` stores `_status` in an **ERC-7201 namespaced slot** (`REENTRANCY_GUARD_STORAGE`), not a sequential slot, and its check treats the zero-initialised value identically to `NOT_ENTERED`. So (a) it works correctly in the proxy without a constructor, and (b) it does **not** occupy sequential slot 0 — confirming the storage-layout comments (`recipient` really is at slot 0). `Initializable` is likewise namespaced. The append-only layout claims hold.

### Positive observations

- **Liquidation unconditionality** is genuinely preserved: no policy on `liquidate`/`release`, tax flush routed through `_payOrCredit` (credit-on-failure), bounty credited not pushed. A blocklisting currency or reverting recipient cannot freeze eviction.
- **Occupancy policy via `staticcall`** (interface methods `view`) removes reentrancy from the highest-risk external call by construction — a strong, deliberate choice.
- **`_payOrCredit`** correctly mirrors SafeERC20's success condition (`ok && (returndata empty || true)`) *and* adds the code-length check so a codeless address can't masquerade as a successful payment. Native path is gas-capped (30k) with a documented rationale; `withdraw`/`claim` give the uncapped path back to the caller.
- **Tax math** (`_accrue`, `taxOwed`, `_minDepositFor`) is consistent between the view and the mutating path, and `_minDepositFor`/`MinimumTenurePolicy._taxFor` both `ceilDiv` (round in the protocol's favour) — the flooring-underfunds-by-1-wei trap is avoided in both places.
- **`SlotManager`** correctly seals the inherited `Wallet.execCalls` by pinning ownership to `address(this)`, and defuses the `isValidSignature`/ERC-1271 self-recursion gas bomb — both non-obvious and correctly handled.

---

## General quality / naming / upgradeability

- **Naming.** The utility/module rename (`module → utility`) is handled without breaking the wire: deprecated aliases (`module()`, `mutableModule()`, `proposeModuleUpdate`, `setModuleVerified`, `verifiedModules`) preserve selectors, and `IUtility.moduleURI()` deliberately keeps its historical name because renaming would change the selector deployed slots staticcall. This is the right call for a live system; just schedule the promised "remove next major" cleanup so the alias surface doesn't calcify.
- **Inert storage** (`_legacyInitialized`, `epochSeconds`, `PendingTransfer`) is retained and documented with the exact reason (moving it would shift `isOperator`/`withdrawableOf` on 237 proxies). Correct and well-guarded by `test_StorageLayout_SurvivesDrainRemoval`. No action.
- **Upgradeability.** Beacon for slots (one lever upgrades all — see M-2), UUPS for the factory. `constructor` calls `_disableInitializers()`. Versioning via `reinitializer(n)` is asserted in comments but there is only the single `initializer` today — fine, just ensure any future beacon upgrade that needs new storage init uses `reinitializer` and never re-runs `initialize`.
- **`pragma`.** Mixed: `Slot.sol` is `^0.8.20`, `SlotManager.sol` is `^0.8.23`. Harmless, but pin a single exact version (e.g. `0.8.28`) for the deployed set so metadata/bytecode is reproducible across the repo.
- **Events.** Dual-emission (flat legacy + per-kind `UpdateProposed/Applied/Cancelled`) is deliberate to avoid splitting historical indexing across topic0 changes — good discipline; the reasoning is documented at `ISlot.sol:201`.

---

## Recommendations, prioritised

1. **Cap the utility fee** materially below 100% in the slot (M-1). Highest-value fix; closes a role-boundary escalation.
2. **Timelock + multisig the factory `admin`** and beacon upgrades (M-2). This is the dominant risk to deposited funds.
3. **`supportsInterface` gate** on `occupancyPolicy` at `initialize`/`proposePolicyUpdate` (L-2); cheap, kills the common footgun.
4. **Decide the `buy()` ordering** of policy-check vs pending-update deliberately and document it (L-1).
5. **Confirm atomic deploy+init** for the factory proxy (L-3); if already atomic, mark resolved.

No change is required to the core Harberger accounting, the payment-safety design, or the storage layout — those are sound.

---

*Scope note: this was a focused manual review of the contracts listed above. It is not a guarantee of the absence of bugs. The feed/ENS/ERC721 peripherals and the deployment scripts were not audited in depth and warrant their own pass, as does any future beacon implementation before it is shipped.*
