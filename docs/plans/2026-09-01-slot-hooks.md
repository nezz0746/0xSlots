# Slot hooks — one extension point instead of three

Status: **draft. No code written.**

Today a slot has three extension surfaces with different rules, different
registries, and inverted failure semantics. This collapses them into one.

---

## The problem is legibility, not capability

Everything below is already possible. What is missing is a way to explain it in
one sitting.

To extend a slot today you must know:

| | occupancy policy | utility head | gallery module |
|---|---|---|---|
| may refuse | ✅ | ❌ | ❌ |
| on failure | reverts the action | swallowed | swallowed |
| mutability | `view` | writes | writes |
| gas | uncapped | 500k | 500k each |
| how many | 1 | 1 | up to 8 |
| set by | `proposePolicyUpdate` | init only, vacate only | `addModule` |
| verification | declared but **never enforced** | n/a | **enforced** |
| interface | `checkBuy` / `checkPriceUpdate` | `onTransfer` / `onPriceUpdate` / `onRelease` / `onSettle` | same |

Two of those rows are actively confusing. Failure semantics are inverted between
tiers, and verification is enforced on the tier that *cannot* cause harm while
being merely advisory on the tier that can veto every buy on a slot forever.

## The rule that replaces the table

> **`before` decides and may refuse. `after` records and cannot.**

Everything else follows:

- `before*` is `view`, so it cannot write and therefore cannot reenter. That is
  why it is safe to call uncapped.
- `after*` is gas-capped and its revert is swallowed, so it cannot block a buy —
  and above all cannot block a liquidation.

One interface, one context struct, one registration, one sentence about failure.

---

## Shape

```solidity
struct HookFlags {
    bool beforeBuy;
    bool beforeSell;
    bool beforeSelfAssess;
    bool afterBuy;
    bool afterSell;
    bool afterRelease;
    bool afterLiquidate;
    bool afterSettle;
}

interface ISlotHook {
    /// Read ONCE at registration and snapshotted.
    function hooks() external pure returns (HookFlags memory);

    // ── decisions: `view`, may revert to veto ────────────────────────────
    function beforeBuy(SlotContext calldata) external view;
    function beforeSell(SlotContext calldata) external view;
    function beforeSelfAssess(SlotContext calldata) external view;

    // ── effects: capped, swallowed, cannot change the outcome ────────────
    function afterBuy(SlotContext calldata) external;
    function afterSell(SlotContext calldata) external;
    function afterRelease(SlotContext calldata) external;
    function afterLiquidate(SlotContext calldata) external;
    function afterSettle(SlotContext calldata) external;
}
```

`SlotContext` is today's `OccupancyContext` plus the settlement fields (`owed`,
`paid`) the `after` side needs. One shape everywhere — the current split, where
a policy gets nine fields and a module gets loose deltas, is a needless second
thing to learn.

### Flags are declared, not encoded in the address

Uniswap v4 packs hook permissions into address bits. It is elegant and it is the
wrong trade here: it requires a salt miner in the deploy pipeline, forces a
redeploy whenever a flag is wrong, and produces an address that tells a reader
nothing. v4 pays that to save gas in the hottest loop in DeFi. We are paying for
comprehension instead.

Flags are also **not optional**, for a reason that is easy to miss: a `before*`
hook is fail-CLOSED. Calling one optimistically on a contract that does not
implement it reverts on the missing function — and a fail-closed revert means
**every buy on that slot is vetoed forever**. The `after` set could be
discovered by trying; the `before` set never can.

Snapshotted at registration so a hook cannot widen its own reach mid-tenure.

---

## One hook per slot. Composition lives in userland.

The core calls **one address**.

A slot wanting a price floor *and* metadata *and* an oracle points at a
`CompositeHook` that fans out — exactly the pattern `AllOfPolicy`,
`OneOfPolicy` and `CompositePolicy` already established.

This is the part that matters most, and it is not only tidiness:

**The loop leaves the liquidation path.** Today the gallery iterates untrusted
addresses inside `liquidate()`. With fan-out in userland the core makes one
capped, swallowed call, and that single cap bounds the entire subtree beneath
it. A badly built composite harms only the slot that chose it and cannot reach
the protocol's first invariant.

| | today | unified |
|---|---|---|
| concepts to learn | 3 | 1 |
| addresses on a slot | 1 + 1 + 8 | 1 |
| fan-out runs in | core, inside `liquidate` | userland |
| failure modes | 2, inverted, unlabelled | 2, named `before` / `after` |

---

## Getters: one canonical name, one legacy alias, one removal

The three names for one concept are the most visible part of the confusion, and
they are not all in the same situation. Which of them are frozen is a question
of fact, not taste:

| getter | who reads it | verdict |
|---|---|---|
| `hook()` | — | **new.** The canonical name. |
| `module()` | `@adland/embed` → `packages/react/src/fetch.ts` — published to npm **and** served from a CDN | **keep** as a documented alias for `hook()` |
| `utility()` | only adland's own `use-collective-earnings.ts`, which they redeploy at will | **remove** |
| `mutableModule()` / `mutableUtility()` | same split | collapse to one |

`module()` is the one that cannot go. That file picks a single-value call
deliberately, and says why in a comment:

