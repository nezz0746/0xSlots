# Migrating to SlotData — cross-repo audit

**Scope** 0xSlots · TheFeed · AdLand
**Subject** `apps/contracts/src/modules/SlotData.sol` v1.0.0 — drafted, tested, undeployed
**Date** 2026-08-17

What breaks when a slot points its `utility` at the general data module instead
of `AdModule` or `FeedPostModule` — and what the key system actually costs.

---

## The short answer

**On the key system: it is roughly one extra call.** The registry is
`AdModule`'s own storage — `slotOf[key]` — and it does not care which utility a
slot points at. Key resolution keeps working untouched after migration. What is
lost is the *single* call: `adByKey` currently resolves the name and reads the
ad together. Afterwards it is `AdModule.slotOf(key)` then
`SlotData.read(slot, serviceId)`.

**The thing to fear is not the key. It is the lens.** `AdModule.ad()` reads a
slot's module and asks it for `tokenURI`. SlotData has no such function and no
fallback, so that call reverts, the surrounding `try/catch` swallows it, and the
ad comes back as an empty string. A migrated slot does not error — it renders as
an empty ad space. That is **F1**, and it is the one that bites silently.

**The feed is a harder case than adland.** SlotData can only be written by the
occupant, as the occupant. The feed's whole social layer depends on writing *on
behalf of* somebody else. There is no version of that in the draft today.

---

## Findings

Ordered by what would break first, not by repo. Severity is about silence as
much as impact — the dangerous ones fail without an error.

### F1 · Critical · adland — the lens returns an empty ad, not an error

`AdModule.ad()` resolves `v.module = slot.module()`, then branches: its own
address reads local storage, anything else gets
`IMetadataRead(module).tokenURI(slot)` inside a `try/catch`. SlotData implements
neither `tokenURI` nor a fallback, so the staticcall reverts and the catch
leaves `v.uri` as `""`.

```
slot.module()                          → SlotData
IMetadataRead(SlotData).tokenURI(slot) → revert (no such function)
  caught by try/catch                  → v.uri = ""
    → renders as an unsold ad space
```

The comments in `ad()` say every failure is deliberately swallowed because "a
key resolving to nothing, a slot with no module… are states a publisher's page
can genuinely be in." That reasoning is sound and it is exactly what makes this
invisible. Every embed on every publisher's page goes blank at once, with a
healthy 200 and no log.

> `apps/contracts/src/modules/AdModule.sol` → `ad()`, module branch

### F2 · Critical · thefeed — delegated attribution has no equivalent

`FeedPostModule` has three write paths, and the feed uses all three. SlotData
has only the first.

| Path | Caller | Attributed to | In SlotData |
|---|---|---|---|
| `updateMetadata` | the occupant | `msg.sender` | yes — `write` |
| `updateMetadataFor` | occupant contract | `account` | **no** |
| `postFor` | trusted router | `account` | **no** |

`SlotData.write` calls `_requireOccupant`, which demands
`occupant() == msg.sender`, and stamps `Wrote.writer = msg.sender`. A
`FeedSocialGroup` that occupies a slot on behalf of its members would have every
post in the group attributed to the group contract's address.
`FeedRouter.buyAndPost` — the sponsored path the web app uses with
`approveAndCall` — has nowhere to land at all.

This is not a shim you can add at the edge. Attribution is in the event
signature, so it has to be a first-class parameter in the module.

> `modules/FeedPostModule.sol` · `FeedRouter.sol` · `FeedSocialGroup.sol`
> thefeed · `apps/web/src/app/create/hooks/use-publish.ts`

### F3 · Critical · all three — a utility swap only lands on an ownership transition

`Slot._applyPendingUpdates()` is reached from exactly three places: `buy`,
`release` and `liquidate`. A proposed utility change sits pending until one of
those runs.

So you cannot migrate a live occupied slot. The ad sitting in it keeps using
AdModule until somebody buys the slot out, the occupant releases it, or it is
liquidated for unpaid tax. Migration is not a deploy — it is a drain, and its
duration is set by advertisers rather than by you.

The practical consequence: both modules have to work correctly, simultaneously,
for as long as the drain takes. Anything that assumes "all slots are on SlotData
now" is wrong for an unbounded period.

> `apps/contracts/src/Slot.sol` → `_applyPendingUpdates()`

### F4 · High · indexer — ponder would index SlotData as an address that never speaks

The indexer discovers modules dynamically —
`slotChildAddress(MODULE_VERIFIED_EVENT, "module")` — which is good: a verified
SlotData gets picked up automatically. But it binds those addresses to
`FeedPostModuleAbi`, which carries only the two `MetadataUpdated` overloads.

