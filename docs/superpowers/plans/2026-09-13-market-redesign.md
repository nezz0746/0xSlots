# Slotmarket Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `apps/market` its own loud, orange-forward voice; replace the generated placeholder art with real art everywhere; and turn the create form into a four-step flow whose collection size is the number of files you dropped in.

**Architecture:** Tailwind v4 `@theme` tokens carry the whole palette, so shadcn primitives inherit it unmodified — `--primary: brand` + `--primary-foreground: ink` is what makes every button ink-on-orange without touching `Button`. The create form's state moves out of the page into one reducer hook, and the page becomes four dumb step components. One `ArtFrame` component becomes the single place that decides art / skeleton / unminted-place, which is what lets `plate.tsx` be deleted outright.

**Tech Stack:** Next.js 16 (Turbopack, App Router), React 19, Tailwind CSS v4, shadcn/radix-ui, wagmi v3, viem.

**Spec:** `docs/superpowers/specs/2026-09-13-market-redesign-design.md`

## Global Constraints

- **`apps/market` only.** No contract, SDK, indexer, or explorer changes.
- **Brand orange `#FF6B2C` is a fill, a rule, or display type ≥24px — never body text.** Where it must read as text use `--color-brand-ink` `#C2410C`.
- **Primary buttons are ink-on-orange** (`#0E1116` on `#FF6B2C`, ~7:1). White on brand orange is 2.9:1 and fails AA.
- **Collection hues are chrome only** — rails, figures, badges, hover. Never behind or around a work.
- **Colour never carries meaning alone.** Every semantic colour stays paired with a word.
- **Vocabulary:** never "ad" or "advertiser" — say *sponsor*. Never "Harberger" — say *common ownership*.
- **No capability-list copy** ("can do X", "may do Y"). Show state visually.
- **Every custom cursor ends with a native fallback keyword** after the comma.
- **Commits are held.** The user has not asked for commits; each task ends at a verified checkpoint, and committing happens only when they ask.
- **Next.js 16 has breaking changes from training data.** Before writing routing/form code, read the relevant guide under `apps/market/node_modules/next/dist/docs/`.

**Verification vocabulary used below** (no test runner exists in this app):
- `TYPECHECK` = `pnpm --filter market typecheck` → expect no output
- `RENDER` = Browser pane at `http://localhost:3400`, `read_console_messages onlyErrors:true` → expect none
- `CONTRAST` = `javascript_tool` assertion against a computed colour

---

### Task 1: The palette, the hue, and the cursors

**Files:**
- Modify: `apps/market/src/app/globals.css`
- Create: `apps/market/src/lib/hue.ts`
- Create: `apps/market/src/lib/cursors.ts`
- Modify: `apps/market/src/lib/runway.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `hueFor(address: string): Hue` where `Hue = { name: string; ink: string; wash: string; rule: string }`; `CURSOR: { take: string; mint: string; grab: string; grabbing: string }`; Tailwind utilities `bg-brand`, `text-brand-ink`, `bg-brand-wash`, `animate-rise`, `animate-throb`, `animate-slide-in-left`, `animate-slide-in-right`

- [ ] **Step 1: Replace the palette block in `globals.css`**

Swap the `@theme` colour block and the `:root` shadcn mapping. The comment above it currently argues for a cool near-white ground — rewrite it, don't leave it contradicting the code.

```css
@theme {
  --font-sans: var(--font-inter-tight), ui-sans-serif, system-ui, sans-serif;

  /* The market's own voice. Orange leads; each collection adds a hue of its
     own in the chrome, so the register reads as many things rather than one. */
  --color-brand: #ff6b2c;
  /* The same orange where it has to be READ. #ff6b2c on white is 2.9:1 and
     fails AA at any body size, so it is a fill and this is its text form. */
  --color-brand-ink: #c2410c;
  --color-brand-wash: #fff4ee;

  --color-paper: #ffffff;
  --color-lift: #f6f6f7;
  --color-ink: #0e1116;
  --color-dim: #6b7280;
  --color-line: #e3e5e8;

  /* Live figures — a price, a valuation, anything standing. */
  --color-standing: #2b4acb;
  /* Time-critical only. Never decoration. */
  --color-ebbing: #b42318;
  /* Short, not gone. WAS #b54708, a burnt orange — which a brand orange beside
     it turned into decoration. Amber-700 leans yellow, so it reads as a
     different thing, and holds 5.3:1 on white, which it must: TONE_TEXT uses
     it as text. */
  --color-waning: #a16207;
  /* Funded, and staying that way. Only ever paired with a word. */
  --color-live: #067647;

  --animate-deplete: deplete 1.1s cubic-bezier(0.16, 1, 0.3, 1) both;
  --animate-rise: rise 0.42s cubic-bezier(0.16, 1, 0.3, 1) both;
  --animate-slide-in-right: slide-in-right 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
  --animate-slide-in-left: slide-in-left 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
  --animate-throb: throb 1.8s ease-in-out infinite;

  @keyframes deplete { from { transform: scaleX(0); } to { transform: scaleX(1); } }
  @keyframes rise {
    from { opacity: 0; transform: translateY(9px) scale(0.97); }
    to { opacity: 1; transform: none; }
  }
  @keyframes slide-in-right {
    from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: none; }
  }
  @keyframes slide-in-left {
    from { opacity: 0; transform: translateX(-16px); } to { opacity: 1; transform: none; }
  }
  @keyframes throb { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
}
```

- [ ] **Step 2: Point the shadcn layer at the brand**

In the same file's `:root`, change exactly these three. Everything else stays.

```css
  --primary: var(--color-brand);
  /* Ink on orange, not paper on orange: white on #ff6b2c is 2.9:1. This one
     line is what makes every unmodified shadcn Button legible. */
  --primary-foreground: var(--color-ink);
  --ring: var(--color-brand);
