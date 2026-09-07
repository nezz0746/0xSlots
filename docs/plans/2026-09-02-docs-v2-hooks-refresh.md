# Docs refresh: the single-hook (V2) model

## Why

The protocol was rearchitected. What the docs teach is now the *previous*
design, and the new one is simpler — which is exactly what the docs should be
able to show, and currently can't.

**The shift, in one line:** a slot used to have TWO pluggable things — a
*utility module* (`IUtility`, what holding grants) and an *occupancy policy*
(`IOccupancyPolicy`, who may hold) — and V2 collapses them into ONE:
`ISlotHook`. The `ISlotHook` source says it plainly:

> The previous design had exactly that split — nine fields for a policy, three
> loose arguments for a module — and it meant learning two vocabularies to
> extend one slot.

The docs still teach both vocabularies, across `concepts/modules.mdx`,
`concepts/occupancy.mdx`, `reference/modules.mdx` and `reference/policies.mdx`.

## What V2 actually is (the anchors to write from)

Read from `apps/contracts/src/`, not memory:

- **`ISlotHook.sol`** — one interface. `SlotContext` is one struct for all
  eight callbacks. `before*` are `view` and **veto** by reverting;
  `after*` are gas-capped, their revert **swallowed**, and cannot change the
  outcome (so they can never block a liquidation). `HookFlags` declares which
  callbacks a hook wants and is **snapshotted at attach**, never re-read.
- **One hook per slot.** Many behaviours = point at a **`CompositeHook`**
  (`src/hooks/CompositeHook.sol`) that fans out. The core makes ONE capped call;
  the composite's own cap bounds the whole subtree. *(This is also the real
  answer to the earlier "can we combine policies?" — yes, now natively.)*
- **`IDescribedHook.sol`** — optional, client-only discovery. `HookDescriptor`
  carries `family` / `version` / `data` / `metadataURI`. `Slot` **must never**
  call `descriptors()` (untrusted, unbounded); the human label lives here, off
  the safety path. `metadataURI` moved HERE — it is no longer a getter on the
  utility/policy.
- **Orders are core now.** `beforeSell` / `afterSell` exist as first-class
  verbs, backed by `SlotOrders.sol` (standing offers / sell-into). In v1 this
  was periphery.
- **v1 is legacy.** It lives under `src/v1/`, and the SDK dropped the V1 surface
  (`e618c2d`). The explorer moved onto V2 (`9be4d2f`).

## The plan, page by page

### Concepts — collapse two pages into one

The core reframing. Two concept pages become one.

- **New `concepts/hooks.mdx`** — the single mental model:
  - A slot is a bare position; a **hook** is the one way to extend it.
  - `before` decides and may refuse; `after` records and cannot. Everything
    else (view vs capped, veto vs swallow, why liquidation can't be blocked)
    follows from that one rule — lift the framing straight from the `ISlotHook`
    doc comment, it is already this crisp.
  - `HookFlags`: a hook declares its reach up front, and it's frozen.
  - Composition: one hook per slot, `CompositeHook` for many.
  - Discovery: `IDescribedHook` is what a UI reads, and it may lie — authority
    is the flags, not the label.
- **Retire `concepts/modules.mdx`** ("Utility modules") — its content (what
  holding grants, the hooks table, fees) folds into the new page. Keep the good
  line "the slot is the plot, the module is the crop", recast for hooks.
- **Retire `concepts/occupancy.mdx`** — the veto model it describes IS the
  `before*` half of a hook, so it merges in cleanly. Carry over the tenure /
  price / queue examples as "hooks you can attach" — **but** verify each against
  `src/hooks/`: `MinimumTenureHook` exists; **QueuePriority does not** — the
  current page lists it as available and it must be marked planned or dropped.

### Reference — one hook reference, not two

- **New `reference/hooks.mdx`** — `ISlotHook` (the eight callbacks + which are
  view/capped), `SlotContext` field-by-field (note the zero-when-not-meaningful
  rule), `HookFlags`, `IDescribedHook` / `HookDescriptor`. Replaces
  `reference/modules.mdx` and `reference/policies.mdx`.
- **`reference/slot.mdx`** — audit against the split `Slot*.sol` files
  (`SlotHooks`, `SlotOccupancy`, `SlotOrders`, `SlotAccounting`, …). Confirm the
  buy/sell/self-assess/liquidate flows name the new hook callbacks, and that the
  "settles before anything else, nothing on a timer" framing still holds (it
  does — keep it).
- **`reference/factory.mdx`** — check for `attestedHooks` (the "and we vouch for
  it" layer over self-reported descriptors) and the V2 create surface.

### SDK / indexer — verify against the V2 surface

Lower risk (these were touched during the ponder move) but need a pass:

- `sdk/client.mdx`, `sdk/react.mdx` — the V1 surface is gone; make sure no
  `module`/`policy`-era method or arg remains, and that the `{ items,
  totalCount, pageInfo }` shape and single-`chainId` filter are current.
- `indexer.mdx` — the `module.metadataURI` field framing is stale; describe how
  hooks/descriptors are indexed in V2 instead (verify against the ponder schema
  on `develop`).

### Orders / sell — new material

- A short section (its own page, or within `concepts/slots.mdx`): buying is not
  the only way a slot changes hands — an occupant can **sell into a standing
  offer**, gated by `beforeSell`. Ground it in `SlotOrders.sol`.

### Top-level

- `overview.mdx`, `index.mdx`, `getting-started.mdx`: wherever they say a slot
  has "a module and a policy", make it "a hook". `getting-started` likely shows
  attaching one — update to the V2 create + hook address path.
- `deployments.mdx`: add a note that `src/v1` addresses are the legacy surface.

## Sequencing

1. Concepts first (`hooks.mdx`), because every reference and example points back
   to that one mental model. Land it, then retire modules/occupancy.
2. Reference next (`hooks.mdx`), one PR, deleting the two old pages in the same
   change so search never returns a stale interface.
3. SDK/indexer verification pass.
4. Orders + top-level cleanup.
5. Update the docs nav/sidebar config to match (fewer, clearer entries).

## Watch out for

- **Don't document QueuePriority as real** until it exists in `src/hooks/`.
- **`metadataURI` is on `HookDescriptor` now**, not on a utility/policy getter —
  every mention of `moduleURI`/`policyURI` should become the descriptor story.
- The reward/leaderboard program was **removed** (`3c612de`) — no docs for it.
- Keep the audit in mind: `docs/plans/2026-08-29-slot-security-audit.md` may
  have framing (fail-closed, liquidation unconditional) worth quoting verbatim.
