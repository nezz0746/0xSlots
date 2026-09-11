# Service hub — open participation behind one hook — design

**Status:** design, approved in conversation, not built.
**Builds on:** [`../../plans/2026-09-01-slot-hooks.md`](../../plans/2026-09-01-slot-hooks.md) (the one-hook model) and the reasons `CompositeHook` was removed in `a922792`. Read the "One hook per slot" note in `apps/contracts/src/ISlotHook.sol` first: this document has to answer it, and does, in §2.
**Related:** [`../../plans/2026-08-29-module-gallery.md`](../../plans/2026-08-29-module-gallery.md), the last time a slot carried a list of participants, and why that list was closed.

---

## 1. Scope

A slot points at exactly one hook, and that does not change. This document
adds a hook that other people can plug **effects** into after it is deployed,
with the occupant's consent, in a way that survives the slot changing hands.

Vocabulary, used consistently below:

| word | meaning |
|---|---|
| **host** | The hook the slot points at. It inherits the hub and carries its own rules. |
| **hub** | The machinery inside the host: a per-slot set of services and the fan-out to them. |
| **service** | An effects-only contract a third party wrote, attached to one slot's set. |
| **author** | Whoever controls a service contract. The contract itself speaks for them. |
| **offer** | A service saying "I will serve this slot" (or any slot). |
| **accept** | An occupant saying yes to an offer, for the slot they hold. |

In scope: the interfaces, the abstract hub, the open participation layer, one
default host with no rules, one host carrying the minimum-tenure rule, tests,
deploy script entries, and docs.

Out of scope, listed in §11.

### Decisions taken as given

| Decision | Value | Why |
|---|---|---|
| Service power | Effects only: `afterBuy`, `afterRelease`, `afterLiquidate`, `afterSettle`. Never `before`, never `strict`. | The one property that makes everything else safe. See §2. |
| Who removes | The occupant, or the service itself. Immediately. | Symmetric with acceptance. No new role, no timer. |
| Offer scope | A named slot, or any slot behind this hub. | Two-sided consent either way. |
| Who offers | The service contract itself. | Proves control of the code. See §5. |
| Shape | An abstract base the host inherits, not a forwarder. | The host keeps its own frame. See §2. |
| Persistence | The set is never cleared by a transition. | The stated goal. See §5. |
| Manager | No role in the service set. | A manager who wants otherwise proposes a different hook. |

---

## 2. Why this is allowed, given what was removed

`CompositeHook` fanned a slot's one hook out to a list of children and was
deleted for four documented reasons. A design here must answer each, and the
answer to all four is the same decision: **a service cannot decide anything.**

| Reason the fan-out was removed | Answer |
|---|---|
| One `bytes32` of `hookData` cannot configure two children. | Only the host reads `hookData`. Services are handed it **zeroed** and configure themselves through their own entry points, the way AdLand's `publish` does. |
| The 500k `after` stipend does not divide cleanly. | The host's effect runs first, in its own frame. Services share what is left, equal share of the remainder recomputed per service, capped per service, and the loop stops cleanly at a floor. Under a non-strict host the slot's single 500k cap still bounds the whole subtree. |
| Strictness is ambiguous when one child declares it and another does not. | Only the host may be strict. A service that declares `strict`, or any `before` flag, is refused at accept. |
| A veto arrives wearing the forwarder's name. | There is no forwarder. The host vetoes in its own frame, with its own revert reason, and `msg.sender` is still the slot. |

What this buys that a purpose-built hook cannot: **participation after
deployment, by people other than the hook's author.** A purpose-built hook
fixes its behaviours when it is written. A host with a hub lets behaviours
arrive later, from strangers, and lets the person holding the slot decide which
ones. The module gallery spec made the case that composition cannot be observed
in demand before it exists. This is that composition, confined to the half of
the hook interface that cannot block anyone.

The "hook cannot widen its own reach mid-tenure" rule survives intact. The
hub's flags are snapshotted like any hook's. What changes behind the `after`
flags changes only when the **occupant** adds a service, and the occupant is
exactly the party that rule protects. The next occupant inherits capped effects
they may prune, and can read `servicesOf(slot)` before buying.