```

- [ ] **Step 3: Create `lib/hue.ts`**

```ts
/**
 * A collection's own colour.
 *
 * Chrome only — rails, figures, badges, hover. Never behind or around a work:
 * six saturated hues competing with the art is the exact failure the generated
 * plates were deleted for.
 *
 * Taken from the address rather than a stored field, so a collection is the
 * same colour on every device and in every session with nothing to migrate.
 * That determinism is the one property worth keeping from `Plate`.
 */
export type Hue = { name: string; ink: string; wash: string; rule: string };

const HUES: Hue[] = [
  { name: "orange", ink: "#c2410c", wash: "#fff4ee", rule: "#ff6b2c" },
  { name: "violet", ink: "#6d28d9", wash: "#f6f2ff", rule: "#7c3aed" },
  { name: "sky", ink: "#0e7490", wash: "#effafd", rule: "#0891b2" },
  { name: "lime", ink: "#4d7c0f", wash: "#f4fbe8", rule: "#65a30d" },
  { name: "madder", ink: "#be123c", wash: "#fff1f4", rule: "#e11d48" },
  { name: "teal", ink: "#0f766e", wash: "#effcfa", rule: "#0d9488" },
];

/** `ink` is text-safe on white; `rule` is fills and rules only. */
export function hueFor(address: string): Hue {
  const byte = Number.parseInt(address.slice(2, 4), 16);
  return HUES[(Number.isNaN(byte) ? 0 : byte) % HUES.length] as Hue;
}
```

- [ ] **Step 4: Create `lib/cursors.ts`**

```ts
/**
 * Cursors that say what a thing does.
 *
 * Built here rather than in CSS so the SVG can be written readably and encoded
 * once — a hand-escaped data URI in a stylesheet is a class of bug nobody
 * finds, because a malformed one silently falls back and looks fine.
 *
 * Every value ends in a native keyword. A browser that refuses the image still
 * gets the affordance, and text and inputs are left alone entirely: a custom
 * cursor over a text field reads as broken, not as fun.
 */
function cursor(svg: string, x: number, y: number, fallback: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg.trim())}") ${x} ${y}, ${fallback}`;
}

const ARROW = `
<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26">
  <path d="M4 2.5 L19.5 12 L12.6 13.6 L9.2 20.2 Z"
        fill="#ff6b2c" stroke="#0e1116" stroke-width="1.5" stroke-linejoin="round"/>
</svg>`;

const PLUS = `
<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26">
  <circle cx="13" cy="13" r="10" fill="#ff6b2c" stroke="#0e1116" stroke-width="1.5"/>
  <path d="M13 8.5v9M8.5 13h9" stroke="#0e1116" stroke-width="2" stroke-linecap="round"/>
</svg>`;

export const CURSOR = {
  /** A work or a band you can open. */
  take: cursor(ARROW, 4, 2, "pointer"),
  /** A place in the run nobody has taken. */
  mint: cursor(PLUS, 13, 13, "pointer"),
  /** Art tiles in the create form. Native — the OS ones are better here. */
  grab: "grab",
  grabbing: "grabbing",
} as const;
```

- [ ] **Step 5: Check `lib/runway.ts` still reads true**

Read it. `TONE_TEXT` maps tones to `text-waning` / `text-ebbing` / `text-live` class names; the token change in Step 1 is enough and no edit is needed. If any hex is hardcoded there instead of a token, replace it with the token class.

- [ ] **Step 6: Verify**

`TYPECHECK`. Then `RENDER` and assert the tokens actually landed:

```js
const s = getComputedStyle(document.documentElement);
({ brand: s.getPropertyValue('--color-brand'), waning: s.getPropertyValue('--color-waning'),
   primaryFg: s.getPropertyValue('--primary-foreground') })
```
Expected: `#ff6b2c`, `#a16207`, and `--primary-foreground` resolving to the ink token.

---

### Task 2: Buttons and header wearing the palette

**Files:**
- Modify: `apps/market/src/components/ui/button.tsx`
- Modify: `apps/market/src/components/header.tsx`

**Interfaces:**
- Consumes: Task 1's tokens
- Produces: `Button` variant `brand` (bold ink-on-orange); a header whose wordmark carries the brand

- [ ] **Step 1: Read the current Button**

Run `cat apps/market/src/components/ui/button.tsx`. It is shadcn's cva-based button. The `default` variant already resolves to `bg-primary text-primary-foreground`, which Task 1 made ink-on-orange — so the work here is weight and motion, not colour.

- [ ] **Step 2: Make the default variant carry weight**

In the `default` variant string, add `font-semibold` and a press response. Keep `bg-primary text-primary-foreground` — do not hardcode the hex.

```
default:
  "bg-primary text-primary-foreground font-semibold shadow-none " +
  "transition-transform active:translate-y-px hover:brightness-105",
```

- [ ] **Step 3: Header — brand the wordmark and mark the active link**

In `header.tsx`, the `Slotmarket` link becomes the one place the brand orange is display-sized. Replace the wordmark `Link`:

```tsx
<Link href="/" className="group text-[15px] font-semibold tracking-[-0.02em]">
  Slot<span className="text-brand-ink">market</span>
</Link>
```

And give the nav links a brand underline on hover, replacing the `hover:text-foreground` on each:

```tsx
className="relative text-muted-foreground transition-colors hover:text-foreground
           after:absolute after:-bottom-1 after:left-0 after:h-[2px] after:w-0
           after:bg-brand after:transition-[width] hover:after:w-full"
```

- [ ] **Step 4: Verify**

`TYPECHECK`, `RENDER`, then `CONTRAST` on the Connect button:

```js
const b = [...document.querySelectorAll('button')].find(e => /Connect/.test(e.textContent));
getComputedStyle(b).backgroundColor + ' / ' + getComputedStyle(b).color
```
Expected: `rgb(255, 107, 44)` on `rgb(14, 17, 22)` — orange fill, ink text.

---

### Task 3: Delete the fake art

**Files:**
- Delete: `apps/market/src/components/plate.tsx`
- Create: `apps/market/src/components/art-frame.tsx`
- Modify: `apps/market/src/components/collection-strip.tsx`
- Modify: `apps/market/src/components/token-grid.tsx`

