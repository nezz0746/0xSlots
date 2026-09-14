# Slotmarket redesign — design

**Date:** 2026-09-13
**Scope:** `apps/market` only. No contract, SDK or indexer changes.

## Why

Three things at once, and they reinforce each other:

1. **Anvil is gone** (done, committed separately). The market only ever serves
   Base Sepolia and Base, so there is no longer a build where the default chain,
   the connector list and the indexer all differ from production.
2. **The chrome was deliberately colourless** so the works carried all the
   temperature. That premise dies here: the market gets its own voice — orange,
   loud, and with a hue per collection so the register reads as many things
   rather than one.
3. **The generated `Plate` art goes.** It was right when nothing could have art
   and wrong the moment something did. With art now *required* to open a
   collection, a placeholder that looks like a real work is a lie the register
   tells on its busiest page.

## Palette — "Carnival"

Brand orange leads. Each collection additionally carries a hue derived from its
address, used **only in chrome** — rails, figures, badges, hover — and never
behind or around a work, because the hues would otherwise compete with the art.
During creation there is no address yet, so the form wears the brand orange.

```
--color-brand:      #FF6B2C   /* fills, rules, display type. NEVER small text */
--color-brand-ink:  #C2410C   /* the same orange where it must be read as text */
--color-brand-wash: #FFF4EE   /* tinted ground behind brand blocks */
--color-ink:        #0E1116
--color-paper:      #FFFFFF   /* was #FBFBFC — the near-white was there to keep
                                 the chrome cool, which is no longer the goal */
--color-lift:       #F6F6F7
--color-dim:        #6B7280
--color-line:       #E3E5E8
```

### Contrast rules, and why they are rules

`#FF6B2C` on white is 2.9:1. It fails AA for text and always will, so:

- **Brand orange is a fill, a rule, or display type ≥24px. Never body text.**
  Where the orange must be read as text, use `--color-brand-ink` (6.4:1).
- **The primary button is ink-on-orange, not white-on-orange.** White on
  `#FF6B2C` is 2.9:1 and fails; `#0E1116` on `#FF6B2C` is ~7:1 and passes. It
  also happens to look better — black on hot orange is the poster move the rest
  of this direction is reaching for.

### Collection hues

Six, chosen to sit apart at thumbnail size and to stay legible as text:

```
#FF6B2C orange · #7C3AED violet · #0891B2 sky
#65A30D lime   · #E11D48 madder · #0D9488 teal
```

Picked by `parseInt(address.slice(2, 4), 16) % 6` — deterministic, so a
collection is the same colour on every device, the same property the deleted
`Plate` had and the only one worth keeping from it.

### The semantic colours, retuned

The app reserves colour for meaning and must keep doing so. One collision:
`--color-waning` was `#B54708`, a burnt orange, and a brand orange next to it
turns "time running out" into decoration.

```
--color-standing: #2B4ACB   unchanged — live figures
--color-ebbing:   #B42318   unchanged — critical
--color-waning:   #A16207   WAS #B54708. Amber-700: yellow-leaning, so it reads
                            as a different thing from the brand, and 5.3:1 on
                            white, so it stays legible as text (which is how
                            `TONE_TEXT` uses it)
--color-live:     #067647   unchanged — funded
```

Colour continues to be paired with a word ("left", "unheld"), never carrying
meaning alone.

## Removing the fake art

`src/components/plate.tsx` is deleted. Its three call sites each get a real
answer rather than a shared placeholder:

| Call site | Today | After |
|---|---|---|
| `CollectionStrip` (register) | `Plate` when metadata absent | real art; **skeleton** while in flight; **dashed frame** for an unminted place |
| `TokenGrid` → `Work` | `Plate` as `src` fallback | real art; skeleton in flight; neutral numbered frame if a legacy collection truly has none |
| `create/page.tsx` "On the shelf" | four `Plate`s seeded from the typed name | **deleted entirely** — step 1 shows the actual files |

The distinction the dashed frame carries is worth stating: *unminted* and
*loading* are different facts, and one placeholder for both is what made the
register unreadable while a collection was half-minted.

