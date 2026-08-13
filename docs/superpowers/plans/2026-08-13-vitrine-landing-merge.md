# Vitrine → Landing Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fold `apps/vitrine` into `apps/landing` so one Next app serves the marketing site at `/` and the explorer under `/app/*`, then delete `apps/vitrine`.

**Architecture:** A single root layout holds `<html>`/`<body>`, fonts and `globals.css`. A `(marketing)` route group carries the header/footer shell; a real `app/` directory segment carries `Providers` + `AppShell` and every explorer route. Route groups do not contribute URL segments, which is why `/app/*` needs a real directory rather than an `(app)` group.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, shadcn, wagmi/RainbowKit, Payload CMS (read-only REST).

**Spec:** `docs/superpowers/specs/2026-08-13-vitrine-landing-merge-design.md`

## Global Constraints

- **Do not commit. Do not stage.** Every change stays in the working tree for local testing. No `git add`, no `git commit` in any task. This overrides the usual commit-per-task rhythm.
- Explorer paths are prefixed **explicitly** at each call site. Do not centralise the prefix in `context/navigation.tsx`.
- Vitrine's colour tokens are abandoned and remapped onto landing's shadcn tokens. Vitrine's five `@utility` classes are **ported** rather than inlined — they are used across the hero, both blog pages and the rich-text renderer, and inlining them would touch ~40 call sites for no gain.
- The Farcaster `accountAssociation` is **left as-is** with a TODO comment. It is signed for `app.0xslots.org` and must be re-signed by hand later.
- `api/`, `.well-known/`, `llm.txt/`, `robots.ts`, `sitemap.ts` stay at the app-router root — they must not move under `/app`.
- Origin becomes `https://0xslots.org` (was `https://app.0xslots.org`).

## Token remap

Applied mechanically to every file moved out of vitrine. Referenced by number from Task 4.

| Vitrine | Landing |
|---|---|
| `ink` | `foreground` |
| `slate` | `muted-foreground` |
| `vacant` | `muted-foreground` |
| `rule` | `border` |
| `claim` | `destructive` |
| `flow` | `primary` |
| `chalk` | `muted` |
| `paper` | `background` |

Opacity modifiers ride along unchanged: `text-ink/80` → `text-foreground/80`.

## Verification instead of commits

There is no test suite covering routing. Each task ends with a typecheck, build or grep, and the final task walks every route by hand.

```bash
# from apps/landing
pnpm exec tsc --noEmit     # typecheck
pnpm build                 # full build + prerender
pnpm dev                   # http://localhost:3200
```

---

### Task 1: Create the route skeleton and split the layouts

Nothing moves yet. This establishes the two shells so later tasks have somewhere to land.

**Files:**
- Modify: `apps/landing/src/app/layout.tsx`
- Create: `apps/landing/src/app/(marketing)/layout.tsx`
- Create: `apps/landing/src/app/app/layout.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `app/(marketing)/layout.tsx` (marketing shell, no providers) and `app/app/layout.tsx` (default export `AppLayout`, wraps children in `Providers` + `Toaster` + `AppShell`).

- [ ] **Step 1: Strip the root layout down to html/body/fonts**

Replace `apps/landing/src/app/layout.tsx` entirely:

```tsx
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

import "./globals.css";
import { APP_URL } from "@/constants";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  // Lets every page declare relative canonical/OG urls and have Next resolve
  // them against the live origin.
  metadataBase: new URL(APP_URL),
  title: {
    default: "0xSlots — Making collective ownership easy to use",
    // Articles set a bare title; the brand is appended exactly once here.
    template: "%s — 0xSlots",
  },
  description:
    "Name your price and pay a small tax on it. Anyone can buy it from you at that price, any time — so nothing sits idle and everything stays honestly valued. Collectives let a group share what those assets earn and govern them together. On Base, in any ERC-20.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${jetbrains.variable} font-sans bg-background text-foreground`}
      >
        {children}
      </body>
    </html>
  );
}
```

`Providers`, `Toaster` and `AppShell` are deliberately gone — they move to the app segment in Step 3.

- [ ] **Step 2: Create the marketing shell**

Create `apps/landing/src/app/(marketing)/layout.tsx`. `SiteHeader`/`SiteFooter` do not exist until Task 4, so this will not typecheck until then. That is expected.

```tsx
import type { Metadata } from "next";

import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "0xSlots",
    url: "/",
    title: "0xSlots — Making collective ownership easy to use",
    description:
      "Name your price and pay a small tax on it. Anyone can buy it at that price, any time. Collectives let a group share the income and govern together.",
  },
  twitter: {
    card: "summary_large_image",
    title: "0xSlots — Making collective ownership easy to use",
    description:
      "Name your price and pay a small tax on it. Anyone can buy it at that price, any time. Collectives let a group share the income and govern together.",
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}
```

- [ ] **Step 3: Create the app shell**

Create `apps/landing/src/app/app/layout.tsx`. This is where the wallet stack now lives, so nothing under `(marketing)` loads it.

```tsx
import type { Metadata } from "next";
import { Toaster } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Providers } from "@/components/providers";
import { APP_URL } from "@/constants";

