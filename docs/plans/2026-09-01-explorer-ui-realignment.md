# Explorer UI realignment

The contracts moved a long way in one pass: signed sell orders, a wired module
gallery, retired bounties, retired module fees, retired `proposeUtilityUpdate`.
The explorer has not moved at all, so **it is currently broken against them**.

This is the plan to fix it, ending with a local stack that exercises every new
path.

Status: **plan only. No UI code written yet.**

---

## What actually changed underneath

| Contract change | Explorer consequence |
|---|---|
| `sell(buyer,price,deposit)` → `sell(order,signature)` | sell + offer flows fail at encode time |
| `OfferBook.offer` gained `nonce`, `signature` | offer flow fails at encode time |
| `bestOrder()` / `orderOf()` are new | the occupant has no way to fetch what to submit |
| `cancelSellOrder(nonce)` is new | a bidder cannot withdraw a signature |
| Module gallery wired (`addModule` / `removeModule` / `modules`) | live feature, zero UI |
| `proposeUtilityUpdate` retired | "propose utility" button calls a function that no longer exists |
| Liquidation bounties retired | four screens advertise a bounty that is always 0 |
| Module fees retired | `ModuleFeePaid` can never fire |
| `MAX_PRICE` / `MAX_TAX_BPS` introduced | no client validation; users meet a revert instead of a form error |

---

## Phase 0 — Regenerate and re-point (blocks everything)

Nothing below compiles until this lands.

1. **Regenerate ABIs** into `packages/contracts/src/abis/` — `slot.ts`,
   `offerBook.ts`, `slotFactory.ts`. Current drift: 3 functions removed, 16
   added. Rebuild `@0xslots/contracts`.

2. **SDK signature fixes** — `packages/sdk/src/client.ts`:
   - `offer(slot, price, deposit, expiry)` → must take `nonce` + `signature`
   - `sell(slot, buyer, price, deposit)` → must take `(order, signature)`
   - Add `sellOrderNonce`, `sellOrderHash`, `cancelSellOrder`
   - Delete `proposeUtilityUpdate` / `proposeModuleUpdate`; add
     `addModule` / `removeModule` / `modules`
   - `setLiquidationBounty` — delete (the contract reverts now)

3. **`packages/sdk/src/client.test.ts`** — 5 call sites on old signatures.

4. **`useSlotAction`** — mirror the above; drop the `proposeUtilityUpdate` and
   `setLiquidationBounty` wrappers.

**Gate:** `pnpm build` across `packages/contracts` and `packages/sdk`, plus the
SDK vitest suite.

---

## Phase 1 — The signing flow

The one genuinely new interaction. Everything else is deletion or plumbing.

**New hook: `useSellOrder()`** — owns EIP-712 signing so no component
reimplements the domain.

```ts
domain = {
  name: "0xSlots",
  version: "1",
  chainId,
  verifyingContract: slotAddress,   // NOT the book — each slot is its own domain
}
types.SellOrder = [slot, buyer, price, deposit, nonce, deadline]
```

Reads `slot.sellOrderNonce(bidder)` first, signs with `useSignTypedData`.

**`buy-section.tsx` → `handleOffer`** becomes:
`ensureAllowance → sign (free) → book.offer(..., nonce, signature)`

The UI must say **signing is free and instant**, or it reads as a second
transaction and people abandon. Copy: *"Sign to confirm your terms — free, no
gas."*

**`offer-book.tsx` → `sellIntoBest`** becomes:
`book.bestOrder(slot) → slot.sell(order, signature)` — still one transaction for
the occupant.

**New: cancel.** A bidder needs `cancelSellOrder(nonce)` to withdraw a
signature. Surface it next to their own standing offer, alongside the existing
`book.cancel`. They are different: `cancel` takes the offer off this board,
`cancelSellOrder` kills the signature everywhere it was ever published.

**Simplify:** delete both `retireOffer` calls (`buy-section.tsx:253`,
`offer-book.tsx:136`). The slot burns the nonce on fill, so a consumed order
dies on its own — `_live` reads `sellOrderUsed`. That removes a transaction from
the sell flow. Decide whether `OfferBook.retire()` goes with them.

---

## Phase 2 — Module gallery UI

The part with no equivalent today. A slot can now hold up to 8 modules; the
explorer shows one field and offers a button that calls a retired function.

**Read surface** — a "Modules" panel on the slot page:
- `modules()` — the effective list, head first
- `galleryModules()` / `pendingModules()` — installed vs queued
- `moduleData(m).installedAt`
- Resolve each address to `name()` / `version()` via `IModuleMetadata`, reusing
  the probe in `use-module-check.ts`