**Interfaces:**
- Consumes: Task 1's `CURSOR`
- Produces: `<ArtFrame src?: string; alt?: string; state: "art" | "loading" | "place"; tokenId?: number />`

- [ ] **Step 1: Create `art-frame.tsx` — the one place that decides**

```tsx
"use client";

/**
 * A square in the hang, in one of three states.
 *
 * There used to be a fourth thing here — a generated plate, drawn from the
 * slot address whenever art was missing. It was right when nothing could have
 * art and wrong the moment something did: it looked like a real work, so a
 * collection still loading and a collection with nothing in it were the same
 * picture, and so were an unminted place and a minted one whose metadata had
 * not arrived.
 *
 * Those are three different facts and they now look different. `loading` is
 * obviously temporary, `place` is obviously empty and obviously clickable, and
 * only real art ever looks like art.
 */
export function ArtFrame({
  src,
  alt,
  state,
  tokenId,
}: {
  src?: string;
  alt?: string;
  state: "art" | "loading" | "place";
  tokenId?: number;
}) {
  if (state === "art" && src)
    // biome-ignore lint/performance/noImgElement: an arbitrary IPFS host is
    // not a domain `next/image` can be configured for ahead of time.
    return (
      <img
        src={src}
        alt={alt ?? ""}
        loading="lazy"
        className="size-full animate-rise bg-lift object-contain"
      />
    );

  if (state === "loading")
    return <div className="size-full animate-pulse bg-lift" aria-hidden />;

  return (
    <div className="grid size-full place-items-center border border-dashed border-line transition-colors group-hover:border-brand">
      {tokenId !== undefined && (
        <span className="tabular text-[11px] text-dim transition-colors group-hover:text-brand-ink">
          {tokenId}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Delete the plate**

```bash
rm apps/market/src/components/plate.tsx
```

- [ ] **Step 3: Rewrite `CollectionStrip`'s `Tile`**

Replace the `Plate` import with `ArtFrame`, and replace the whole `Tile` body:

```tsx
function Tile({ collection, tokenId }: { collection: IndexedCollection; tokenId: number }) {
  const { data: art, isLoading } = useTokenArt(collection.baseURI, String(tokenId));
  return (
    <ArtFrame
      src={art?.image}
      state={art?.image ? "art" : isLoading ? "loading" : "place"}
    />
  );
}
```

Also delete the `Plate` import line at the top of the file.

- [ ] **Step 4: Rewrite `TokenGrid`'s `Work` tile and `Place`**

In `Work`, replace the `<Plate .../>` block with:

```tsx
<ArtFrame
  src={art?.image}
  alt={art?.name ?? `Work ${token.tokenId}`}
  state={art?.image ? "art" : "loading"}
/>
```

In `Place`, replace the bare `<div className="aspect-square border border-dashed …" />` with `<ArtFrame state="place" tokenId={tokenId} />` inside an `aspect-square` wrapper, and put the mint cursor on the button:

```tsx
<button type="button" onClick={onMint} style={{ cursor: CURSOR.mint }}
        className="group block w-full text-left">
  <div className="aspect-square"><ArtFrame state="place" tokenId={tokenId} /></div>
```

Put `style={{ cursor: CURSOR.take }}` on `Work`'s button, and swap its `outline-ink` selected ring for `outline-brand`.

- [ ] **Step 5: Verify no references survive**

```bash
grep -rn "Plate\|plate" apps/market/src/ || echo "✓ gone"
```
Expected: only prose mentions in comments explaining the removal, or nothing.

- [ ] **Step 6: Verify**

`TYPECHECK`, `RENDER`, and screenshot the register — the NEZZAR collection should show its one real work plus five dashed places, with no generated art anywhere.

---

### Task 4: The register

**Files:**
- Modify: `apps/market/src/app/page.tsx`

**Interfaces:**
- Consumes: `hueFor`, `CURSOR`, `ArtFrame`
- Produces: nothing downstream

- [ ] **Step 1: Give each band its hue**

In `Band`, derive the hue and use it for the left rule, the wash on hover, the held figure, and the depletion bar. Import `hueFor` and `CURSOR`.

```tsx
const hue = hueFor(collection.id);
```

Replace the `<Link>`'s className and add the style:

```tsx
<Link
  href={`/c/${collection.id}`}
  style={{ cursor: CURSOR.take, borderLeftColor: hue.rule }}
  className="group block border-l-4 px-4 py-6 transition-colors hover:bg-[var(--wash)]"
  // biome-ignore lint/style/useNamingConvention: CSS custom property
  {...{ style: { cursor: CURSOR.take, borderLeftColor: hue.rule, ["--wash" as string]: hue.wash } }}
>
```

Note: set `--wash` and `borderLeftColor` in the single `style` object — do not write `style` twice.

- [ ] **Step 2: Colour the held figure and the depletion rule**

The `Held` figure's `text-standing` becomes the collection's own ink:

```tsx
<Figure label="Held">
  <span style={{ color: hue.ink }}>{minted}</span>
  <span className="text-dim"> / {max}</span>
</Figure>
```

And the depletion bar's `bg-ink` becomes the hue's rule:

```tsx
<div
  className="h-[3px] origin-left animate-deplete"
  style={{ width: `${taken * 100}%`, background: hue.rule,
           animationDelay: `${Math.min(index, 8) * 70}ms` }}
/>
```

- [ ] **Step 3: Make the page header carry the brand**

Replace the `h1` with the orange-block treatment — display sized, so the brand orange is legal here:

```tsx
<h1 className="text-[26px] font-extrabold leading-[1.1] tracking-[-0.035em] sm:text-[32px]">
  Nothing here is{" "}
  <span className="bg-brand px-2 text-ink">off the market.</span>