export const metadata: Metadata = {
  title: "0xSlots — Immutable & Modular Collective Ownership Slots",
  description:
    "Immutable & modular collective ownership slots on Ethereum. Perpetual onchain real estate powered by partial common ownership. Any ERC-20.",
  other: {
    "fc:miniapp": JSON.stringify({
      version: "1",
      imageUrl: `${APP_URL}/api/og`,
      button: {
        title: "Open 0xSlots",
        action: {
          type: "launch_miniapp",
          name: "0xSlots",
          // The explorer lives under /app now — the miniapp must open there,
          // not on the marketing page.
          url: `${APP_URL}/app`,
          splashImageUrl: `${APP_URL}/logo.png`,
          splashBackgroundColor: "#ffffff",
        },
      },
    }),
  },
};

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <Toaster position="bottom-right" richColors />
      <AppShell>{children}</AppShell>
    </Providers>
  );
}
```

- [ ] **Step 4: Verify the three layouts exist and the root no longer mounts providers**

```bash
cd apps/landing
ls src/app/layout.tsx "src/app/(marketing)/layout.tsx" src/app/app/layout.tsx
grep -c "Providers" src/app/layout.tsx
```

Expected: all three paths listed; `grep -c` prints `0`. Typecheck still fails on the missing marketing components — resolved in Task 4.

---

### Task 2: Move the explorer routes under `/app`

**Files:**
- Move: `apps/landing/src/app/{page.tsx,slots,create,collectives,profile,recipient,policies,demo,docs,lab}` → `apps/landing/src/app/app/`

**Interfaces:**
- Consumes: `app/app/layout.tsx` from Task 1.
- Produces: explorer routes at `/app`, `/app/slots/[slotAddress]`, `/app/create`, `/app/collectives`, `/app/collectives/create`, `/app/collectives/[address]`, `/app/profile`, `/app/recipient/[address]`, `/app/policies`, `/app/demo`, `/app/docs`, `/app/lab`.

- [ ] **Step 1: Move the route directories**

`error.tsx`, `globals.css`, `favicon.ico`, `api/`, `.well-known/`, `llm.txt/` deliberately stay put.

```bash
cd apps/landing/src/app
git mv page.tsx app/page.tsx
for d in slots create collectives profile recipient policies demo docs; do
  git mv "$d" "app/$d"
