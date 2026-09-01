# Module gallery — many utilities per slot

Status: **spec, not built.**

## Why

A slot has exactly one `utility`. Wanting metadata *and* a feed *and* a
leaderboard on the same slot is not expressible.

That is not merely a limit, it is a **foreclosure**: every module is mutually
exclusive with every other, so adopting one means never having the rest. Value
can never stack on a slot — its ceiling is fixed the moment it picks a module.

It also makes building adversarial. A module author today is not asking a slot
to *add* their module; they are asking it to *displace* the incumbent. That is
not friction a newcomer can overcome, and it is the difference between a
platform and a fixed-function object.

Demand for composition cannot be observed before composition exists. Nobody
asks for what the system cannot express.

## The decision that makes this cheap

**Modules in the gallery take no fee.**

The existing single `utility` keeps everything it has today, including its
`feeBps()`/`feeRecipient()` cut. The new array is purely additive and
notification-only.

`_distributeTax` is therefore **completely untouched**. The money path — the one
that runs inside `liquidate`, the one its own comment describes as protecting
the protocol's first invariant — is not modified, not re-tested, not at risk.

Everything expensive about the earlier draft of this spec lived in that path:
two fee-resolution paths forever, `sum(feeBps) <= 10_000` validation, immutable
rates versus mutable recipients, an upgrade story for changing terms,
credit-versus-push, and re-teaching `setUtilityVerified` where terms live. All
of it disappears with the fee.

What remains is the thing actually wanted: **the module interface shrinks to
hooks.**

### Revenue is deferred, not foreclosed

Two routes, both outside core, neither requiring a decision now:

1. **Modules already have their own entry points.** `MetadataModule` exposes
   `buyAndWrite` — users call the module *directly*, so it can charge there.
   Routing protocol tax to modules was never the only way to monetise; it was
   the way that entangles the money path.
2. **Solve it at the leaf.** `recipient` can be any contract. A fee router
   sitting there can split between the real recipient and module authors,
   exactly as collectives already do. Zero core change, whenever wanted.

## Only verified modules, for now

Today the registry is explicitly advisory — `SlotFactory` line 73 calls
`verifiedUtilities` *"informational, non-blocking"*, and `proposeUtilityUpdate`
checks only `newUtility.code.length > 0`. Anything with code can be a utility.

For the gallery that inverts: **installing a module requires it to be verified
on the factory/hub, checked at install time.** A closed set to begin with, opened
later.

Rationale: a module is called inside `buy`, `sell`, `release` and `liquidate`.
The gas cap and swallowed failures bound the damage, but they do not make an
arbitrary unvetted contract in that path a good idea while the primitive is
young. Start closed, and widen deliberately.

### Checked on install, never at runtime

The verification read happens **once, when the module is registered**. Never in
`_notifyUtility`.

Two reasons, and both matter:

1. A runtime check makes every hook call an external read of factory state —
   cost on the hot path for a fact that does not change between transitions.
2. More importantly: un-verifying a module must never brick a live slot. If the
   check ran at runtime, the admin revoking a module would begin reverting or
   silently disabling hooks under every occupant using it, mid-tenure, with no
   deferral. Revocation should stop *new* installs, not reach into existing ones.

So a slot that installed a module while it was verified keeps it until its
manager removes it, through the usual deferred path.

### Grandfathering

Existing slots' `utility` head is not re-checked. Many were set while the
registry was advisory and may not be verified; re-checking would strand them.
The head keeps its current rules; the gallery gets the new one.

### The centralisation being accepted

This makes the factory admin the gatekeeper for what any slot may install —
the same key that can upgrade the beacon. That is a real concentration, taken
deliberately while the module surface is small.

**ERC-7484** is the exit: attestations from multiple auditors, with each slot
choosing whose attestations it trusts, rather than one blessed list. Worth
adopting before the module set gets large enough that a single admin is a
bottleneck or a target.

## Why not an external fan-out router

Worth recording so nobody rediscovers it. A router in the utility field fails
three ways:

