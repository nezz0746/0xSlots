# SlotManager — design

**Date:** 2026-08-11
**Status:** Draft implemented, unreviewed, undeployed

## Problem

A slot names two addresses at creation and never lets go of either: `recipient`,
which money flows to, and `config.manager`, which may propose tax / utility /
occupancy-policy changes. Both are written once in `Slot.initialize` and have no
setter.

The protocol keeps them separate on purpose — `docs/V3_SPEC.md` is explicit that
`recipient` "receives money, no admin powers" and `manager` "proposes updates, no
revenue." But a common case wants one address doing both, without collapsing the
authority into one person: revenue fans out across many payees, while each
governable dimension of the slot is delegated to a different party.

## Shape

`SlotManager is PushSplit, AccessControl`. Point a slot's `recipient` **and**
`config.manager` at one instance. Tax accrues at the contract, `distribute()`
fans it out over the split, and each of the slot's levers sits behind its own
role.

Relays take the slot as an argument, so one deployment serves many slots and
their tax pools into one split. No registry of managed slots is kept — calling a
slot that has not named this contract as manager just reverts `NotManager()` on
the far side.

## Roles

`DEFAULT_ADMIN_ROLE` can call everything and administers the other four.
OpenZeppelin's admin role does not implicitly *hold* other roles, so a custom
`onlyRoleOrAdmin` modifier implements "ADMIN can run all three, OR you hold the
specific role."

| Role | Relays |
|---|---|
| `TAX_MANAGER_ROLE` | `proposeTaxUpdate`, `setLiquidationBounty` |
| `POLICY_MANAGER_ROLE` | `proposePolicyUpdate` |
| `UTILITY_MANAGER_ROLE` | `proposeUtilityUpdate` |
| `SPLIT_MANAGER_ROLE` | `setSplit`, `setPaused` |
| `DEFAULT_ADMIN_ROLE` only | `cancelPendingUpdates` |

The liquidation bounty sits with tax because they are one economic policy: what
the slot costs to hold and what it pays to evict.

Policy is separate from utility because the slot itself gates them on separate
flags (`mutablePolicy` vs `mutableUtility`). Swapping what a slot does and
swapping whether it can be taken from you are different promises to an occupant;
merging the roles here would undo that distinction one layer up.

`cancelPendingUpdates` is admin-only because the slot cannot honour the split.
Its implementation is `delete pendingUpdate; delete pendingPolicyUpdate` — all
three domains at once, with no per-domain variant. Exposing it to
`TAX_MANAGER_ROLE` would let a tax manager silently destroy a policy manager's
queued proposal, which is the exact boundary these roles draw. Only the role that
already outranks all three may reach across all three.

## Three consequences of inheriting SplitWalletV2

These are not stylistic. Each one is a live failure if handled naively.

### 1. `Wallet.execCalls` is a total role bypass

`SplitWalletV2` inherits `Wallet`, which exposes `execCalls` — arbitrary
multicall, gated only on `msg.sender == owner`, and **not `virtual`**, so it
cannot be overridden away. Because SlotManager *is* the slot's manager, a human
owner could call:

```solidity
execCalls([{ to: slot, data: proposeTaxUpdate(9999) }])
```

and route around every role. The roles would be decoration.

**Resolution:** ownership is bound to `address(this)` at construction and
`transferOwnership` reverts. `execCalls` then has no reachable caller. The
owner-gated functions we *do* want — `updateSplit`, `setPaused` — are re-exposed
behind `SPLIT_MANAGER_ROLE`, which works because splits' own `onlyOwner` already
admits `msg.sender == address(this)`.

This makes `transferOwnership() reverts` load-bearing rather than hygiene, and it
is why `setSplit` routes through an external self-call (`this.updateSplit(...)`)
rather than reimplementing the hash-and-validate logic.

### 2. `PushSplit` has no `receive()`

Upstream, `SplitProxy` supplies it — a documented dodge of the DELEGATECALL gas
cost. Deployed directly there is no proxy. Without a `receive()`, every native-ETH
tax push from `Slot._payOrCredit` — a deliberately gas-capped `call{gas: 30_000}`
— fails and silently degrades into a `withdrawableOf` credit needing a manual
`claim`. The empty `receive()` stays well inside the cap (measured: ~15k for the
whole call).

### 3. `initialize` is `onlyFactory`

`SplitWalletV2.initialize` is gated on `msg.sender == FACTORY`, where `FACTORY`
is whoever deployed. Deploying directly rather than through `PushSplitFactory`
would leave a window between construction and initialization in which the
contract is a live but unconfigured recipient. The constructor does the work
instead, which is why the split validator is hand-written — `SplitV2Lib.validate`
is calldata-only.

The constructor also rejects two splits that upstream `validate()` permits: zero
recipients, and allocations summing to zero. The second is the dangerous one —
`calculateAllocatedAmount` divides by `totalAllocation`, so a zero total makes
every `distribute` revert, permanently stranding a live recipient.

### Bonus: sealed ERC-1271

`getSigner()` is non-`virtual` upstream and returns `owner`, which here is
`address(this)`. `SignatureChecker` falls back to an ERC-1271 staticcall when the
signer has code, so the inherited `isValidSignature` would call back into itself
with a re-wrapped hash and recurse until out of gas — a gas bomb for any
integrator probing for ERC-1271 support. Overridden to return `0xffffffff`. A
contract governed by four roles has no single signer anyway, so the honest answer
and the safe one agree.

## Operations

`sweep(slots[])` is permissionless and pulls revenue toward the split: `collect()`
per slot, then `claim(address(this))` to recover anything previously booked as a
credit. Safe to leave open — `collect()` always pays the slot's own `recipient`,
and `claim(address)` pays the account named and cannot be redirected. Each leg is
individually try/caught because both revert in ordinary conditions
(`NothingToCollect`, `NothingToClaim`), and one empty slot should not sink a batch.

`distribute()` stays a separate call: it needs the full `Split` struct as calldata
to check against `splitHash`.

**Native token sentinel mismatch:** `Slot` uses `address(0)` for native currency;
Splits uses `NATIVE_TOKEN` (from the warehouse). Callers of `distribute` must pass
the Splits sentinel, not the Slot one.

## Dependencies added

- `lib/splits-contracts-monorepo` (submodule) — splits-v2 sources
- `lib/solady` (submodule) — required by `PushSplit`, which imports
  `solady/utils/SafeTransferLib.sol`
- remappings: `splits-v2/`, `solady/`

Splits-v2 upstream resolves its own deps through `node_modules`; this repo uses
`lib/`, so the remappings bridge that. `@openzeppelin/contracts/` was already
mapped and OZ 5.6.1 satisfies splits' imports.

`SlotManager.sol` uses `pragma ^0.8.23` (splits' floor) against the repo's
`^0.8.20`; the whole tree builds on solc 0.8.29.

## Not covered

- No deploy script. Deployment ordering matters: SlotManager must exist before
  the slot, since `SlotFactory.createSlot` takes `recipient` and `config.manager`
  as arguments.
- No timelock on relays. Role holders act immediately; the delay that exists is
  the slot's own (proposals apply on the next ownership transition).
- No `mutableTax` / `mutableUtility` / `mutablePolicy` pre-checks in the relays —
  a proposal against an immutable dimension reverts on the slot with
  `TaxNotMutable` etc., which is a correct and legible failure.