## The create flow — four steps

One submit at the end. Nothing costs gas before Review.

1. **The art** — drop zone, thumbnails, drag to reorder, remove
2. **Name it** — name, symbol
3. **Terms & payout** — rent, funded window, currency, recipient, manager
4. **Review** — the whole commitment, then the three-phase progress

### Supply is the file count

`maxSupply` stops being a field. The number of works *is* the number of places,
shown as a large orange figure that counts as files land. This removes an entire
error class (`tooMany` in `ArtChoice`) and makes art required — a collection
cannot be opened empty any more.

The consequence is deliberate and should be stated in the UI: **you cannot add
places later.** Twelve files is twelve places, for ever.

### Art is shown the moment it is picked

`URL.createObjectURL(file)` on selection, revoked on removal and on unmount.
This is separate from, and much earlier than, the IPFS upload — which still
happens after deploy, because the folder is named after the collection address.

### Step state lives in one reducer

`useCreateCollection` owns `{ step, files, name, symbol, terms, payout }` plus
`canAdvance(step)`. The page renders a step; it does not own the data. This is
the boundary that keeps a 400-line page from becoming an 800-line one.

## Animation — what each one is for

Motion shows a fact or it does not ship. Everything below already sits under the
global `prefers-reduced-motion` rule in `globals.css`.

| Motion | The fact it shows |
|---|---|
| Depletion rule, staggered (exists) | how much of a collection is gone |
| Thumbnails stagger in as files read | the run being built, one work at a time |
| "N places" counts up | the supply is *caused* by the files, not typed |
| Step slide, direction-aware | forward and back are different moves |
| Per-tile upload fill | which work is pinning right now — spatial, not a bar |
| Pulse on `ebbing` runway only | a slot about to be liquidatable |
| Hover lift on works (exists) | the work is takeable |

Nothing animates on the register except the depletion rule. A page of moving
bands is a page nobody can read a price on.

## Cursors

Custom cursors mark what a thing *does*, and every one falls back to a native
keyword after the comma so a browser that refuses the image still gets the
affordance.

```
works, collection bands   → orange arrow          (fallback: pointer)
unminted places           → orange plus           (fallback: pointer)
art thumbnails in step 1  → grab / grabbing       (native)
text inputs, prose        → native, untouched
```

SVG data-URIs at 24×24 with an explicit hotspot. Inputs and text keep native
cursors — a custom cursor over a text field is the kind of flourish that makes
an app feel broken rather than fun.

## Files

**Deleted:** `components/plate.tsx`

**New:** `lib/hue.ts` (collection hue), `lib/cursors.ts` (data-URI cursors),
`hooks/use-create-collection.ts` (step reducer), `hooks/use-object-urls.ts`,
`components/create/` (`step-rail`, `step-art`, `step-identity`, `step-terms`,
`step-review`, `art-drop`, `art-tile`), `components/art-frame.tsx` (the one
place that decides art / skeleton / empty-place)

**Rewritten:** `app/globals.css`, `app/create/page.tsx`, `app/page.tsx`,
`components/collection-strip.tsx`, `components/token-grid.tsx`,
`components/header.tsx`, `components/ui/button.tsx`

**Touched:** `app/c/[address]/page.tsx`, `lib/runway.ts` (the waning tone).
`components/art-choice.tsx` is **deleted** — its job splits between
`components/create/art-drop.tsx` and `components/create/step-art.tsx`.

## Testing

The app has no test runner today, and adding one is out of scope. Verification
is therefore explicit and manual-but-evidenced, through the Browser pane:

- register, collection page and all four create steps render with no console
  errors at 1280px and at 375px
- contrast: assert computed colours for the button, the waning tone and
  brand-as-text against their AA thresholds
- the art step: pick files → thumbnails appear → count matches → reorder → the
  numbers follow
- `pnpm typecheck` clean throughout

## Explicitly out of scope

Dark mode (the app is committed to light), a test runner, any change to the
upload pipeline or the three-transaction order, and the explorer app — which
still points at anvil and should keep doing so.