</h1>
```

- [ ] **Step 4: Verify**

`TYPECHECK`, `RENDER`, screenshot. Expect: a coloured left rule per band, no two adjacent bands guaranteed different (that is fine — the hue is per address, not per position), the depletion rule animating once on load.

---

### Task 5: The collection page

**Files:**
- Modify: `apps/market/src/app/c/[address]/page.tsx`

**Interfaces:**
- Consumes: `hueFor`
- Produces: nothing downstream

- [ ] **Step 1: Wear the collection's hue in the header**

```tsx
const hue = hueFor(collection);
```

Give the `<header>` a left rule and the `Held` fact the hue's ink:

```tsx
<header className="border-b border-line pb-8 pt-14 sm:pt-20">
```
becomes
```tsx
<header style={{ borderLeftColor: hue.rule }}
        className="border-b border-l-4 border-line pb-8 pl-5 pt-14 sm:pt-20">
```

and in the `Held` fact, `<span className="text-standing">` becomes `<span style={{ color: hue.ink }}>`.

- [ ] **Step 2: Verify**

`TYPECHECK`, `RENDER` at `/c/<the NEZZAR address from the register>`, screenshot.

---

### Task 6: The create form's state

**Files:**
- Create: `apps/market/src/hooks/use-object-urls.ts`
- Create: `apps/market/src/hooks/use-create-collection.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `useObjectUrls(files: File[]): string[]`
  - `useCreateCollection(): { state: CreateState; dispatch: Dispatch<CreateAction>; canAdvance: boolean }`
  - `type CreateState = { step: 0|1|2|3; direction: 1|-1; files: File[]; name: string; symbol: string; taxPct: string; window: bigint; currency: string; customCurrency: string; recipient: string; manager: string }`
  - `type CreateAction = { type: "next" } | { type: "back" } | { type: "goto"; step: 0|1|2|3 } | { type: "files"; files: File[] } | { type: "reorder"; from: number; to: number } | { type: "remove"; index: number } | { type: "field"; key: FieldKey; value: string } | { type: "window"; seconds: bigint }`
  - `type FieldKey = "name" | "symbol" | "taxPct" | "currency" | "customCurrency" | "recipient" | "manager"`

- [ ] **Step 1: Create `use-object-urls.ts`**

```ts
"use client";

import { useEffect, useState } from "react";

/**
 * Previews for files that have not been uploaded to anything yet.
 *
 * The art is shown the moment it is picked, which is long before it reaches
 * IPFS — the folder is named after the collection address, and that does not
 * exist until the first transaction is mined. So the form reads the files
 * locally and the upload stays where it was.
 *
 * Revoked on every change and on unmount. Object URLs are held by the document
 * until they are released, so a creator who picks a hundred images, changes
 * their mind twice and leaves would otherwise pin all three hundred for the
 * lifetime of the tab.
 */
export function useObjectUrls(files: File[]): string[] {
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    const made = files.map((f) => URL.createObjectURL(f));
    setUrls(made);
    return () => {
      for (const url of made) URL.revokeObjectURL(url);
    };
  }, [files]);

  return urls;
}
```

- [ ] **Step 2: Create `use-create-collection.ts`**

```ts
"use client";

import { NATIVE_CURRENCY_ADDRESS } from "@0xslots/sdk";
import { type Dispatch, useMemo, useReducer } from "react";

export const STEPS = ["The art", "Name it", "Terms & payout", "Review"] as const;
export type Step = 0 | 1 | 2 | 3;
export type FieldKey =
  | "name" | "symbol" | "taxPct" | "currency" | "customCurrency" | "recipient" | "manager";

export type CreateState = {
  step: Step;
  /** Which way the last move went, so the step can slide in from the right side. */
  direction: 1 | -1;
  files: File[];
  name: string;
  symbol: string;
  taxPct: string;
  window: bigint;
  currency: string;
  customCurrency: string;
  recipient: string;
  manager: string;
};

export type CreateAction =
  | { type: "next" } | { type: "back" } | { type: "goto"; step: Step }
  | { type: "files"; files: File[] }
  | { type: "reorder"; from: number; to: number }
  | { type: "remove"; index: number }
  | { type: "field"; key: FieldKey; value: string }
  | { type: "window"; seconds: bigint };

const INITIAL: CreateState = {
  step: 0, direction: 1, files: [], name: "", symbol: "",
  taxPct: "10", window: 604_800n, currency: NATIVE_CURRENCY_ADDRESS,
  customCurrency: "", recipient: "", manager: "",
};

function reducer(state: CreateState, action: CreateAction): CreateState {
  switch (action.type) {
    case "next":
      return { ...state, step: Math.min(3, state.step + 1) as Step, direction: 1 };
    case "back":
      return { ...state, step: Math.max(0, state.step - 1) as Step, direction: -1 };
    case "goto":
      return { ...state, step: action.step, direction: action.step > state.step ? 1 : -1 };
    case "files":
      // Appended, not replaced. Picking a second batch is how somebody adds to
      // a run; replacing silently discarded the first one.
      return { ...state, files: [...state.files, ...action.files] };
    case "reorder": {
      const files = [...state.files];
      const [moved] = files.splice(action.from, 1);
      if (moved) files.splice(action.to, 0, moved);
      return { ...state, files };
    }
    case "remove":
      return { ...state, files: state.files.filter((_, i) => i !== action.index) };
    case "field":
      return { ...state, [action.key]: action.value };
    case "window":
      return { ...state, window: action.seconds };
  }
}

/**
 * Everything the create form knows, in one place.
 *
 * The page used to hold ten `useState`s and the submit logic together, which
 * is workable at one screen and not at four. The steps are presentational and
 * read from here; only the final submit talks to a chain.
 */
export function useCreateCollection(): {
  state: CreateState;
  dispatch: Dispatch<CreateAction>;
  canAdvance: boolean;
} {
  const [state, dispatch] = useReducer(reducer, INITIAL);

  const canAdvance = useMemo(() => {
    switch (state.step) {
      // The art IS the supply, so an empty run is not a collection.
      case 0: return state.files.length > 0;
      case 1: return state.name.trim().length > 0 && state.symbol.trim().length > 0;
      case 2: return Number(state.taxPct) >= 0;
      case 3: return true;
    }
  }, [state]);

  return { state, dispatch, canAdvance };
}
```

- [ ] **Step 3: Verify**

