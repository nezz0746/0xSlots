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

## Migration is additive — nothing deployed has to move

Two adapters, roughly forty lines each:

- **`LegacyPolicyAdapter`** — implements `ISlotHook`, declares only the
  `before*` flags, forwards to an existing `IOccupancyPolicy`.
- **`LegacyUtilityAdapter`** — declares only the `after*` flags, forwards to an
  existing `IUtility`.

`MetadataModule`, `AdModule`, `FeedPostModule` and all six policies keep
working, unchanged, behind an adapter or inside a `CompositeHook`. They are UUPS
proxies with live state; a lockstep redeploy was the expensive part of this and
adapters remove it entirely. **Migration becomes opt-in, per slot.**

### Storage

`hook` is appended at the tail. `occupancyPolicy` (slot 15) and `utility`
(slot 6) stay exactly where they are and stay readable — `utility()` and
`module()` in particular are load-bearing for adland, which resolves a slot's
creative through them and is embedded on sites that will never redeploy.

A slot with a `hook` set uses it. A slot without one falls back to the legacy
pair, so nothing needs migrating on any schedule but its own.

---

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

**Does the fallback stay forever?** Reading `hook`, then `occupancyPolicy`, then
`utility` is three reads and two eras. Simpler to keep it permanently than to
schedule a migration nobody is paid to do.

---

## Sequence

1. **Collapse the gallery** — pure deletion. Shrinks the pending beacon upgrade
   and means the merge later joins two single addresses rather than a tier and a
   list.
2. **`ISlotHook`, `SlotContext`, flags, the two adapters.** New surface; nothing
   existing breaks.
3. **`CompositeHook`** — the userland fan-out.
4. **SDK, indexer, explorer** — one address to show instead of three concepts.
5. **Docs** — the `before` decides / `after` records rule, stated once, near the
   interface.

Steps 1 and 2 are independent of each other and both are safe to land alone.

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
- **Does not touch `utility()` or `module()`.** Those selectors are permanent.