---

## 3. Components

Seven source files under `apps/contracts/src/hooks/hub/`.

### 3.1 `ISlotService.sol`

A declared subset of `ISlotHook`. Same names, same `SlotContext`, same
`HookFlags`.

```solidity
interface ISlotService {
    function subscriptions() external view returns (HookFlags memory);
    function afterBuy(SlotContext calldata ctx) external;
    function afterRelease(SlotContext calldata ctx) external;
    function afterLiquidate(SlotContext calldata ctx) external;
    function afterSettle(SlotContext calldata ctx) external;
}
```

Any effects-only hook already satisfies it without changes. The hub reads
`subscriptions()` once at accept and **refuses** a service that declares any
`before` flag, declares `strict`, or declares nothing. Refused rather than
ignored: a hook that declares `beforeBuy` expects to veto, and silently never
calling it is the "declared but never enforced" confusion the hooks plan
removed.

A service's `after` functions are world-callable, as any hook's are. The hub
gives a service one extra fact to lean on: **when `msg.sender` is a hub, `ctx`
is the slot's truth** (§4). A service may `require(msg.sender == HUB)`, or
trust nothing and use a stamp the way AdLand does. Either is fine.

### 3.2 `IServiceHub.sol`

Events, errors, and the two public surfaces, in one file so the SDK and the
indexer import types without the implementation. Follows `IAdLand.sol`.

```solidity
interface IServiceHub {
    event ServiceAccepted(address indexed slot, address indexed service, uint8 flags);
    event ServiceRemoved(address indexed slot, address indexed service, address by);
    event ServiceCallFailed(address indexed slot, address indexed service, bytes4 selector);
    event ServicesStarved(address indexed slot, uint256 remaining);

    error NotTheSlot();
    error AlreadyAttached();
    error NotAttached();
    error TooManyServices(uint256 max);
    error SelfReference();
    error NotAService();
    error ServiceHasNoCode();

    function MAX_SERVICES() external view returns (uint256);
    function SERVICE_GAS() external view returns (uint256);
    function SERVICE_GAS_MIN() external view returns (uint256);

    function servicesOf(address slot) external view returns (address[] memory);
    function serviceFlagsOf(address slot, address service) external view returns (HookFlags memory);
}

interface IOpenParticipation is IServiceHub {
    event ServiceOffered(address indexed service, address indexed slot);
    event OfferWithdrawn(address indexed service, address indexed slot);

    error NotOccupant();
    error NotOffered();

    function offer(address slot) external;
    function withdraw(address slot) external;
    function accept(address slot, address service) external;
    function remove(address slot, address service) external;
    function isOffered(address service, address slot) external view returns (bool);
}
```

Errors are scoped inside the interfaces, as AdLand's are, so `NotOccupant`
cannot clash with the core's file-level error of the same name.

### 3.3 `ServiceHub.sol` — the raw composite

Abstract. Implements `ISlotHook` and `IServiceHub`. Leaves to the host:

```solidity
/// The host's own flags. The hub ORs in all four `after` flags.
function _hostFlags() internal view virtual returns (HookFlags memory);

/// The host's own effect, run FIRST, in the host's frame, with the real ctx.
function _hostAfterBuy(SlotContext calldata ctx) internal virtual {}
function _hostAfterRelease(SlotContext calldata ctx) internal virtual {}
function _hostAfterLiquidate(SlotContext calldata ctx) internal virtual {}
function _hostAfterSettle(SlotContext calldata ctx) internal virtual {}
```

`beforeBuy`, `beforeSelfAssess` and `validateHookData` are the host's entirely;
the hub declares nothing about them beyond what `ISlotHook` requires.

The hub's `subscriptions()` is `_hostFlags()` with `afterBuy`, `afterRelease`,
`afterLiquidate` and `afterSettle` forced true. Forced because services may
subscribe to any of them after the host is attached, and the slot snapshots
once. A slot with no services pays one capped call per callback that returns
after a `SLOAD`. AdLand already accepts this shape for its unconditional
`before` flags.