`TYPECHECK`. Nothing renders these yet, so typecheck is the whole gate.

---

### Task 7: The art step

**Files:**
- Create: `apps/market/src/components/create/step-rail.tsx`
- Create: `apps/market/src/components/create/art-tile.tsx`
- Create: `apps/market/src/components/create/step-art.tsx`

**Interfaces:**
- Consumes: `STEPS`, `Step`, `CreateState`, `CreateAction`, `useObjectUrls`, `CURSOR`
- Produces: `<StepRail current step onGoto />`, `<ArtTile url index onRemove onDragStart onDrop />`, `<StepArt state dispatch />`

- [ ] **Step 1: Create `step-rail.tsx`**

```tsx
"use client";

import { type Step, STEPS } from "@/hooks/use-create-collection";

/** Where you are, what is behind you, and what is left. */
export function StepRail({
  current,
  onGoto,
}: {
  current: Step;
  onGoto: (step: Step) => void;
}) {
  return (
    <ol className="flex border-b border-line bg-brand-wash">
      {STEPS.map((label, i) => {
        const done = i < current;
        const now = i === current;
        return (
          <li key={label} className="relative flex-1">
            <button
              type="button"
              // Only backwards. Jumping ahead past a step that gates the next
              // one is how you reach Review with no art in the run.
              disabled={!done}
              onClick={() => onGoto(i as Step)}
              className={`w-full px-3 py-3 text-left transition-colors sm:px-4 ${
                now ? "bg-paper" : ""
              } ${done ? "cursor-pointer hover:bg-paper" : "cursor-default"}`}
            >
              <span
                className={`block text-[10px] font-bold tracking-[0.14em] ${
                  done || now ? "text-brand-ink" : "text-dim/60"
                }`}
              >
                {String(i + 1).padStart(2, "0")}
                {done ? " ✓" : ""}
              </span>
              <span
                className={`mt-1.5 block text-[13px] font-semibold tracking-[-0.01em] ${
                  done || now ? "text-ink" : "text-dim"
                }`}
              >
                {label}
              </span>
            </button>
            {now && <span className="absolute inset-x-0 -bottom-px h-[3px] bg-brand" />}
          </li>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 2: Create `art-tile.tsx`**

```tsx
"use client";

import { CURSOR } from "@/lib/cursors";

/**
 * One work in the run, before it is one.
 *
 * The number is the token id it will mint as, shown on the tile rather than
 * beside it — the order IS the numbering, so dragging a tile has to visibly
 * change the number, or reordering looks like it did nothing.
 */
export function ArtTile({
  url,
  index,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  url: string;
  index: number;
  onRemove: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
}) {
  return (
    <li
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{ cursor: CURSOR.grab, animationDelay: `${Math.min(index, 20) * 28}ms` }}
      className="group relative aspect-square animate-rise overflow-hidden bg-lift active:[cursor:grabbing]"
    >
      {/* biome-ignore lint/performance/noImgElement: a local object URL. */}
      <img src={url} alt="" className="size-full object-cover" />
      <span className="absolute bottom-0 left-0 bg-ink px-1.5 py-1 text-[10px] font-semibold tabular text-paper">
        {String(index + 1).padStart(2, "0")}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove work ${index + 1}`}
        className="absolute right-1 top-1 grid size-6 place-items-center bg-ink/80 text-[13px] leading-none text-paper opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
      >
        ×
      </button>
    </li>
  );
}
```

- [ ] **Step 3: Create `step-art.tsx`**

```tsx
"use client";

import { type Dispatch, useRef, useState } from "react";

import { ArtTile } from "@/components/create/art-tile";
import type { CreateAction, CreateState } from "@/hooks/use-create-collection";
import { useObjectUrls } from "@/hooks/use-object-urls";

/**
 * The art, and therefore the size of the collection.
 *
 * There is no supply field. However many works are here is how many places
 * exist, which removes the mismatch the old form could produce — more files
 * than places, with the extras uploaded and unmintable — and makes the number
 * something you can see rather than something you typed.
 */
export function StepArt({
  state,
  dispatch,
}: {
  state: CreateState;
  dispatch: Dispatch<CreateAction>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const urls = useObjectUrls(state.files);
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState(false);

  return (
    <div>
      <h2 className="text-[26px] font-extrabold leading-[1.1] tracking-[-0.035em] sm:text-[30px]">
        Drop the work in.
      </h2>
      <p className="mt-2.5 max-w-[52ch] text-[14px] leading-relaxed text-dim">
        However many pieces you add is how big the collection is. Twelve works,
        twelve places — and the run is fixed once it opens.
      </p>

      <input
        ref={input}
        type="file"
        multiple
        accept="image/*,video/*"
        hidden
        onChange={(e) => {
          dispatch({ type: "files", files: Array.from(e.target.files ?? []) });
          e.target.value = "";
        }}
      />

      <ul className="mt-7 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        {urls.map((url, i) => (
          <ArtTile
            key={url}
            url={url}
            index={i}
            onRemove={() => dispatch({ type: "remove", index: i })}
            onDragStart={() => setDragging(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragging !== null) dispatch({ type: "reorder", from: dragging, to: i });
              setDragging(null);
            }}
          />
        ))}

        <li>
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              dispatch({ type: "files", files: Array.from(e.dataTransfer.files) });
            }}
            className={`grid aspect-square w-full place-items-center border-2 border-dashed text-[26px] font-bold transition-colors ${
              over ? "border-brand bg-brand-wash text-brand-ink" : "border-line text-dim hover:border-brand hover:text-brand-ink"
            }`}
          >
            +
          </button>
        </li>
      </ul>

      <Count n={state.files.length} />
    </div>
  );
}

/**
 * The supply, as a consequence.
 *
 * Keyed on the number so React remounts it on every change and the rise
 * animation replays — the point is that the figure MOVED when files landed,
 * which a silently-updating number does not communicate.
 */
function Count({ n }: { n: number }) {
  return (
    <div className="mt-5 flex items-center gap-4 border-l-4 border-brand bg-brand-wash px-4 py-3">
      <span key={n} className="animate-rise text-[30px] font-extrabold leading-none tracking-[-0.04em] text-brand-ink">
        {n}
      </span>
      <p className="text-[13px] leading-snug">
        <b>{n === 1 ? "place in this collection." : "places in this collection."}</b>
        <br />
        <span className="text-dim">
          Drag a tile to reorder — the first becomes No. 1. There is no way to add
          places later.
        </span>
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Verify**

`TYPECHECK`. Rendering waits for Task 9.

---

### Task 8: The remaining three steps

**Files:**
- Create: `apps/market/src/components/create/step-identity.tsx`
- Create: `apps/market/src/components/create/step-terms.tsx`
- Create: `apps/market/src/components/create/step-review.tsx`

**Interfaces:**
- Consumes: `CreateState`, `CreateAction`, `useObjectUrls`, `CurrencyChoice`, `TermsPreview`, `Input`, `Label`, `Select`
- Produces: `<StepIdentity state dispatch />`, `<StepTerms state dispatch chainId />`, `<StepReview state chainId busy />`

- [ ] **Step 1: Create `step-identity.tsx`**

Name and symbol only, with the same `Field` pattern the old form used (label as sibling, id minted with `useId`, hint beneath). Lift `Field` out of the old page into this file and export it so `step-terms` can import it.

```tsx
"use client";

import { cloneElement, isValidElement, type Dispatch, useId } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CreateAction, CreateState } from "@/hooks/use-create-collection";