done
```

`lab/` is untracked, so `git mv` will not handle it:

```bash
mv lab app/lab
```

- [ ] **Step 2: Verify the tree**

```bash
cd apps/landing/src/app
ls -A
ls app
```

Expected `ls -A`: `(marketing)`, `.well-known`, `api`, `app`, `error.tsx`, `favicon.ico`, `globals.css`, `layout.tsx`, `llm.txt`.
Expected `ls app`: `collectives`, `create`, `demo`, `docs`, `lab`, `layout.tsx`, `page.tsx`, `policies`, `profile`, `recipient`, `slots`.

- [ ] **Step 3: Confirm no collision at `/`**

```bash
cd apps/landing/src/app
ls page.tsx 2>/dev/null && echo "ERROR: stale root page still present" || echo "root page moved OK"
```

Expected: `root page moved OK`. Two files resolving to `/` is a build error.

---

### Task 3: Port the vitrine utilities and keyframes into globals.css

Do this **before** moving components, so the moved files have working utilities to land on.

**Files:**
- Modify: `apps/landing/src/app/globals.css`

**Interfaces:**
- Consumes: landing's existing shadcn CSS variables (`--foreground`, `--muted-foreground`, `--destructive`, `--border`).
- Produces: utilities `display`, `display-tight`, `eyebrow`, `offset-ink`, `offset-claim`; animations `animate-raise`, `animate-register`; a reduced-motion guard.

- [ ] **Step 1: Extend the `@theme` block with the animations**

In `apps/landing/src/app/globals.css`, replace the existing `@theme` block (currently just the two font vars) with:

```css
@theme {
  --font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-mono), ui-monospace, monospace;

  /* Carried over from vitrine — the marketing hero staggers on these. */
  --animate-raise: raise 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
  --animate-register: register 0.9s cubic-bezier(0.16, 1, 0.3, 1) both;

  @keyframes raise {
    from {
      opacity: 0;
      transform: translateY(0.7em);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes register {
    from {
      opacity: 0;
      transform: translate(14px, 14px);
    }
    to {
      opacity: 1;
      transform: translate(0, 0);
    }
  }
}
```

- [ ] **Step 2: Add the ported utilities**

Append to `apps/landing/src/app/globals.css`. These keep their vitrine names because the marketing pages, the blog and the rich-text renderer all use them — inlining would touch ~40 call sites.

```css
/* ── Ported from vitrine ───────────────────────────────────────────────
   Redefined in shadcn terms. `display` drove Archivo's width axis; Archivo
   is gone with the vitrine tokens, so this is the inherited sans for now.
   The utility survives so restoring a display face later is a change here
   rather than a rewrite of every headline. */

@utility display {
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: -0.015em;
  line-height: 0.9;
}

@utility display-tight {
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

@utility eyebrow {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: var(--muted-foreground);
}

/* Two-colour press with slight misregistration: a hard offset block behind a
   surface, never blurred. */
@utility offset-ink {
  box-shadow: 6px 6px 0 0 var(--foreground);
}

@utility offset-claim {
  box-shadow: 8px 8px 0 0 var(--destructive);
}

@media (prefers-reduced-motion: reduce) {
  /* Delay must be zeroed too, or the staggered hero simply stays invisible
     for half a second instead of animating. */
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-delay: 0ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

`offset-flow` is deliberately not ported — nothing that moves uses it.

- [ ] **Step 3: Verify**

```bash
cd apps/landing/src/app
grep -c "@utility display\|@utility eyebrow\|animate-raise\|prefers-reduced-motion" globals.css
```

Expected: `4` or more.

---

### Task 4: Move and remap the marketing components

**Files:**
- Create: `apps/landing/src/components/marketing/{hero,parcel-field,mark,site-header,site-footer}.tsx`
- Create: `apps/landing/src/components/marketing/blog/{render-blocks,rich-text}.tsx`
- Create: `apps/landing/src/lib/{blog.ts,cms-types.ts,site.ts}`
- Modify: `apps/landing/src/lib/external-links.ts`

**Interfaces:**
- Consumes: landing's `Button` (`@/components/ui/button`), `cn` (`@/lib/utils`), the utilities from Task 3.
- Produces: `Hero`, `ParcelField`, `Mark`, `Cell`, `Wordmark`, `SiteHeader`, `SiteFooter`, `RenderBlocks`; `getPosts`, `getPostBySlug`, `getPostSlugs`, `clampDescription`, `categoryTitles`, `mediaUrl` from `@/lib/blog`; `siteUrl`, `title`, `tagline`, `studio` from `@/lib/site`; `MARKETING_LINKS` from `@/lib/external-links`.

- [ ] **Step 1: Copy everything across**

```bash
cd /Users/nezzarkefif/Documents/GitHub/0xSlots
mkdir -p apps/landing/src/components/marketing/blog

cp apps/vitrine/src/lib/blog.ts        apps/landing/src/lib/blog.ts
cp apps/vitrine/src/lib/cms-types.ts   apps/landing/src/lib/cms-types.ts
cp apps/vitrine/src/lib/site.ts        apps/landing/src/lib/site.ts

cp apps/vitrine/src/components/hero.tsx         apps/landing/src/components/marketing/hero.tsx
cp apps/vitrine/src/components/parcel-field.tsx apps/landing/src/components/marketing/parcel-field.tsx
cp apps/vitrine/src/components/mark.tsx         apps/landing/src/components/marketing/mark.tsx
cp apps/vitrine/src/components/site-header.tsx  apps/landing/src/components/marketing/site-header.tsx
cp apps/vitrine/src/components/site-footer.tsx  apps/landing/src/components/marketing/site-footer.tsx
cp apps/vitrine/src/components/blog/render-blocks.tsx apps/landing/src/components/marketing/blog/render-blocks.tsx
cp apps/vitrine/src/components/blog/rich-text.tsx     apps/landing/src/components/marketing/blog/rich-text.tsx
```

`lib/utils.ts` and `components/ui/button.tsx` are **not** copied — landing already has both, and vitrine's would collide.

- [ ] **Step 2: Apply the token remap to every copied component**

Mechanical, per the Token remap table. Order matters only in that each pattern is anchored to its utility prefix.

```bash
cd apps/landing/src/components/marketing
for f in hero.tsx parcel-field.tsx mark.tsx site-header.tsx site-footer.tsx \
         blog/render-blocks.tsx blog/rich-text.tsx; do
  sed -i '' \
    -e 's/\(text\|bg\|border\|fill\|stroke\|decoration\|ring\)-ink/\1-foreground/g' \
    -e 's/\(text\|bg\|border\|fill\|stroke\|decoration\|ring\)-slate/\1-muted-foreground/g' \
    -e 's/\(text\|bg\|border\|fill\|stroke\|decoration\|ring\)-vacant/\1-muted-foreground/g' \
    -e 's/\(text\|bg\|border\|fill\|stroke\|decoration\|ring\)-rule/\1-border/g' \
    -e 's/\(text\|bg\|border\|fill\|stroke\|decoration\|ring\)-claim/\1-destructive/g' \
    -e 's/\(text\|bg\|border\|fill\|stroke\|decoration\|ring\)-flow/\1-primary/g' \
    -e 's/\(text\|bg\|border\|fill\|stroke\|decoration\|ring\)-chalk/\1-muted/g' \
    -e 's/\(text\|bg\|border\|fill\|stroke\|decoration\|ring\)-paper/\1-background/g' \
    "$f"
done
```

`offset-ink` and `offset-claim` are utility names, not colour classes, and are
untouched by the patterns above — they were ported under their own names in
Task 3.

- [ ] **Step 3: Repoint the blog component imports**

```bash
cd apps/landing/src/components/marketing
sed -i '' 's|@/components/blog/|@/components/marketing/blog/|g' blog/render-blocks.tsx blog/rich-text.tsx
```

- [ ] **Step 4: Add the marketing destinations to external-links.ts**

Append to `apps/landing/src/lib/external-links.ts`, after the `EXTERNAL_LINKS` array:

```ts
/**
 * Marketing-page destinations. The explorer and create links are INTERNAL now
 * that both sites share an origin — they were absolute URLs to
 * app.0xslots.org while vitrine was its own deployment.
 */
export const MARKETING_LINKS = {
  explorer: "/app",
  create: "/app/create",
  docs: "https://docs.0xslots.org",
  github: "https://github.com/adcommune/0xSlots",
  telegram: "https://t.me/+AQ3SdkC0SCM4NTdk",
} as const;
```

- [ ] **Step 5: Rewrite site-header.tsx**

`ButtonLink` and `links` are gone. The explorer is on-site now, so no `target="_blank"`.

```tsx
import Link from "next/link";

import { Wordmark } from "@/components/marketing/mark";
import { Button } from "@/components/ui/button";
import { MARKETING_LINKS } from "@/lib/external-links";

// No nav. The page is a hero and a footer, so there is nowhere on-site to
// send anyone — the two destinations that matter are the hero's own buttons,
// and this one is here because it is the action, not a link.
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/90 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-6">
        <Link href="/" className="text-foreground">
          <Wordmark />
        </Link>

        <Button asChild size="sm">
          <Link href={MARKETING_LINKS.explorer}>Open explorer</Link>
        </Button>
      </div>
    </header>
  );
}
```

- [ ] **Step 6: Rewrite the footer's destination list**

In `apps/landing/src/components/marketing/site-footer.tsx`, replace the `links` import and the `destinations` array. The explorer becomes an internal `Link`; the rest keep the ↗.

Replace the imports at the top:

```tsx
import Link from "next/link";

import { Wordmark } from "@/components/marketing/mark";
import { MARKETING_LINKS } from "@/lib/external-links";
import { studio } from "@/lib/site";

const destinations = [
  { label: "Docs", href: MARKETING_LINKS.docs },
  { label: "Source", href: MARKETING_LINKS.github },
  { label: "Telegram", href: MARKETING_LINKS.telegram },
];
```

Then inside the `<nav>`, add the internal explorer link before the `destinations.map(...)`:

```tsx
          <Link
            href={MARKETING_LINKS.explorer}
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-foreground transition-colors hover:text-destructive"
          >
            Explorer
          </Link>
```

- [ ] **Step 7: Fix the mark's negative space**

Step 2 turned `fill-paper` into `fill-background`, which is already correct — the
cut-out cells are negative space and must match the surface behind them. Only
the dropped display face needs attention. In
`apps/landing/src/components/marketing/mark.tsx`, remove `font-display` from
`Wordmark`:

```tsx
      <span className="text-[17px] font-extrabold tracking-[-0.02em]">
        0xSlots
      </span>
```

- [ ] **Step 8: Swap the hero's buttons**

In `apps/landing/src/components/marketing/hero.tsx`, replace the `ButtonLink` import and the button block. Everything else — the headline, the `display`/`eyebrow`/`animate-raise` classes — survives Task 3's ports untouched.

Imports:

```tsx
import Link from "next/link";

import { ParcelField } from "@/components/marketing/parcel-field";
import { Button } from "@/components/ui/button";
import { MARKETING_LINKS } from "@/lib/external-links";
```

The button block:

```tsx
          <div
            className="mt-9 flex animate-raise flex-wrap gap-3"
            style={{ animationDelay: "560ms" }}
          >
            <Button asChild size="lg">
              <Link href={MARKETING_LINKS.explorer}>Open explorer</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href={MARKETING_LINKS.docs} target="_blank" rel="noreferrer">
                Read the docs
              </a>
            </Button>
          </div>
```

- [ ] **Step 9: Verify no vitrine colour tokens or imports survived**

```bash
cd apps/landing/src/components/marketing
grep -rn "\-ink\b\|\-slate\b\|\-vacant\b\|\-rule\b\|\-claim\b\|\-flow\b\|\-chalk\b\|\-paper\b\|ButtonLink\|@/lib/links\|font-display" . \
  | grep -v "offset-ink\|offset-claim" || echo "clean"
```

Expected: `clean`.

---

### Task 5: Move the marketing pages, robots and sitemap

**Files:**
- Create: `apps/landing/src/app/(marketing)/page.tsx`
- Create: `apps/landing/src/app/(marketing)/blog/page.tsx`
- Create: `apps/landing/src/app/(marketing)/blog/[slug]/page.tsx`
- Create: `apps/landing/src/app/robots.ts`
- Create: `apps/landing/src/app/sitemap.ts`

**Interfaces:**
- Consumes: `Hero`, `RenderBlocks`, `@/lib/blog`, `@/lib/site` from Task 4; `(marketing)/layout.tsx` from Task 1.
- Produces: routes `/`, `/blog`, `/blog/[slug]`, `/robots.txt`, `/sitemap.xml`.

- [ ] **Step 1: Create the marketing home**

`SiteHeader`/`SiteFooter` live in the group layout now, so the page is just the hero.

```tsx
import { Hero } from "@/components/marketing/hero";

export default function HomePage() {
  return <Hero />;
}
```

- [ ] **Step 2: Copy the blog pages and apply the same remap**

```bash
cd /Users/nezzarkefif/Documents/GitHub/0xSlots
mkdir -p "apps/landing/src/app/(marketing)/blog/[slug]"
cp apps/vitrine/src/app/blog/page.tsx \
   "apps/landing/src/app/(marketing)/blog/page.tsx"
cp "apps/vitrine/src/app/blog/[slug]/page.tsx" \
   "apps/landing/src/app/(marketing)/blog/[slug]/page.tsx"

cd "apps/landing/src/app/(marketing)/blog"
for f in page.tsx "[slug]/page.tsx"; do
  sed -i '' \
    -e 's/\(text\|bg\|border\|fill\|stroke\|decoration\|ring\)-ink/\1-foreground/g' \
    -e 's/\(text\|bg\|border\|fill\|stroke\|decoration\|ring\)-slate/\1-muted-foreground/g' \
    -e 's/\(text\|bg\|border\|fill\|stroke\|decoration\|ring\)-vacant/\1-muted-foreground/g' \
    -e 's/\(text\|bg\|border\|fill\|stroke\|decoration\|ring\)-rule/\1-border/g' \
    -e 's/\(text\|bg\|border\|fill\|stroke\|decoration\|ring\)-claim/\1-destructive/g' \
    -e 's/\(text\|bg\|border\|fill\|stroke\|decoration\|ring\)-chalk/\1-muted/g' \
    -e 's/\(text\|bg\|border\|fill\|stroke\|decoration\|ring\)-paper/\1-background/g' \
    -e 's|@/components/blog/|@/components/marketing/blog/|g' \
    "$f"
done
```

- [ ] **Step 3: Strip the shell from the blog index**

In `apps/landing/src/app/(marketing)/blog/page.tsx`:

1. Delete these two imports:

```tsx
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
```

2. In the returned JSX, delete the `<SiteHeader />` line (immediately after the opening `<>`) and the `<SiteFooter />` line (immediately before the closing `</>`). The fragment now opens straight onto the JSON-LD `<script>` and closes after `</main>`.

- [ ] **Step 4: Strip the shell from the post page**

In `apps/landing/src/app/(marketing)/blog/[slug]/page.tsx`, do exactly the same:

1. Delete the `SiteFooter` and `SiteHeader` imports.
2. Delete `<SiteHeader />` after the opening `<>` and `<SiteFooter />` before the closing `</>`.

The `RenderBlocks` import was already repointed to `@/components/marketing/blog/render-blocks` by Step 2's sed.

- [ ] **Step 5: Copy robots.ts to the app-router root**

Goes to `src/app/robots.ts`, **not** `src/app/app/robots.ts` — it must serve `/robots.txt`.

```bash
cd /Users/nezzarkefif/Documents/GitHub/0xSlots
cp apps/vitrine/src/app/robots.ts apps/landing/src/app/robots.ts
```

No edits needed: `siteUrl` in `lib/site.ts` is already `https://0xslots.org`.

- [ ] **Step 6: Create sitemap.ts with the `/app` entry**

Create `apps/landing/src/app/sitemap.ts` — again at the root, not under `app/app/`:

```ts
import type { MetadataRoute } from "next";
import { getPosts } from "@/lib/blog";
import { siteUrl } from "@/lib/site";

// Keep in step with REVALIDATE in lib/blog.ts.
export const revalidate = 60;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getPosts();

  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    // The explorer index. Individual slot/recipient routes are deliberately
    // absent — they are address-parameterised and effectively unbounded.
    {
      url: `${siteUrl}/app`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...posts.map((post) => ({
      url: `${siteUrl}/blog/${post.slug}`,
      lastModified: new Date(post.updatedAt ?? post.publishedAt ?? Date.now()),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
```

- [ ] **Step 7: Verify**

```bash
cd "apps/landing/src/app/(marketing)"
grep -rn "SiteHeader\|SiteFooter" . || echo "clean — shell is in the layout"
grep -rn "\-ink\b\|\-slate\b\|\-claim\b\|\-chalk\b\|\-vacant\b\|\-rule\b" . || echo "tokens clean"
```

Expected: `clean — shell is in the layout` and `tokens clean`.

---

### Task 6: Rewrite every internal link with the `/app` prefix

24 call sites, each rewritten literally.

**Files:**
- Modify: `apps/landing/src/components/{app-shell,app-sidebar,user-menu}.tsx`
- Modify: `apps/landing/src/components/explorer/{slots-table,recipients-table}.tsx`
- Modify: `apps/landing/src/app/app/{page,create/page,docs/page,profile/page}.tsx`
- Modify: `apps/landing/src/app/app/recipient/[address]/recipient-page-content.tsx`
- Modify: `apps/landing/src/app/app/slots/[slotAddress]/slot-page-content.tsx`
- Modify: `apps/landing/src/app/app/collectives/{page,create/page,[address]/page}.tsx`

**Interfaces:**
- Consumes: routes from Task 2.
- Produces: navigation that resolves under `/app`.

- [ ] **Step 1: Rewrite the back-links to `/app`**

Every one of these means *the explorer index*, not the marketing home.

| File | Line | From | To |
|---|---|---|---|
| `components/app-shell.tsx` | 32 | `href="/"` | `href="/app"` |
| `components/app-sidebar.tsx` | 64 | `push("/")` | `push("/app")` |
| `components/app-sidebar.tsx` | 74 | `href="/"` | `href="/app"` |
| `app/app/create/page.tsx` | 120 | `push("/")` | `push("/app")` |
| `app/app/docs/page.tsx` | 34 | `href="/"` | `href="/app"` |
| `app/app/profile/page.tsx` | 220 | `href="/"` | `href="/app"` |
| `app/app/recipient/[address]/recipient-page-content.tsx` | 82 | `href="/"` | `href="/app"` |
| `app/app/slots/[slotAddress]/slot-page-content.tsx` | 225 | `href="/"` | `href="/app"` |

- [ ] **Step 2: Rewrite the named routes**

| File | Line | From | To |
|---|---|---|---|
| `components/app-sidebar.tsx` | 87 | `push("/create")` | `push("/app/create")` |
| `components/app-sidebar.tsx` | 121 | `push("/policies")` | `push("/app/policies")` |
| `components/app-sidebar.tsx` | 133 | `push("/lab")` | `push("/app/lab")` |
| `components/app-sidebar.tsx` | 151 | `push("/profile")` | `push("/app/profile")` |
| `components/app-sidebar.tsx` | 160 | `push("/collectives")` | `push("/app/collectives")` |
| `components/app-shell.tsx` | 88 | `push("/profile")` | `push("/app/profile")` |
| `components/user-menu.tsx` | 270 | `push("/profile")` | `push("/app/profile")` |
| `app/app/page.tsx` | 54 | `href="/create"` | `href="/app/create"` |
| `app/app/collectives/page.tsx` | 64 | `href="/collectives/create"` | `href="/app/collectives/create"` |
| `app/app/collectives/page.tsx` | 123 | `href="/collectives/create"` | `href="/app/collectives/create"` |
| `app/app/collectives/create/page.tsx` | 357 | `href="/collectives"` | `href="/app/collectives"` |
| `app/app/collectives/[address]/page.tsx` | 70 | `href="/collectives"` | `href="/app/collectives"` |

- [ ] **Step 3: Rewrite the template literals**

| File | Line | From | To |
|---|---|---|---|
| `app/app/profile/page.tsx` | 72 | `` push(`/slots/${s.id}`) `` | `` push(`/app/slots/${s.id}`) `` |
| `app/app/recipient/[address]/recipient-page-content.tsx` | 182 | `` push(`/slots/${s.id}`) `` | `` push(`/app/slots/${s.id}`) `` |
| `components/explorer/slots-table.tsx` | 348 | `` push(`/slots/${id}`) `` | `` push(`/app/slots/${id}`) `` |
| `components/explorer/recipients-table.tsx` | 91 | `` push(`/recipient/${a.account}`) `` | `` push(`/app/recipient/${a.account}`) `` |

- [ ] **Step 4: Verify nothing unprefixed remains**

```bash
cd apps/landing/src
grep -rn 'href="/\(create\|profile\|collectives\|policies\|lab\|slots\|recipient\|demo\|docs\)\|push("/\(create\|profile\|collectives\|policies\|lab\|demo\|docs\)"\|push(`/\(slots\|recipient\)/' \
  --include='*.tsx' --include='*.ts' . | grep -v "/app/" || echo "clean"

grep -rn 'href="/"\|push("/")' --include='*.tsx' app/app components || echo "no bare root links"
```

Expected: `clean` and `no bare root links`.

---

### Task 7: Fix the absolute URLs — origin, miniapp, manifest, adland

These are the silent ones. Nothing here type-checks or fails at build.

**Files:**
- Modify: `apps/landing/src/constants.ts:12`
- Modify: `apps/landing/src/app/app/slots/[slotAddress]/page.tsx:27`
- Modify: `apps/landing/src/app/.well-known/farcaster.json/route.ts`
- Modify: `apps/landing/src/components/ad-bar.tsx:49`

**Interfaces:**
- Consumes: `APP_URL` from `@/constants`.
- Produces: correct absolute URLs for OG, miniapp embeds and adland CTAs.

- [ ] **Step 1: Move the origin to the apex**

In `apps/landing/src/constants.ts`, line 12:

```ts
export const APP_URL = useTunnel
  ? "https://really-intense-guppy.ngrok-free.app"
  : (process.env.NEXT_PUBLIC_APP_URL ?? "https://0xslots.org");
```

- [ ] **Step 2: Prefix the miniapp embed path on slot pages**

In `apps/landing/src/app/app/slots/[slotAddress]/page.tsx`, the `getFrameMetadata` call:

```tsx
  const { frame, metadata } = getFrameMetadata({
    title: `Slot ${truncated}`,
    // The explorer lives under /app — this is the URL the miniapp opens.
    path: `/app/slots/${slotAddress}`,
    // previewPath is an API route and did NOT move.
    previewPath: `/api/og/slot/${slotAddress}`,
  });
```

`lib/frame-metadata.ts` itself needs no change — it concatenates whatever `path` it is given.

- [ ] **Step 3: Point the manifest at /app and flag the stale association**

Replace `apps/landing/src/app/.well-known/farcaster.json/route.ts`:

```ts
import { NextResponse } from "next/server";
import { APP_URL } from "@/constants";

/**
 * Farcaster miniapp manifest.
 *
 * TODO — RE-SIGN THE ACCOUNT ASSOCIATION.
 *
 * The `accountAssociation` below is a signature bound to a domain. Its payload
 * decodes to {"domain":"app.0xslots.org"}, signed by fid 1733, and the app now
 * serves from 0xslots.org — so it will NOT verify.
 *
 * It cannot be regenerated in code. Re-sign for `0xslots.org` with fid 1733 at:
 *   https://farcaster.xyz/~/developers/mini-apps/manifest
 *
 * The stale value is left in place deliberately rather than blanked: a wrong
 * association fails verification loudly, an empty one looks intentional.
 */
export function GET() {
  return NextResponse.json({
    accountAssociation: {
      header:
        "eyJmaWQiOjE3MzMsInR5cGUiOiJhdXRoIiwia2V5IjoiMHhjMGU1RTBFODIzYURmMTQ4YjRjMzliOTZiMjA4NDhkMjlDQ0FFMTg4In0",
      payload: "eyJkb21haW4iOiJhcHAuMHhzbG90cy5vcmcifQ",
      signature:
        "d08zVBRPzHbs4RBTqNU4SNWhP1iigwf3uiP9ARY/1ekpQYFi1XCoPVGY1ndjeSEmK1bINes++pRmFd4vNeG1+Rw=",
    },
    miniapp: {
      version: "1",
      name: "0xSlots",
      iconUrl: `${APP_URL}/logo.png`,
      // The explorer, not the marketing page.
      homeUrl: `${APP_URL}/app`,
      imageUrl: `${APP_URL}/api/og`,
      buttonTitle: "Explore",
      splashImageUrl: `${APP_URL}/logo.png`,
      splashBackgroundColor: "#ffffff",
      description: "Taxable Slots",
    },
  });
}
```

- [ ] **Step 4: Fix the adland base link**

`<Ad>` builds `{baseLinkUrl}/slots/{slot}` internally, so the base must carry `/app`. In `apps/landing/src/components/ad-bar.tsx`, line 49:

```tsx
      // <Ad> appends /slots/{slot} to this. The explorer moved under /app, so
      // the base has to carry it or every ad CTA 404s — nothing type-checks
      // this, so it fails silently.
      baseLinkUrl={`${APP_URL}/app`}
```

- [ ] **Step 5: Verify**

```bash
cd apps/landing/src
grep -rn "app\.0xslots\.org" --include='*.ts' --include='*.tsx' . | grep -v "payload:" | grep -v "decodes to" || echo "origin clean"
grep -n "baseLinkUrl" components/ad-bar.tsx
grep -n "homeUrl" app/.well-known/farcaster.json/route.ts
```

Expected: `origin clean`; `` baseLinkUrl={`${APP_URL}/app`} ``; `` homeUrl: `${APP_URL}/app` ``.
The only surviving `app.0xslots.org` should be the base64 `payload` and the TODO comment.

---

### Task 8: Delete vitrine and clean the workspace

**Files:**
- Delete: `apps/vitrine/`
- Modify: `package.json` (root)

**Interfaces:**
- Consumes: everything moved in Tasks 4-5.
- Produces: a single-app workspace.

- [ ] **Step 1: Confirm nothing still references vitrine**

```bash
cd /Users/nezzarkefif/Documents/GitHub/0xSlots
grep -rn "vitrine" apps/landing/src || echo "no vitrine references in landing"
```

Expected: `no vitrine references in landing`.

- [ ] **Step 2: Delete the app**

```bash
git rm -r apps/vitrine
```

- [ ] **Step 3: Remove the turbo scripts**

In the root `package.json`, delete these two lines:

```json
    "dev:vitrine": "turbo dev --filter=vitrine",
    "build:vitrine": "turbo build --filter=vitrine",
```

- [ ] **Step 4: Refresh the lockfile**

```bash
pnpm install
```

- [ ] **Step 5: Verify**

```bash
ls apps/
grep -c "vitrine" package.json || echo "0 refs in package.json"
```

Expected: `apps/` no longer lists `vitrine`; `0 refs in package.json`.

---

### Task 9: Build, then walk every route

The real verification. Nothing before this proves the merge works.

**Files:** none — verification only.

- [ ] **Step 1: Typecheck**

```bash
cd apps/landing
pnpm exec tsc --noEmit
```

Expected: no errors. Missing-module errors mean a Task 4 import path is wrong.

- [ ] **Step 2: Build**

```bash
cd apps/landing
pnpm build
```

Expected: success, with the route list including `/`, `/blog`, `/blog/[slug]`, `/app`, `/app/slots/[slotAddress]`, `/app/create`, `/app/collectives`, `/app/profile`, `/robots.txt`, `/sitemap.xml`.

A "two pages resolve to /" error means a stale `src/app/page.tsx` survived Task 2.

- [ ] **Step 3: Confirm marketing does not load the wallet bundle**

```bash
cd apps/landing
pnpm dev
```

Open `http://localhost:3200/`, devtools → Network, hard reload. Expected: no RainbowKit/WalletConnect chunks. Their presence means `Providers` is still mounted above the group — recheck Task 1 Step 1.

- [ ] **Step 4: Walk the marketing routes**

- `/` — hero renders, stagger animates, both buttons present.
- Header "Open explorer" → `/app`.
- Footer "Explorer" → `/app`; Docs/Source/Telegram open externally.
- `/blog` — post list renders from the CMS, header and footer present exactly once.
- `/blog/<slug>` — a post renders; "← All writing" returns to `/blog`.

- [ ] **Step 5: Walk the explorer routes**

- `/app` — sidebar and providers mount; all four tables render.
- Sidebar: Create → `/app/create`, Policies → `/app/policies`, Lab → `/app/lab`, Profile → `/app/profile`, Collectives → `/app/collectives`.
- Logo → `/app`.
- A slots-table row → `/app/slots/<addr>`.
- A recipients-table row → `/app/recipient/<addr>`.
- Slot page "back" → `/app`.
- `/app/collectives` → "Create Collective" → `/app/collectives/create`; its back-link → `/app/collectives`.
- Create a slot (or interrupt before submit) — the post-create redirect targets `/app`.

- [ ] **Step 6: Check the machine-readable surfaces**

```bash
curl -s localhost:3200/.well-known/farcaster.json | grep homeUrl
curl -s localhost:3200/robots.txt
curl -s localhost:3200/sitemap.xml | head -20
curl -s -o /dev/null -w "%{http_code}\n" localhost:3200/api/og
```

Expected: `homeUrl` ends `/app`; robots points at `0xslots.org/sitemap.xml`; sitemap contains `/app`; the OG route returns `200`.

- [ ] **Step 7: Check the adland CTA**

On a slot page with an ad in the ad-bar, hover the ad. Expected target: `/app/slots/<addr>`, not `/slots/<addr>`.

- [ ] **Step 8: Confirm nothing is staged**

```bash
cd /Users/nezzarkefif/Documents/GitHub/0xSlots
git status --short
```

`git mv`/`git rm` in Tasks 2 and 8 do stage their moves — unavoidable with those commands. For a fully clean index, run `git reset`, which unstages while keeping every file change.

**Do not commit.**

---

## Deferred — not in this plan

- **Re-signing the Farcaster account association.** Manual, at farcaster.xyz. Until done, the miniapp will not verify on `0xslots.org`.
- **DNS + host redirect** for `app.0xslots.org` → `0xslots.org`, with `/` → `/app` so existing explorer bookmarks land somewhere sensible.
- **Retiring vitrine's deploy target.**
- **Env vars** on the landing deployment: `NEXT_PUBLIC_APP_URL=https://0xslots.org`, plus `NEXT_PUBLIC_CMS_URL` and `NEXT_PUBLIC_CMS_CATEGORY` carried over from vitrine.
- **Design tokens.** `display` and `display-tight` no longer drive Archivo's width axis, so headlines render in Inter. Accepted for now; restoring a display face is a change to the two utilities in `globals.css`.