Provides, internal, for whatever governs the set:

```solidity
function _attach(address slot, address service) internal;  // validates, snapshots, appends
function _detach(address slot, address service) internal;  // swap-and-pop, clears flags
```

`_attach` is where every acceptance rule that is about the **service** lives:
code present, not self, not already attached, under the bound, flags
well-formed. `OpenParticipation` adds only the rules that are about
**consent**. Split this way so a future host with different governance, a
manager-curated set for instance, reuses every validation.

Storage is ERC-7201 namespaced. See §6.

### 3.4 `OpenParticipation.sol` — the participation layer

Abstract. Inherits `ServiceHub`, implements `IOpenParticipation`. Adds
`offer`, `withdraw`, `accept`, `remove` and `isOffered`. Rules in §5.

### 3.5 `OpenHub.sol` — the default host

Concrete. `OpenParticipation` with no rules of its own:

- `_hostFlags()` returns all false.
- `validateHookData` is a no-op and accepts anything, zero included, said
  deliberately in a comment.
- `beforeBuy` and `beforeSelfAssess` exist for the interface, are never
  subscribed, and are never called by a slot.
- `IDescribedHook.descriptors()` returns one entry: family
  `slots.hook.service-hub`, version 1, empty signature, empty data.

One deployment serves every slot that wants services and nothing else.

### 3.6 `TenureHub.sol` — an immutable root, worked

Concrete. `MinimumTenure` plus `OpenParticipation`, mirroring
`MinimumTenureHook` line for line on the rule side:

- `_hostFlags()`: `beforeBuy`, `beforeSelfAssess`, `afterRelease`,
  `afterLiquidate`.
- `validateHookData` is `tenureOf(data)` run for its revert.
- `beforeBuy` and `beforeSelfAssess` call the base's enforcement.
- `_hostAfterRelease` and `_hostAfterLiquidate` call `_barReentry(ctx)`, which
  keys on `ctx.slot` and works in-frame exactly as it does today.
- `descriptors()` returns two entries, tenure first then the hub family, the
  way AdLand declares two.

It is the proof that a rule-carrying host composes correctly, and the pairing
AdLand already implies.

### 3.7 `ServiceBase.sol` — for authors

Abstract, optional. `Ownable` plus:

```solidity
function offer(IOpenParticipation hub, address slot) external onlyOwner;
function withdraw(IOpenParticipation hub, address slot) external onlyOwner;
```

So an author who inherits it writes nothing to participate. A service that
wants a different guard calls the hub itself.

---

## 4. Fan-out and gas

Every one of the hub's four `after` functions does the same three things, in
this order.

**1. Authenticate.** `if (msg.sender != ctx.slot) revert NotTheSlot();` The
slot always passes, because it builds `ctx.slot` from `address(this)`. A forger
always fails. Under a strict host this revert propagates, but only to the
forger's transaction. This is the property services may lean on: a call from a
hub carries the slot's own context.

**2. Host effect.** `_hostAfterX(ctx)`, in the host's frame, with the original
calldata context including `hookData`. First, because the host is the slot's
chosen rule and must never lose gas to additions the occupant made.

**3. Services.** Copy `attached[ctx.slot]` to memory, so a service that
detaches itself mid-loop cannot shift the iteration. Encode the payload once:
`ctx` copied to memory with `hookData` set to zero. Then for each service whose
snapshotted flags include this callback:

```
share = min(SERVICE_GAS, (gasleft() - FAN_OUT_FLOOR) / remaining)
if share < SERVICE_GAS_MIN: emit ServicesStarved(slot, remaining); stop
(ok, ) = service.call{gas: share}(payload)
if !ok: emit ServiceCallFailed(slot, service, selector)
```

`remaining` counts services not yet called, so an under-spender leaves more for
the rest and the last is funded as well as the first. That is the correction
the old composite arrived at after a constant stipend starved every nested
child.

Constants, `public constant` so clients can read them:

| constant | value | why |
|---|---|---|
| `MAX_SERVICES` | 8 | The bound the old composite and the gallery used. Keeps the worst case legible. |
| `SERVICE_GAS` | 100,000 | Per-service cap. Enough for a mint or a couple of fresh writes. |
| `SERVICE_GAS_MIN` | 30,000 | One fresh write plus call overhead. Below it a call is a guaranteed failure, so it is not made. |
| `FAN_OUT_FLOOR` | 15,000 | Headroom for the loop, the starved event and the return. Internal. |

**Non-strict host.** The slot forwards `HOOK_GAS` (500k) and that single cap
bounds the whole subtree, host included. An eviction costs exactly what it
costs today. Services compete with each other inside a budget the slot already
pays.

**Strict host.** `subscriptions().strict` is the host's own flag, snapshotted
and shown in `SlotInfo.hookFlags` as for any hook. The host's effect runs
uncapped, which is what it asked for. Services stay capped and swallowed. The
most an eviction can cost beyond the host's own work is
`MAX_SERVICES * SERVICE_GAS`, 800k, plus loop overhead, and a buyer can read
the flag and `servicesOf(slot)` before committing.

**Codeless services.** A service whose code is gone by callback time, a revoked
7702 delegation for instance, receives a plain `call` that succeeds with empty
returndata. A harmless no-op. The old composite's hazard was a codeless
`before` child reading as assent, and there is no `before` here.

**Reentrancy.** The slot's transitions are `nonReentrant`, so a service cannot
reenter `buy`, `release` or `liquidate`. Inside the hub, the memory copy
protects the loop, and `accept`, `remove` and `withdraw` follow
checks-effects-interactions with their only external read, `subscriptions()`,
made before any write.

**`before` is untouched.** The host implements it, the slot calls it uncapped
and `view` as today, and the hub is not in the path.

---

## 5. Participation rules

Four public functions on `OpenParticipation`.

### `offer(address slot)`

Called by the service contract itself: `msg.sender` **is** the service. `slot`
zero means any slot behind this hub. Sets `offered[msg.sender][slot] = true`,
emits `ServiceOffered`. Idempotent.

An offer is **standing**. It survives acceptance and removal, so an occupant
can re-accept after pruning without the author acting again. Only `withdraw`
ends it.

Why the service itself and not an address on its behalf: an offer sent by the
service's own code proves control of that code. Recording an offerer as the
author would let anyone squat as the author of a service they do not own and
later `withdraw` it from every slot that accepted it. The cost is a five-line
passthrough per service, which `ServiceBase` provides.

### `withdraw(address slot)`

Called by the service. Clears `offered[msg.sender][slot]`, emits
`OfferWithdrawn`. If `slot` is a real slot and the service is attached there,
also `_detach`, emitting `ServiceRemoved(slot, service, service)`. The detach
happens whether the acceptance came through the named offer or the wildcard.

Withdrawing the wildcard (`slot == 0`) stops new accepts and detaches nothing.
Nothing here iterates over slots; an author that wants out of a particular slot
names it. An author that wants to stop serving everywhere without naming each
slot makes its `after` functions return early, which is cheaper for everyone.

### `accept(address slot, address service)`

Called by the slot's current occupant: the slot's `occupant()` must equal
`msg.sender`, else `NotOccupant`. The slot is read through a narrow interface
declared in `IServiceHub.sol`, the way `ISlotAd` is. Then:

1. `offered[service][slot] || offered[service][0]`, else `NotOffered`.
2. `_attach(slot, service)`, which checks in order: `service.code.length > 0`
   (`ServiceHasNoCode`), `service != address(this)` (`SelfReference`),
   `flagsOf[slot][service] == 0` (`AlreadyAttached`),
   `attached[slot].length < MAX_SERVICES` (`TooManyServices`), then reads
   `ISlotService(service).subscriptions()` and packs the four `after` bits.
   Any `before` bit, the `strict` bit, or no `after` bit at all is
   `NotAService`. A revert or a malformed answer is also `NotAService`.
