# Merging vitrine into landing

**Date:** 2026-08-13
**Status:** Approved, not yet implemented

Fold `apps/vitrine` into `apps/landing` so one Next app serves both the
marketing site and the explorer. `apps/vitrine` is deleted. The explorer moves
wholesale under `/app/*`, freeing the root for the marketing page.

## Decisions

| Question | Decision |
|---|---|
| Where does the explorer go? | Everything under `/app/*`. Done now, while usage is low, rather than later. |
| Design systems | Converge on landing's shadcn tokens. Vitrine's tokens and styling are abandoned. |
| Scope | Everything moves — home, blog, robots, sitemap. `apps/vitrine` is deleted. |
| `/app` prefix on links | Explicit rewrite at each call site, not centralised. |
| Farcaster account association | Left stale with a TODO. Re-signed later, by hand. |
| Commits | None. Everything stays unstaged for local testing. |

## Why a real segment, not a route group

Route groups do not contribute URL segments: `(app)/slots/[x]` still serves
`/slots/[x]`. `/app/*` therefore requires a real `app/` directory.

The group remains useful on the marketing side, where `(marketing)/layout.tsx`
carries a header and footer that `/app/*` must not inherit.

Converging the tokens also removed the need for Next's multiple-root-layout
pattern. That pattern exists to give groups different `<html>`/`<body>`, fonts
or CSS — convergence eliminates all three reasons. A single root layout is
simpler and keeps marketing→app navigation client-side rather than a full
document load.

## Target tree

```
apps/landing/src/app/
  layout.tsx              root: html/body, Inter + JetBrains Mono, globals.css
  error.tsx               unmoved — token-agnostic, covers both groups
  (marketing)/
    layout.tsx            SiteHeader + SiteFooter, metadataBase, title template
    page.tsx              /                  ← vitrine app/page.tsx
    blog/page.tsx         /blog
    blog/[slug]/page.tsx  /blog/[slug]
  app/
    layout.tsx            Providers + Toaster + AppShell, fc:miniapp metadata
    page.tsx              /app               ← was landing app/page.tsx
    slots/[slotAddress]/  /app/slots/…
    create/               /app/create
    collectives/          /app/collectives
    profile/  recipient/  policies/  demo/  docs/  lab/
  api/                    /api/*             unmoved
  .well-known/farcaster.json/                unmoved — well-known URI
  llm.txt/
  robots.ts  sitemap.ts   ← from vitrine
```

`api/` stays at the root. OG endpoints are not user-facing pages, and moving
them would churn every `previewPath` for no benefit.

## Layout split

The root layout currently wraps everything in `Providers` (wagmi, RainbowKit,
react-query) and `AppShell` (the sidebar). Both move down into
`app/layout.tsx`, so marketing renders neither — and does not pay for the
wallet bundle.

Metadata splits with them. Next merges metadata down the tree, so:

- **root** — `metadataBase`, icons, the shared description.
- **`(marketing)/layout.tsx`** — title template, canonical, OG/Twitter for the
  marketing site.
- **`app/layout.tsx`** — the `fc:miniapp` embed currently in the root layout.

## Files moved

From `apps/vitrine/src`:

Destinations are relative to `apps/landing/src`. Note that `robots.ts` and
`sitemap.ts` land at the **app-router root** (`src/app/`), not inside the new
`/app` segment — they must serve `/robots.txt` and `/sitemap.xml`.

| Source | Destination | Note |
|---|---|---|
| `app/page.tsx` | `app/(marketing)/page.tsx` | |
| `app/blog/page.tsx` | `app/(marketing)/blog/page.tsx` | |
| `app/blog/[slug]/page.tsx` | `app/(marketing)/blog/[slug]/page.tsx` | |
| `app/robots.ts` | `app/robots.ts` | root, not `app/app/` |
| `app/sitemap.ts` | `app/sitemap.ts` | root, not `app/app/`; gains `/app` |
| `components/hero.tsx` | `components/marketing/hero.tsx` | restyled |
| `components/parcel-field.tsx` | `components/marketing/parcel-field.tsx` | restyled |
| `components/mark.tsx` | `components/marketing/mark.tsx` | restyled |
| `components/site-header.tsx` | `components/marketing/site-header.tsx` | restyled |
| `components/site-footer.tsx` | `components/marketing/site-footer.tsx` | restyled |
| `components/blog/*` | `components/marketing/blog/*` | |
| `lib/blog.ts`, `lib/cms-types.ts` | `lib/blog.ts`, `lib/cms-types.ts` | |
| `lib/site.ts` | `lib/site.ts` | |
| `lib/links.ts` | folded into `lib/external-links.ts` | |