**Write surface** — manager only:
- `addModule(m)` — must show it is **queued, not live**: it lands on the next
  occupancy transition. A queued module that looks installed is the single
  most misleading thing this panel could do.
- `removeModule(m)` — **immediate**, and the copy should say so. Passing the
  head vacates it, and that is one-way: the head can never be refilled.
- Gate on `mutableUtility`; surface `MAX_MODULES` (8) and the current count.
- Only offer modules the factory has verified — `addModule` reverts otherwise.

**Rip out** the "propose utility" flow at `slot-page-content.tsx:826` and the
`hasPendingUtility` branch in `pending-updates.tsx:71`. Keep displaying
`utility` as the head — it is still the head, and adland reads it — but it can
no longer be *set*.

---

## Phase 3 — Delete what now lies

`liquidationBountyBps` is normalised to 0 on every slot, so each of these states
a falsehood:

- `slot-page-content.tsx:467` — "Liquidation bounty" stat row
- Create form — `liquidationBountyPercent` across `schema.ts`, `page.tsx:221`,
  `sections.ts:73` ("Permissions & bounty"), `summary-card.tsx:186`,
  `mobile-bottom-bar.tsx:253`
- `use-collectives.ts:117` — role copy naming the bounty
- `occupancy-badge.tsx:39` — "the bounty — no policy can prevent it"
- `badge.tsx:33` — `LiquidationBountyUpdated` badge, an event that cannot fire

**Replace, do not just delete.** Liquidation still matters; the incentive
changed. The honest line is *"anyone may evict an insolvent occupant, and the
slot becomes claimable"* — because `liquidate()` leaves it vacant, and the
taker's reward is the slot itself.

Indexer: `packages/ponder/src/slot.ts:782` handles `ModuleFeePaid` (dead) and
`:261` indexes `Liquidated.bounty` (always 0). Leave the handlers so historical
data still decodes; stop surfacing them.

---

## Phase 4 — Validation the contracts now expect

The create form has no price or tax ceiling (`schema.ts:62`), and neither do the
buy / self-assess inputs. Users now hit an on-chain `InvalidPrice` where a form
error belongs.

Read the bounds from the chain rather than hardcoding — `maxPrice()`,
`maxTaxBps()` are public for exactly this. A hardcoded constant is how
`IUTILITY_INTERFACE_ID` silently rotted before.

---

## Phase 5 — Local stack

`SeedLocal` already installs `MetadataModule` as the head on one slot
(`_init(400, address(metadata), 2 days)`). It needs to exercise the new paths so
the UI can be developed against real state:

1. **Verify a second module** on the factory, then `addModule` it on a slot —
   leaving it **queued** so the pending state is visible.
2. Drive one occupancy transition on another slot so a module is **installed and
   notified** — the two states must be distinguishable in the UI.
3. Seed offers with real signatures (already done — `_offer` signs) and leave one
   **already filled** so the board shows a consumed order correctly disappearing.
4. Seed one slot with a **frozen** `mutableUtility` so the disabled state is
   reachable.

`pnpm reset:local` must produce all of it in one shot. That is the gate for this
phase: every screen below has live data behind it without hand-crafting state.

---

## Order and gates

| Phase | Gate |
|---|---|
| 0 · ABIs + SDK | packages build; SDK vitest green |
| 1 · Signing | offer → sign → post, and sell, both work on anvil |
| 2 · Modules | queued vs installed visibly distinct; add/remove work |
| 3 · Deletions | no screen mentions a bounty or module fee |
| 4 · Validation | over-max price rejected in the form, never on-chain |
| 5 · Seed | `reset:local` alone reaches every state above |

Phase 0 blocks everything. Phases 3 and 4 are independent of 1 and 2 and can go
in parallel or first — they are the lowest-risk and remove the most confusion.

---

## Deliberately out of scope

- **adland** — its two read paths (`module()`, `utility` via multicall) are
  untouched by all of this. Its `use-collective-earnings` reads `feeBps()`,
  which now always returns 0 and always did on live modules, so its arithmetic
  is unchanged.
- **`IUtility` shrink.** `feeBps`/`feeRecipient` are dead to the core but still
  on the interface. Removing them changes `type(IUtility).interfaceId`, which
  means recomputing `IUTILITY_INTERFACE_ID` in `use-module-check.ts` **in the
  same change** — that constant has rotted once already. Worth doing, not here.