3. Append, store flags, emit `ServiceAccepted(slot, service, flags)`.

This is the occupant's own transaction, so a plain external call and Solidity
decoding are fine here. The fail-open assembly reader in `SlotHooks` exists for
the eviction path; nothing about `accept` is on it.

Only direct self-reference is checked. A service that is itself a hub is
allowed and is bounded like any other service by `SERVICE_GAS`; its own loop
stops at its own floor.

Operators of the occupant do not qualify. Occupant only, at launch.

The slot need not point at this hub. Accepting a service on a slot whose hook
is elsewhere is allowed and harmless: the set is keyed by slot address, and
only a slot that points here ever fans out to it. Checking `hook()` would
refuse an occupant preparing a set for a host that is proposed but not yet
applied.

### `remove(address slot, address service)`

Called by the occupant, same check as `accept`. `_detach`, else `NotAttached`.
Emits `ServiceRemoved(slot, service, msg.sender)`.

### Persistence is the absence of a rule

No callback touches the set. `_hostAfter*` are the host's and the fan-out only
reads. A buy, a release, a liquidation and a vacancy leave `attached[slot]` as
it was. A vacant slot has no occupant, so nobody can accept or remove until
someone is seated, and the set waits.

### The manager

Has no function here. A manager who wants a different service governance
proposes a different host through `proposeTerms`, which is the same path as any
change of terms and carries the same delay and the same deferral to the next
transition.

---

## 6. Storage

One ERC-7201 namespace, `slots.storage.ServiceHub`, so a live UUPS proxy such
as AdLand can inherit the hub in a later upgrade without moving a slot. Same
pattern and same reasoning as `MinimumTenure`.

```solidity
/// @custom:storage-location erc7201:slots.storage.ServiceHub
struct HubStorage {
    mapping(address slot => address[]) attached;
    mapping(address slot => mapping(address service => uint8)) flagsOf;
    mapping(address service => mapping(address slot => bool)) offered;
}
```

- `attached`: ordered, bounded at `MAX_SERVICES`. Order is call order.
- `flagsOf`: bits 0..3 are `afterBuy`, `afterRelease`, `afterLiquidate`,
  `afterSettle`. Zero means not attached, so it doubles as membership.
- `offered`: slot zero is the wildcard. Lives in the hub's storage rather than
  the participation layer's so there is one namespace to audit.

The constant is derived by the standard formula and asserted by a test.

---

## 7. Views

- `servicesOf(slot)`: the ordered list.
- `serviceFlagsOf(slot, service)`: unpacked `HookFlags`, decision bits and
  `strict` always false, all false when not attached.
- `isOffered(service, slot)`: true for the named slot or the wildcard.

Clients render the set from these. The `IDescribedHook` descriptor is `pure`
and global, so it names the family and nothing per slot.

---

## 8. Safety properties

Stated as invariants the tests assert.

1. No service can revert a buy, a release, a liquidation or a settle. Every
   service call is capped and its failure swallowed, whatever the host's
   strictness.
2. A slot with any number of services attached is liquidatable, with the same
   gas bound as today under a non-strict host and a bound of
   `MAX_SERVICES * SERVICE_GAS` more under a strict one.
3. A service is handed `hookData == 0`. The host is handed the slot's word.
4. `ctx` reaching a service was built by the slot: the hub refuses any caller
   but `ctx.slot`.
5. The set changes only on `accept`, `remove` and `withdraw`. No transition
   changes it.
6. Nothing with a `before` bit or the `strict` bit is ever attached.
7. The host's own effect runs before any service and is never starved by one.
8. A service that detaches itself, or another, mid-fan-out does not change
   which services the current fan-out calls.

---

## 9. Testing

Forge, in `apps/contracts/test/slots/`, using the fixture style of
`StrictHooks.t.sol` and `HookData.t.sol`: real slots from a real factory,
small purpose-built hook contracts declared at the top of the test file.