**Dropped, not moved** — landing already has its own:

- `components/ui/button.tsx` → landing's `Button` with `asChild`
- `lib/utils.ts` → landing's `cn`
- `app/globals.css` → landing's, entirely
- `app/layout.tsx` → superseded by the split above

## Link audit

Every explorer path gains an `/app` prefix. All 24 sites are rewritten
literally: the string in the code equals the URL in the browser, and
`generateMetadata` is server-side and bypasses the navigation context anyway —
centralising would have produced two conventions instead of one.

### `href="/"` → `/app`

These are "back to the explorer" links. They mean the explorer index, not the
marketing home.

| File | Line |
|---|---|
| `components/app-shell.tsx` | 32 |
| `components/app-sidebar.tsx` | 74, and `push("/")` at 64 |
| `app/profile/page.tsx` | 220 |
| `app/recipient/[address]/recipient-page-content.tsx` | 82 |
| `app/slots/[slotAddress]/slot-page-content.tsx` | 225 |
| `app/docs/page.tsx` | 34 |
| `app/create/page.tsx` | 120 — `push("/")` after create |

### Named routes

| Path | Sites |
|---|---|
| `/create` | `app-sidebar.tsx:87`, `app/page.tsx:54` |
| `/profile` | `app-shell.tsx:88`, `app-sidebar.tsx:151`, `user-menu.tsx:270` |
| `/collectives` | `collectives/[address]/page.tsx:70`, `collectives/page.tsx:64,123`, `collectives/create/page.tsx:357` |
| `/policies` | `app-sidebar.tsx:121` |
| `/lab` | `app-sidebar.tsx:133` |

### Template literals

| Path | Site |
|---|---|
| `/slots/${…}` | `profile/page.tsx:72`, `recipient-page-content.tsx:182`, `explorer/slots-table.tsx:348` |
| `/recipient/${…}` | `explorer/recipients-table.tsx:91` |

## Absolute URLs

### Origin

`constants.ts:12` — `https://app.0xslots.org` → `https://0xslots.org`.
`NEXT_PUBLIC_APP_URL` follows wherever it is set.

### Miniapp embeds

`lib/frame-metadata.ts:28` builds `url: ${APP_URL}${path}`. Its one caller,
`app/slots/[slotAddress]/page.tsx:27`, passes `path: /slots/${slotAddress}` and
must pass `/app/slots/${slotAddress}`.

`previewPath` is unchanged — `/api/og/slot/…` did not move.

### Manifest

`.well-known/farcaster.json/route.ts:25` — `homeUrl: APP_URL` →
`${APP_URL}/app`.

### Adland

`components/ad-bar.tsx:49` passes `baseLinkUrl={APP_URL}` to `<Ad>`, which
builds `{baseLinkUrl}/slots/{slot}` internally. Under the new tree that is a
404. It must become `${APP_URL}/app`.

This one is silent — nothing type-checks it and nothing fails at build. It is
the most likely thing to be missed.

## Farcaster account association

`.well-known/farcaster.json/route.ts:14-20` carries a signature bound to the
domain. Its payload decodes to:

```json
{"domain":"app.0xslots.org"}
```

signed by fid 1733. Moving the origin invalidates it, and it cannot be
regenerated in code — it is re-signed by hand at
`farcaster.xyz/~/developers/mini-apps/manifest`.

**Deferred deliberately.** The existing association stays in place with a TODO
comment naming the domain it is signed for and what has to happen. Leaving the
old value is better than blanking it: a stale association fails verification
loudly, an empty one looks deliberate.

Until it is re-signed, the miniapp will not verify on `0xslots.org`.

## Styling convergence

Vitrine's `@theme` block is discarded. The moved components are remapped onto
landing's shadcn tokens:

| Vitrine | Landing |
|---|---|
| `text-ink`, `text-ink/80` | `text-foreground`, `text-muted-foreground` |
| `border-ink` | `border-border` |
| `fill-claim/15`, `stroke-claim/45` | `fill-destructive/15`, `stroke-destructive/45` |
| `fill-ink/[0.055]`, `stroke-ink/[0.07]` | `fill-foreground/[0.055]`, `stroke-foreground/[0.07]` |
| `bg-paper`, `bg-chalk` | `bg-background`, `bg-card` |
| `ButtonLink` | `Button asChild` + `NavLink`/`a` |

Vitrine's five `@utility` classes — `display`, `display-tight`, `eyebrow`,
`offset-ink`, `offset-claim` — are **ported into landing's `globals.css` under
their own names**, redefined in shadcn terms. They are not inlined at the call
sites.

Inlining was the first instinct and is wrong: these are used across the hero,
the blog index, the post page and the rich-text renderer — roughly forty call
sites — and replacing each with a bundle of raw utilities would be a large
diff that buys nothing. Redefining five rules in one file is smaller, reversible
and keeps every call site working untouched.

`display` and `display-tight` drove Archivo's width axis. Archivo is dropped, so
headlines render in the inherited sans. This is a visible downgrade to the hero
and is accepted — tokens are a separate pass. Keeping the utility names means
restoring a display face later is a change to two rules in `globals.css` rather
than a rewrite of every headline.

`offset-flow` is not ported; nothing that moves uses it.

`animate-raise` and `animate-register` keyframes are carried over too. Losing
the hero's stagger would be gratuitous, and they are self-contained. The
`prefers-reduced-motion` block comes with them — it zeroes `animation-delay`,
without which the staggered hero stays invisible for half a second rather than
skipping the animation.

The colour tokens in the table above are applied as a mechanical search-replace
across every moved file, including the blog components.

## Workspace and deployment

- Delete `apps/vitrine`.
- Remove `dev:vitrine` and `build:vitrine` from the root `package.json`.
- `pnpm-lock.yaml` regenerates.
- Move `class-variance-authority`, `clsx`, `tailwind-merge` — already landing
  dependencies, so nothing to add.
- Landing's env gains `NEXT_PUBLIC_CMS_URL` and `NEXT_PUBLIC_CMS_CATEGORY`.
  `lib/blog.ts` already degrades to empty during builds that cannot reach the
  CMS (`NEXT_PHASE === "phase-production-build"`), which carries over intact.
- Landing now serves the apex. `app.0xslots.org` needs a host-level redirect to
  `0xslots.org`, with `/` → `/app` so existing explorer bookmarks land
  somewhere sensible.
- Vitrine's deploy target is retired.

## Sitemap and robots

Vitrine's `sitemap.ts` covers `/`, `/blog` and each post. It gains a `/app`
entry. Individual explorer routes are left out — they are address-parameterised
and effectively unbounded.

`robots.ts` carries over unchanged; `siteUrl` in `lib/site.ts` is already
`https://0xslots.org`, which is now correct for the merged app rather than
aspirational.

## Verification

No test suite covers routing here, so verification is manual and must be done
before any commit:

1. `pnpm build` in `apps/landing` — the whole tree compiles, both groups
   prerender.
2. `/` renders the hero with no wallet provider mounted (check the network tab
   for the absence of wallet chunks).
3. `/blog` and a post render from the CMS.
4. `/app` renders the explorer with sidebar and providers.
5. Walk every rewritten link: sidebar, header, back-links, slot rows, recipient
   rows, collectives, create-then-redirect.
6. `/api/og` and `/api/og/slot/<addr>` still return images.
7. `/.well-known/farcaster.json` returns `homeUrl` ending in `/app`.
8. An ad in the ad-bar links to `/app/slots/<addr>`, not `/slots/<addr>`.

## Out of scope

- Re-signing the Farcaster association.
- Any token or visual design work beyond the mechanical remap above.
- DNS and host redirect configuration.
- The `apps/docs` reference to `app.0xslots.org` in `modules/adland.mdx`, which
  documents the `@adland/react` package default rather than this app's URL.