> a slot deployed after the `module` → `utility` rename fails to decode against
> an older SDK's ABI

They have already been burned by exactly this rename once. The embed is bundled
by third parties from npm, so its consumers cannot be enumerated, let alone
asked to upgrade.

`utility()` is the opposite: it is the *newer* name, it has no external reader,
and it is the one that caused the ambiguity in the first place.

### Removing a getter is not removing storage

`utility` at slot 6 and `occupancyPolicy` at slot 15 stay **forever**, whatever
happens to their getters. 237+ live proxies hold state at those offsets; a
getter is bytecode, a slot is a promise. The fields simply stop being read.

---

## Migration: upgrade in place where possible, adapt where not

The split is decided by whether a contract is a proxy, and it falls almost
entirely on the useful side:

| | upgradeable in place | needs an adapter |
|---|---|---|
| **modules** | `MetadataModule`, `AdModule` (UUPS via inheritance), `FeedPostModule`, `SlotData` | — |
| **policies** | — | all six: `MinimumPrice`, `MinimumTenure`, `TokenHolder`, `AllOf`, `OneOf`, `Composite` |

**Every module is a UUPS proxy.** Each becomes a hook by upgrading its
implementation: it gains `hooks()` and the `after*` functions, keeps everything
it already does, keeps its per-slot storage, and **keeps its address**.

**Every policy is immutable** — deployed through CREATE2 factories with no
upgrade path. They are small and pure, so wrapping is cheap: a
`LegacyPolicyAdapter` of roughly forty lines implements `ISlotHook`, declares
only the `before*` flags, and forwards to an existing `IOccupancyPolicy`.

Nothing deployed has to be abandoned, and no upgrade has to be coordinated with
any other.

### Worked example: AdLand

This is the case that decides whether the design is practical, and it comes out
better than a compatibility story — it comes out as *no story at all*.

1. `MetadataModule`'s implementation is upgraded to `AdLandHook`. It declares
   `afterBuy` and `afterRelease` (what it already reacts to), keeps
   `tokenURI(slot)`, keeps every slot's stored URI, and keeps its address —
   `0x0896A9…` on Base.
2. A slot sets `hook` to that same address.

adland's render path is unchanged:

```
slot.module()  →  0x0896A9…  →  tokenURI(slot)  →  the creative
```

And `module()` returning the hook is not a shim papering over a rename — **for
adland the hook literally is the module**, the same contract at the same
address, upgraded. The embed needs no republish, the CDN needs no new build, and
the npm consumers nobody can enumerate never notice.

One UUPS upgrade. No address change. No client change.

## Open decisions

**Does `beforeSell` exist?** Today `sell()` runs `checkBuy`. But the buyer now
signs their terms, so a veto there overrides explicit consent from both parties.
Keeping it lets a token-gate still apply to who may occupy; dropping it says a
signed order between willing parties is final. *Recommend keeping it* — the gate
is about occupancy, not about the trade.

**Do `before` hooks ever need to write?** The design says no: `view` is what
makes them safe to call uncapped. If a hook needs to record something about a
decision, that is what the matching `after` is for. Worth confirming no intended
use case needs otherwise, because this is the load-bearing constraint.

**Which module upgrades first?** `MetadataModule` is the obvious pilot: it is
the one with a frozen external consumer, so if the in-place upgrade holds for
adland it holds for everything. `FeedPostModule` and `SlotData` follow with no
external pressure at all.

---

## Sequence

1. **Collapse the gallery** — pure deletion. Shrinks the pending beacon upgrade
   and means the merge later joins two single addresses rather than a tier and a
   list.
2. **`ISlotHook`, `SlotContext`, flags.** New surface; nothing existing breaks.
   `hook` is added, `utility()` removed, `module()` kept as an alias.
3. **`LegacyPolicyAdapter`** — the six immutable policies keep working.
4. **`CompositeHook`** — the userland fan-out.
5. **Upgrade `MetadataModule` in place to `AdLandHook`** — the pilot, and the
   proof the migration story holds where it is hardest.
6. **SDK, indexer, explorer** — one address to show instead of three concepts.
7. **Docs** — the `before` decides / `after` records rule, stated once, near the
   interface.

Steps 1 and 2 are independent and either can land alone. Step 5 is the one worth
doing early despite its position: it is the only step with a consumer that
cannot be asked to upgrade, so it is where the design either survives contact
or does not.

---

## What this deliberately does not do

- **Does not make `after` hooks revertable.** In Uniswap v4 a bricked hook kills
  your pool, which is acceptable because the pool creator chose it and it is
  immutable. Here the *manager* chooses, the *occupant* bears it, and a *third
  party's* liquidation right is at stake. A revertable `afterLiquidate` rebuilds
  the unremovable-occupant bug this codebase has already fixed once.
- **Does not give hooks money.** Module fees were removed after every deployed
  module was found to charge zero; reintroducing a fee path would restore the
  retroactive-redirect and uncapped-call problems along with it.
- **Does not remove `module()`.** That selector is permanent: it is what
  `@adland/embed` resolves a creative through, and the embed is bundled from npm
  by consumers who cannot be enumerated. `utility()` goes, because its only
  reader is adland's own app.
- **Does not move any storage.** Slots 6 and 15 keep their state whatever
  happens to the getters that read them.