- `ServiceHub.t.sol`: host effect runs first; services receive `hookData`
  zeroed while the host sees the word; forged `ctx` reverts `NotTheSlot`; a
  hungry service does not starve the next; `ServicesStarved` fires once at
  exhaustion; `ServiceCallFailed` fires for a reverting service and the rest
  run; a service that withdraws itself mid-loop does not shift iteration; a
  codeless service is a no-op; under a strict host the host's write lands
  uncapped while a reverting service is still swallowed; `liquidate` succeeds
  with eight hungry services attached under both host modes.
- `OpenParticipation.t.sol`: every rule in §5 and every error in §3.2;
  wildcard versus named offer; re-accept after remove without a new offer;
  `withdraw` detaches from the named slot only; wildcard withdraw detaches
  nothing; refusal of a service declaring `before`, `strict`, nothing, or with
  no code; persistence through buy, release, liquidation and vacancy; events
  carry the right `by`.
- `OpenHub.t.sol`: attaches with zero `hookData`; never vetoes; descriptor
  family present; a spy written against `ISlotHook` with `after` flags only
  works as a service unchanged.
- `TenureHub.t.sol`: the tenure rule holds with services attached, including
  the re-entry bar keyed on `ctx.slot`; descriptor carries both families.
- One test that the ERC-7201 constant equals
  `keccak256(abi.encode(uint256(keccak256("slots.storage.ServiceHub")) - 1)) & ~bytes32(uint256(0xff))`.

`forge test` must pass in full, not only the new files.

---

## 10. Deployment and docs

**Deploy.** `OpenHub` and `TenureHub` join `script/protocol/DeployProtocol.s.sol`
beside `MinimumTenureHook`: CREATE2, `record(...)`, logged. Neither has a
`version()`; use a script constant the way `TENURE_HOOK_VERSION` is used.
Both names go on the `INCLUDE` allowlist in `packages/contracts/wagmi.config.ts`.

**Docs.** Three existing places:

- `apps/docs/docs/pages/concepts/hooks.mdx`, the "Many behaviours: one hook"
  section, gains the services model: one hook, and an open set of effects the
  occupant accepts, with the four-reasons table from §2 condensed.
- `apps/docs/docs/pages/reference/hooks.mdx` gains `ISlotService` and the
  `IServiceHub` / `IOpenParticipation` surfaces.
- The "One hook per slot" note in `apps/contracts/src/ISlotHook.sol` gains one
  sentence naming the hub as the sanctioned way to compose effects, so the
  next reader does not stop at "fan-out was tried and removed".

The vocabulary rule holds in every doc: services and sponsors, never ads or
advertisers; common ownership, never Harberger.

---

## 11. Out of scope

Deliberately, each a separate change:

- Indexer schema and SDK client for services. The events in §3.2 are shaped
  for it.
- Explorer UI for offering, accepting and rendering services.
- AdLand adopting the hub in an upgrade. It touches a live proxy.
- A forwarding host with an immutable `ROOT` address, for hooks that cannot be
  redeployed. Build it on `ServiceHub` if a real one appears.
- Any fee or payment between services and occupants.
- Operator acceptance.

---

## 12. File list

```
apps/contracts/src/hooks/hub/ISlotService.sol
apps/contracts/src/hooks/hub/IServiceHub.sol
apps/contracts/src/hooks/hub/ServiceHub.sol
apps/contracts/src/hooks/hub/OpenParticipation.sol
apps/contracts/src/hooks/hub/OpenHub.sol
apps/contracts/src/hooks/hub/TenureHub.sol
apps/contracts/src/hooks/hub/ServiceBase.sol
apps/contracts/test/slots/ServiceHub.t.sol
apps/contracts/test/slots/OpenParticipation.t.sol
apps/contracts/test/slots/OpenHub.t.sol
apps/contracts/test/slots/TenureHub.t.sol
apps/contracts/script/protocol/DeployProtocol.s.sol      (edit)
packages/contracts/wagmi.config.ts                       (edit)
apps/docs/docs/pages/concepts/hooks.mdx                  (edit)
apps/docs/docs/pages/reference/hooks.mdx                 (edit)
apps/contracts/src/ISlotHook.sol                         (edit, one sentence)
```