export function StepIdentity({
  state, dispatch,
}: { state: CreateState; dispatch: Dispatch<CreateAction> }) {
  return (
    <div>
      <h2 className="text-[26px] font-extrabold leading-[1.1] tracking-[-0.035em] sm:text-[30px]">
        Give it a name.
      </h2>
      <p className="mt-2.5 max-w-[52ch] text-[14px] leading-relaxed text-dim">
        Both are permanent. The symbol is what wallets and explorers show.
      </p>
      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        <Field label="Name">
          <Input
            value={state.name}
            placeholder="Ferrous"
            onChange={(e) => dispatch({ type: "field", key: "name", value: e.target.value })}
          />
        </Field>
        <Field label="Symbol">
          <Input
            value={state.symbol}
            placeholder="FER"
            onChange={(e) =>
              dispatch({ type: "field", key: "symbol", value: e.target.value.toUpperCase() })}
          />
        </Field>
      </div>
    </div>
  );
}

/**
 * A control and what it decides.
 *
 * The label is a sibling rather than a wrapper — a Select trigger inside a
 * <label> swallows its own click — so the id is minted here and handed down.
 */
export function Field({
  label, hint, children,
}: {
  label: string;
  hint?: string;
  children: React.ReactElement<{ id?: string }>;
}) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {isValidElement(children) ? cloneElement(children, { id }) : children}
      {hint && <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Create `step-terms.tsx`**

The merged step: rent, funded window, currency, recipient, manager. Reuse `CurrencyChoice` and `TermsPreview` unchanged, and carry over the `WINDOWS` constant and `WindowSelect` from the old page verbatim. Keep the permanence warning that used to live in the aside — it belongs with the two fields it is about.

```tsx
"use client";

import { NATIVE_CURRENCY_ADDRESS } from "@0xslots/sdk";
import type { Dispatch } from "react";
import { useAccount } from "wagmi";

import { Field } from "@/components/create/step-identity";
import { CurrencyChoice } from "@/components/currency-choice";
import { TermsPreview } from "@/components/terms-preview";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { CreateAction, CreateState } from "@/hooks/use-create-collection";

/** Windows a collection realistically wants, rather than a seconds field. */
const WINDOWS = [
  { label: "1 day", seconds: 86_400n },
  { label: "7 days", seconds: 604_800n },
  { label: "30 days", seconds: 2_592_000n },
] as const;

export function StepTerms({
  state, dispatch, chainId,
}: { state: CreateState; dispatch: Dispatch<CreateAction>; chainId: number }) {
  const { address } = useAccount();
  const taxBps = BigInt(Math.round(Number(state.taxPct || "0") * 100));
  const chosen = state.currency === "custom" ? state.customCurrency : state.currency;

  return (
    <div>
      <h2 className="text-[26px] font-extrabold leading-[1.1] tracking-[-0.035em] sm:text-[30px]">
        Set the terms once.
      </h2>
      <p className="mt-2.5 max-w-[52ch] text-[14px] leading-relaxed text-dim">
        Everyone who mints chooses only what their work is worth to them — and
        holds it at that price until someone pays it.
      </p>

      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        <Field label="Rent" hint="% of the holder's valuation, per 30 days">
          <Input
            value={state.taxPct}
            inputMode="decimal"
            className="tabular"
            onChange={(e) => dispatch({ type: "field", key: "taxPct", value: e.target.value })}
          />
        </Field>
        <Field label="Funded window" hint="what a mint's escrow buys">
          <Select
            value={String(state.window)}
            onValueChange={(v) => dispatch({ type: "window", seconds: BigInt(v) })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {WINDOWS.map((w) => (
                <SelectItem key={w.label} value={String(w.seconds)}>{w.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="mt-5">
        <CurrencyChoice
          chainId={chainId}
          value={state.currency}
          onChange={(v) => dispatch({ type: "field", key: "currency", value: v })}
          custom={state.customCurrency}
          onCustom={(v) => dispatch({ type: "field", key: "customCurrency", value: v })}
        />
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        <Field label="Rent goes to" hint="for ever">
          <Input
            value={state.recipient}
            placeholder={address ?? "0x…"}
            onChange={(e) => dispatch({ type: "field", key: "recipient", value: e.target.value })}
          />
        </Field>
        <Field label="Manager" hint="may change the rent. Blank fixes it for ever">
          <Input
            value={state.manager}
            placeholder="blank"
            onChange={(e) => dispatch({ type: "field", key: "manager", value: e.target.value })}
          />
        </Field>
      </div>

      <p className="mt-5 border-l-4 border-ebbing bg-ebbing/5 px-4 py-3 text-[12.5px] leading-snug text-dim">
        The recipient and the manager are fixed on every slot this collection
        ever mints, and nothing changes either afterwards. Use addresses you
        will still control in a year.
      </p>

      <div className="mt-7">
        <TermsPreview
          taxBps={taxBps}
          minDepositSeconds={state.window}
          symbol={chosen === NATIVE_CURRENCY_ADDRESS ? "ETH" : ""}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `step-review.tsx`**

Shows the real thumbnails, the terms, the permanent facts, and the three-phase strip. `busy` is the phase string from the page's submit, or `null`.

```tsx
"use client";

import { NATIVE_CURRENCY_ADDRESS } from "@0xslots/sdk";
import { useAccount } from "wagmi";

import type { CreateState } from "@/hooks/use-create-collection";
import { useObjectUrls } from "@/hooks/use-object-urls";
import { rate } from "@/lib/format";

const PHASES = ["Deploy", "Upload the art", "Point it at them"] as const;

export function StepReview({
  state, busy,
}: { state: CreateState; busy: string | null }) {
  const { address } = useAccount();
  const urls = useObjectUrls(state.files);
  const taxBps = BigInt(Math.round(Number(state.taxPct || "0") * 100));
  const recipient = state.recipient || address || "—";

  return (
    <div>
      <h2 className="text-[26px] font-extrabold leading-[1.1] tracking-[-0.035em] sm:text-[30px]">
        This is what you&rsquo;re opening.
      </h2>
      <p className="mt-2.5 max-w-[52ch] text-[14px] leading-relaxed text-dim">
        Nothing has been spent yet. The button below is the first thing that costs gas.
      </p>

      <div className="mt-7 flex flex-wrap items-center gap-4">
        <div className="flex gap-1">
          {urls.slice(0, 5).map((url) => (
            // biome-ignore lint/performance/noImgElement: a local object URL.
            <img key={url} src={url} alt="" className="size-12 bg-lift object-cover" />
          ))}
        </div>
        <div>
          <p className="text-[20px] font-bold leading-none tracking-[-0.025em]">
            {state.name.trim() || "Untitled"}
          </p>
          <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-dim">
            {state.symbol.trim() || "———"} · {state.files.length}{" "}
            {state.files.length === 1 ? "place" : "places"}
          </p>
        </div>
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-4 border-t border-line pt-5 text-[13px] sm:grid-cols-4">
        <Fact label="Rent">{rate(taxBps)}</Fact>
        <Fact label="Funded window">{Number(state.window) / 86_400} days</Fact>
        <Fact label="Currency">
          {(state.currency === "custom" ? state.customCurrency : state.currency) ===
          NATIVE_CURRENCY_ADDRESS
            ? "ETH"
            : "token"}
        </Fact>
        <Fact label="Terms">{state.manager ? "rent can change" : "fixed for ever"}</Fact>
      </dl>

      <div className="mt-5 border border-brand/40 bg-brand-wash px-4 py-3 text-[12.5px] leading-snug">
        <span className="text-dim">Rent goes to</span>{" "}
        <b className="tabular">{recipient}</b>
        <br />
        <span className="text-dim">Manager</span>{" "}
        <b>{state.manager || "nobody — rent is fixed for ever"}</b>
      </div>

      <div className="mt-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dim">
          What happens when you press it
        </p>
        <ol className="mt-2.5 flex text-[12px]">
          {PHASES.map((phase, i) => {
            const active = busy !== null && busy.startsWith(phase.slice(0, 6));
            return (
              <li
                key={phase}
                className={`flex-1 px-3 py-2.5 transition-colors ${
                  active ? "bg-brand text-ink" : i === 0 ? "bg-brand-wash" : "bg-lift"
                }`}
              >
                <b>
                  {i + 1} · {phase}
                </b>
                <br />
                <span className="text-dim">
                  {i === 1 ? `${state.files.length} works to Économe` : "the wallet asks"}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] text-dim">{label}</dt>
      <dd className="mt-1 tabular">{children}</dd>
    </div>
  );
}
```

- [ ] **Step 4: Verify**

`TYPECHECK`.

---

### Task 9: Wire the create page

**Files:**
- Modify (rewrite): `apps/market/src/app/create/page.tsx`
- Delete: `apps/market/src/components/art-choice.tsx`

**Interfaces:**
- Consumes: everything from Tasks 6–8
- Produces: the working four-step route

- [ ] **Step 1: Rewrite `create/page.tsx`**

Keep the existing `create()` submit logic **verbatim** — the deploy → upload → `setBaseURI` order, the `assertCollectionInit` guard, the receipt read and the survivable-phase error copy are all still correct. Three changes only:

1. `maxSupply: BigInt(state.files.length)` instead of the parsed field.
2. Read every value from `state` rather than local `useState`.
3. `if (art.length > 0)` becomes unconditional — art is required now, so the upload always runs.

The page shell:

```tsx
"use client";

import { useWalletModal } from "@0xslots/wallet";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { usePublicClient } from "wagmi";

import { StepArt } from "@/components/create/step-art";
import { StepIdentity } from "@/components/create/step-identity";
import { StepRail } from "@/components/create/step-rail";
import { StepReview } from "@/components/create/step-review";
import { StepTerms } from "@/components/create/step-terms";
import { Button } from "@/components/ui/button";
import { useActiveChain } from "@/hooks/use-active-chain";
import { useCreateCollection } from "@/hooks/use-create-collection";
import { useIpfsUpload } from "@/hooks/use-ipfs-upload";
import { useClients } from "@/hooks/use-market";
import { chainName, factoryFor } from "@/lib/chains";

export default function CreatePage() {
  const { state, dispatch, canAdvance } = useCreateCollection();
  // …router, account, chain, clients, upload, busy, error — as before
  const factory = factoryFor(chainId);

  return (
    <div className="mx-auto w-full max-w-4xl px-5 pb-28 pt-10 sm:px-8">
      <div className="border border-line bg-paper">
        <StepRail current={state.step} onGoto={(step) => dispatch({ type: "goto", step })} />

        <div className="px-6 py-8 sm:px-9 sm:py-10">
          {/* Keyed on the step so the slide replays on every move, and
              direction-aware so back is visibly the reverse of forward. */}
          <div
            key={state.step}
            className={state.direction === 1 ? "animate-slide-in-right" : "animate-slide-in-left"}
          >
            {state.step === 0 && <StepArt state={state} dispatch={dispatch} />}
            {state.step === 1 && <StepIdentity state={state} dispatch={dispatch} />}
            {state.step === 2 && <StepTerms state={state} dispatch={dispatch} chainId={chainId} />}
            {state.step === 3 && <StepReview state={state} busy={busy} />}
          </div>

          {!factory && (
            <p className="mt-7 border-y border-line py-4 text-[13px] text-dim">
              Slotmarket has not reached {chainName(chainId)}.
            </p>
          )}

          <div className="mt-9 flex items-center gap-3 border-t border-line pt-6">
            {state.step > 0 && (
              <Button type="button" variant="outline" onClick={() => dispatch({ type: "back" })}>
                ← Back
              </Button>
            )}
            {state.step < 3 ? (
              <Button type="button" disabled={!canAdvance} onClick={() => dispatch({ type: "next" })}>
                {state.step === 0 ? "Name it →" : "Continue →"}
              </Button>
            ) : canWrite ? (
              <Button type="button" size="lg" disabled={!factory || !!busy} onClick={create}>
                {busy ?? "Open the collection"}
              </Button>
            ) : (
              <Button type="button" size="lg" variant="outline" onClick={openConnect}>
                Connect a wallet
              </Button>
            )}
            <span className="ml-auto text-[12px] text-dim">Step {state.step + 1} of 4</span>
          </div>

          {error && (
            <p role="alert" className="mt-4 text-[12px] leading-snug text-ebbing">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Delete the old art picker**

```bash
rm apps/market/src/components/art-choice.tsx
grep -rn "ArtChoice\|art-choice" apps/market/src/ || echo "✓ gone"
```

- [ ] **Step 3: Verify the route end to end**

`TYPECHECK`, then in the Browser pane at `http://localhost:3400/create`:
1. `read_page` — the rail shows four steps, "The art" current, Continue disabled
2. Set files on the hidden input via `javascript_tool` using a synthesized `DataTransfer` with two generated PNG blobs, dispatch `change`
3. `read_page` — two tiles, the count reads `2`, Continue enabled
4. Click through to Review; confirm it reads "2 places" and the phase strip is present
5. `read_console_messages onlyErrors:true` → none

---

### Task 10: Verification sweep

**Files:** none — this task only reads

- [ ] **Step 1: Typecheck and build**

```bash
pnpm --filter market typecheck && pnpm --filter market build
```
Expected: both clean. A build failure here that typecheck missed is almost always a server/client boundary — check for a `"use client"` missing from a new component.

- [ ] **Step 2: Contrast assertions**

In the Browser pane on `/create`, step 3:

```js
const px = (el) => { const s = getComputedStyle(el); return [s.color, s.backgroundColor]; };
const btn = [...document.querySelectorAll('button')].find(e => /Open the collection|Continue/.test(e.textContent));
({ button: px(btn), brandAsText: getComputedStyle(document.querySelector('.text-brand-ink')).color })
```
Expected: button is ink on `rgb(255, 107, 44)`; `.text-brand-ink` resolves to `rgb(194, 65, 12)`. Neither should ever be `rgb(255, 107, 44)` as a text colour on white.

- [ ] **Step 3: Narrow viewport**

`resize_window preset:"mobile"`, reload, screenshot `/`, `/create` and a collection page. The step rail must not overflow; the art grid must be 3 columns. Then `resize_window preset:"desktop"` to put it back.

- [ ] **Step 4: Reduced motion**

`resize_window` cannot emulate this; assert the rule exists instead:

```js
[...document.styleSheets].flatMap(s => { try { return [...s.cssRules] } catch { return [] } })
  .some(r => r.conditionText?.includes('prefers-reduced-motion'))
```
Expected: `true`.

- [ ] **Step 5: Report**

Summarise what was verified with the actual command output, and name anything that could not be verified — in particular, the full deploy→upload→setBaseURI submit needs a funded Base Sepolia wallet and has **not** been exercised end to end.

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| Palette tokens, contrast rules | 1 |
| Collection hues | 1 (`hueFor`), 4, 5 (applied) |
| Semantic retune (`waning`) | 1 |
| Ink-on-orange buttons | 1 (token), 2 (weight) |
| Delete `Plate`, three call sites | 3 |
| Four steps | 6 (reducer), 7, 8, 9 |
| Supply = file count | 6 (`canAdvance`), 7 (`Count`), 9 (`maxSupply`) |
| Art shown on pick | 6 (`useObjectUrls`), 7 |
| Step state in one reducer | 6 |
| Animations table | 1 (keyframes), 3, 4, 7, 9 |
| Cursors | 1 (`cursors.ts`), 3, 4 |
| Testing approach | 10 |

**Placeholder scan:** Task 9 Step 1 says "as before" for the submit body rather than repeating ~60 lines. That is a deliberate instruction to preserve existing verified code, and the three required changes are enumerated — not a placeholder, but the executor must open the current file rather than write from scratch.

**Type consistency:** `Step`, `CreateState`, `CreateAction`, `FieldKey` are defined once in Task 6 and imported everywhere after. `Hue` fields (`ink`/`wash`/`rule`) are used consistently in Tasks 4 and 5. `ArtFrame`'s `state` union (`"art" | "loading" | "place"`) matches all three call sites in Task 3. `Field` is defined in `step-identity.tsx` and imported by `step-terms.tsx` — one definition, one import.

**Known gap:** `StepTerms` imports `Field` from `step-identity.tsx`, which is a slightly odd home for a shared primitive. Left deliberately: extracting a fourth file for one 20-line component is churn, and if a third step ever needs it, that is the moment to move it.