SlotData emits `Wrote`, `Cleared` and `ServiceRegistered`. None are in that ABI,
so nothing decodes and no rows appear. Both adland's pinned-OG history and the
feed's timeline read from this table.

> `packages/ponder/ponder.config.ts` · `src/metadata.ts`

### F5 · High · indexer — payload decoding stops being a compile-time problem

Today the indexer receives a `string uri` and decodes it directly into
`rawJson`, `adType` and `cid`. SlotData stores opaque `bytes` plus an ABI
signature held on chain in `Service.schema`.

Because registration is permissionless by design, a service can appear whose
schema the indexer has never seen. It therefore needs a *runtime* ABI-decode
keyed on service id — read the schema, decode against it, store the result —
rather than the fixed shape it has now. That is a genuine change in kind, and it
is the single largest piece of work in the migration.

> `packages/ponder/src/metadata.ts`

### F6 · Good news · adland — the key registry survives untouched

`slotOf[key]`, `pendingOf` and the two-day `CHANGE_DELAY` all live in AdModule's
own storage and are read by calling AdModule *directly*. Nothing about them
depends on any slot pointing at AdModule as its utility.

So `adland-1 → 0xf872…` keeps resolving after migration, with AdModule kept
deployed purely as a registry-and-lens.

```
now    AdModule.adByKey(key)            → 1 call, resolves + reads
after  AdModule.slotOf(key)             → address
       SlotData.read(slot, serviceId)   → bytes
                                        = 2 calls
```

Both are static, both are cheap, and they can be batched into one multicall — so
in wall-clock terms it is closer to zero extra calls than one. The better fix is
F1's: teach the lens about SlotData and `adByKey` stays a single call.

> `modules/AdModule.sol` → registry section
> adland · `packages/react/src/fetch.ts` → `fetchAdByKey`

### F7 · Design · 0xSlots — a key registry inside SlotData has an owner problem

The two contracts currently hold opposite positions on permission, and merging
them forces a choice.

| | AdModule registry | SlotData services |
|---|---|---|
| Who may create | owner only | anyone |
| Change delay | 2 days on an existing key | n/a |
| Stated rationale | a key is a promise to publishers | an admin gate is "a whitelist wearing a registry's clothes" |

Permissionless keys in a flat namespace are a squatting surface — `primary` and
`adland-1` go to whoever calls first. Owner-gated keys reintroduce exactly the
arbiter SlotData's own documentation rejects.

The way out is to make the namespace part of the key rather than a thing to
police: `key = keccak(registrar, name)`. Then anyone may claim any name inside
their own namespace, nobody can take yours, and no owner adjudicates. Adland's
`primary` becomes `keccak(adlandOwner, "primary")` — one constant in the SDK,
same single lookup, and the two-day delay can stay as a per-registrar opt-in
rather than a global rule.

### F8 · Medium · adland + thefeed — a 4 KB payload ceiling that did not exist before

`MAX_DATA = 4096`. `MetadataModule.tokenURI` is an uncapped `string`.

Adland's inline ads run 245–445 bytes, so there is comfortable headroom — but
adland deliberately moved to storing the *whole creative* in the URI to remove
the gateway from the render path. That decision is what makes a ceiling worth
checking rather than assuming: an ad with a longer description or an extra field
grows toward it, and the failure is a revert at publish time.

The feed's posts carry text plus a media array and should be measured against
this before anything moves.

### F9 · Note · 0xSlots — undeployed, with no deploy script

19 tests, covering services, occupancy gating, generation clearing, and the
`buyAndWrite` permit and dust paths. Nothing in `script/` or `deployments/`
references it.

Worth adding before anything else: a test that drives `onTransfer` from a *real*
Slot rather than a mock. The generation trick exists precisely because the hook
runs under the slot's gas cap and a failing utility hook is swallowed — so the
one thing that must never regress is the one thing a mock cannot prove.

---

## If you go ahead

Ordered by dependency. Steps 1–3 are prerequisites for anything touching a live
slot; nothing before step 5 is irreversible.

1. **Teach the lens to read SlotData.** Add a service-aware branch to
   `AdModule.ad()`, or give SlotData a `tokenURI(address)` that returns the
   adland service's payload as a string. The second is uglier and much smaller —
   one function, and F1 disappears for every existing consumer without a single
   client change.

2. **Decide whether the feed migrates at all.** F2 needs
   `writeFor(account, …)` and a trusted-writer set in SlotData, which imports
   FeedPostModule's whole permission model into the general module. That may be
   the right call — or the feed keeps its own module and only adland migrates.
   This is a product decision, not a technical one, and it gates the rest.

3. **Give the indexer a SlotData source and a runtime decoder.** F4 and F5
   together. Until this lands, a migrated slot has no history — which silently
   breaks adland's pinned OG cards, since they resolve a creative by indexer
   event id.