1. **Identity.** Every module keys per-slot state off `msg.sender`
   (`MetadataModule`: *"msg.sender in hooks = the slot contract calling the
   module"*, and `_clearMetadata(msg.sender)`). Behind a router they all see the
   router, and every slot collapses into one identity.
2. **Fees.** The slot pays one `feeRecipient()`, by transfer, with no callback.
   A router would have to receive and split, reconciling by polling its own
   balance — a dispatcher turned fund-holding accounting layer.
3. **Timelock.** `proposeUtilityUpdate` defers to the next occupancy
   transition, so an occupant never has terms changed mid-tenure. A router with
   instant target swaps deletes that guarantee silently: the utility address
   never changes, so nothing is ever proposed, while behaviour behind it changes
   freely.

## Shape

```solidity
address[] private _modules;   // appended after slot 24, cap 8
```

`utility` (slot 6) stays and becomes the permanent **head**:

```
effective = _utility == 0 ? _modules : [_utility] ++ _modules
```

Head rather than fallback: no "which source is canonical" branch, `utility()`
stays honest as *the primary*, and single-module slots never touch the new
storage.

`_notifyUtility` loops the effective list, `gas: 500_000` **per** module (not a
divided budget, so a single-module slot behaves exactly as today), swallowing
each failure independently.

Registration is manager-gated and applies on the next occupancy transition —
the same deferral the single utility already has, for the same reason.

### Bounded, and why it matters

`_notifyUtility` runs inside `buy`, `sell`, `release`, and `liquidate`.
Unbounded, a manager registers 100 modules, the loop exceeds the block gas
limit, and **every one of those paths reverts — including liquidation.** That is
the protocol's first invariant gone. Swallowing failures does not help: the gas
is spent either way.

Cap at 8, enforced on registration.

### Storage notes

The pending module list also lands at the tail. It **cannot** join
`PendingUpdate`, which sits at slots 12-13; extending that struct would push
`collectedTax` and everything after it. `pendingPolicyUpdate` is already in
exactly this situation and its comment says why.

## Flow

Alice occupies at 100 USDC, 10%/month. Carol is `recipient`. The slot has
MetadataModule (head) plus a leaderboard module (gallery).

| Public call | Who | What |
|---|---|---|
| `slot.buy(alice, deposit, 100)` | Alice | takes the slot |
| *(a month passes)* | — | **no transaction**; tax is a formula over elapsed time |
| `slot.collect()` | anyone | settles and distributes |

Under `collect()`: `_accrue` moves 10 USDC from Alice's deposit into
`collectedTax` — waiting needs no transaction because the debt is derived on
read and realised on write. Then `_distributeTax(10)` runs **exactly as it does
today**: MetadataModule's declared fee off the top, remainder pushed to Carol.
The leaderboard module is not involved; it takes nothing.

When Bob buys Alice out, the slot walks the effective list calling the transfer
hook on each with a stipend, failures swallowed per module. No money moves in
that path.

## Prior art

The modular smart-account stack is the same problem, further along:

- **ERC-7579** — typed modules, `installModule`/`uninstallModule`, modules keyed
  by caller. Its **`onInstall`/`onUninstall`** callbacks answer removal
  semantics better than anything here: teardown becomes the module's own
  business rather than something core must define.
- **ERC-7484** — module attestations by auditors. A registry that is a gate, and
  decentralised, so you are not the sole arbiter of what modules exist.
- **ERC-6900** — plugins ship a *manifest* declaring wanted hooks and needed
  permissions, validated at install. Makes third-party modules auditable before
  adoption.
- **Uniswap v4** — took the opposite decision (one immutable hook per pool,
  composition via the hook being a router), to avoid a governance surface. Worth
  understanding as the road not taken. One trick to steal regardless: v4 encodes
  hook permissions **in the hook's address bits**, so subscriptions are readable
  with no storage and no external call.
- **Safe modules** — `enableModule`/`disableModule` over a list. The boring
  baseline, proven at scale for years.
- **ERC-4337** — staking and slashing as an alternative to gas-cap-and-swallow
  for keeping untrusted modules honest.

None of them solve fee terms as a contract between module author and adopter —
v4 hooks set fees unilaterally, 4337 paymasters pay rather than charge, 7579 has
no economics. Which is a further argument for leaving fees out of core here.

## Open questions

- **Removal semantics.** What happens to a module's per-slot state when it is
  deregistered — orphaned, or reclaimable on re-add? Adopt 7579's
  `onInstall`/`onUninstall` and it becomes the module's problem, which is the
  right place for it.
- **Module upgrades.** How does an author ship v2 to existing adopters without
  every slot re-registering? Registry entries pointing at author-controlled UUPS
  proxies is the obvious answer, but it hands the author mutable code over
  adopting slots, which needs thinking about against the occupant guarantee.
- **Topic subscription.** Calling every module for every event wastes gas — a
  metadata module does not care about tax settlements. v4's address-bit encoding
  gets this for free. Worth doing at the same time or deliberately deferring.
- **Unified `on(bytes32, bytes)` hook.** Better interface — a fifth event would
  not change `interfaceId` — but it is a selector break requiring every deployed
  module to upgrade in lockstep with the beacon. Take it when a fifth event is
  actually needed and the modules are being touched anyway.

---

# Migration

## Nothing breaks on-chain

Append-only. `utility` keeps its storage slot and its selector. A slot that
never registers a second module behaves identically: `effective` resolves to
`[_utility]` and the loop runs once.

Because the gallery takes no fee, `_distributeTax`, `SlotInfo`,
`setUtilityVerified`, `withdrawableOf`/`claim`, and collectives are all
untouched.

## What needs work

### 1. In-flight pending updates

At upgrade time some proxies may have `hasUtilityUpdate = true` with
`newUtility` set in `PendingUpdate` (slots 12-13). `_applyPendingUpdates` must
keep honouring those alongside the new tail storage:

```
if (hasUtilityUpdate)      -> apply legacy single
else if (hasModulesUpdate) -> apply new list
```

Read only the new field and every in-flight proposal across every proxy is
silently dropped — the manager saw it accepted and it never lands.

Needs a test that stages a pending update *before* the upgrade. It is invisible
otherwise.

### 2. Indexer

`packages/ponder/src/factory.ts` reads `initParams.utility` and keys module
records off `event.args.utility`; `slot.ts` tracks `utilityProposedAt`. That
keeps working for the head, but multi-module slots would be under-reported —
only the first shows.

Needs a new event carrying the list, plus handlers.

### 3. Do not extend `SlotInfo`

It carries `utility`/`utilityName` and is returned by `getSlotInfo()`. Adding
fields changes the return ABI and breaks every decoder — SDK, indexer,
frontend. Add a separate `modules()` getter and leave the struct alone.

## Sequencing

The beacon upgrade is all-or-nothing across every proxy, so it should carry
everything ready at once:

1. `sell()` — written and tested, not yet deployed
2. operator support on `sell`, if atomic offer fills are wanted
3. this module gallery

Deciding (2) before upgrading avoids two beacon upgrades on live proxies.