4. **Register the services and pin their ids.** Ids are sequential and
   permissionless, so whoever registers first takes id 1. Register adland's and
   the feed's on each chain immediately after deploying, and treat the ids as
   deployment constants — a chain where they differ is a class of bug worth
   designing out now.

5. **Propose the utility change on one slot and let it turn over.** Per F3 it
   applies on the next buy, release or liquidation. Pick a slot you do not mind
   seeing empty, and watch a real transition before proposing it anywhere that
   matters.

---

## Appendix — can a slot compose more than one utility?

**Today: no.** `utility` is a single `address`. `_applyPendingUpdates` sets one,
`getSlotInfo` returns one, and every hook goes through:

```solidity
function _notifyUtility(string memory name, bytes memory data) internal {
    if (utility == address(0)) return;
    (bool ok, ) = utility.call{gas: 500_000}(data);
    if (!ok) emit ModuleCallFailed(name);
}
```

**But the composition hook is already in the wire format, unused.** Every hook
in `IUtility` takes `uint256 slotId` as its first parameter, and every call site
in `Slot.sol` passes **`0`**:

```solidity
abi.encodeCall(IUtility.onTransfer,   (0, prev, account))
abi.encodeCall(IUtility.onRelease,    (0, prev))
abi.encodeCall(IUtility.onPriceUpdate,(0, oldPrice, newPrice))
abi.encodeCall(IUtility.onSettle,     (0, payer, owed, paid))
```

It is vestigial — from a tokenId era — and the signatures are described as
wire-frozen, so it cannot be removed. That makes it free space in a frozen
interface, which is exactly what a fan-out needs.

### Why a fan-out router is the cheap answer

Deploy a `UtilityRouter` that itself implements `IUtility`, holds a per-slot
list of children, and forwards each hook to each child. A slot points at the
router. **No change to `Slot.sol`, no beacon upgrade, per-slot opt-in.**

The one thing that breaks it as written: every existing module identifies the
slot by `msg.sender`.

```solidity
function onTransfer(uint256, address, address) external { _endTenancy(msg.sender); }   // SlotData
function onTransfer(uint256, address, address) external { _clearMetadata(msg.sender); } // MetadataModule
```

Behind a router, `msg.sender` is the *router*, so every module would clear the
router's state instead of the slot's. Data would silently survive into the next
tenancy — the precise failure `SlotData.generationOf` was designed to prevent.

The fix is to use the free parameter. The router passes
`uint256(uint160(slot))` as `slotId`; a child resolves:

```solidity
address slot = slotId == 0 ? msg.sender : address(uint160(slotId));
```

Backward compatible in both directions. Called directly by a slot, `slotId` is
`0` and `msg.sender` is right. Called through a router, `slotId` names the slot.
Modules are UUPS proxies, so this is a small upgrade to each rather than a
redeploy.

### What sets the ceiling at 2–5

The 500 000 gas cap is on the call to the *router*, and it must cover every
child. So the number of utilities is a gas budget, not a policy:

- the router should sub-cap each child (`gas: remaining / n`) so one expensive
  child cannot starve the rest;
- and swallow each child's failure individually, mirroring what `Slot` does for
  the router — otherwise one reverting child takes the whole batch with it.

Two to five is the honest range for hooks that do a storage write or two.
`SlotData.onTransfer` is one `++` and one event, so it is cheap; a utility doing
real accounting in `onSettle` is not.

### The part that does not compose cleanly

Fees. `_distributeTax` staticcalls the utility for **one** `feeBps()` and **one**
`feeRecipient()`:

```solidity
(bool ok, bytes memory data) = utility.staticcall(...feeBps...);
(bool recipientOk, ...)      = utility.staticcall(...feeRecipient...);
```

A router can sum the bps but there is a single recipient address, so splitting
across children means the router receives the fee and re-distributes it — which
makes the router custodial and turns a small forwarder into something holding
funds. For a first version the sane rule is that **composition is for hooks**:
the router reports `feeBps() = 0`, and any slot needing a fee keeps a single
fee-charging utility. A 0xSplits address as `feeRecipient` already covers most
of what multi-recipient fees would be for, without touching this path.

### The alternative, and why it is worse first

Making `utility` a bounded array in `Slot` and looping in `_notifyUtility` is
cleaner in the long run and avoids the `msg.sender` problem entirely. It also
requires a beacon upgrade to every slot in the protocol, plus changes to
`getSlotInfo`, the pending-update machinery, the indexer and the SDK — and it
puts consensus-critical code in the path of a feature nobody has used yet.

The router proves the demand first. If composition turns out to be common, the
array is the migration *from* the router, and the `slotId` convention above
carries over unchanged.
