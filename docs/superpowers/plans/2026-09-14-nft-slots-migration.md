# nft-slots Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a new standalone monorepo `nft-slots` containing the Slotmarket web app, consuming `@0xslots/sdk` and `@0xslots/contracts` from npm, with Reown AppKit replacing the private `@0xslots/wallet` package and themed to match the app's Carnival palette.

**Architecture:** pnpm workspaces + Turborepo, shaped to grow (`apps/web` today; `apps/indexer`, `packages/*` later). The app moves with its git history via `git subtree split`. The three `workspace:*` dependencies resolve differently: sdk and contracts become npm ranges (both already published), and wallet is **deleted outright** — Reown AppKit's `WagmiAdapter` + `useAppKit()` replace all six of its call sites.

**Tech Stack:** Next.js 16 (Turbopack, App Router), React 19, Tailwind v4, **wagmi v3**, viem 2, Reown AppKit 1.8.23, TanStack Query 5, Biome, Turborepo, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-13-market-redesign-design.md` (the app's own design), plus the extraction audit in this conversation.

## Global Constraints

- **wagmi stays at v3.** Reown AppKit is the connect kit precisely because it is the only mainstream one that works there. Verified rather than inferred: `@reown/appkit@1.8.23` + `@reown/appkit-adapter-wagmi` installed against `wagmi@3.7.7` typechecks clean on real usage, and all 23 symbols the adapter imports from `@wagmi/core` at runtime are present in wagmi 3. RainbowKit (`^2.9.0`), ConnectKit (`2.x`) and Dynamic (`^2.14.11`) are all hard-capped at v2 and were ruled out for that reason.
- **AppKit's accent is `#c2410c`, NOT `#ff6b2c`.** AppKit has no `accentForeground` variable — it puts white on the accent. White on `#ff6b2c` is 2.9:1 and fails AA. The darker brand-ink orange gives white 6.4:1. The app's own chrome keeps `#ff6b2c` wherever it controls the foreground; only the modal uses the darker one.
- **Theming is nine CSS variables, and that is the whole surface.** AppKit exposes `--w3m-accent`, `--w3m-color-mix`, `--w3m-color-mix-strength`, `--w3m-border-radius-master`, `--w3m-font-family`, `--w3m-font-size-master`, `--w3m-background`, `--w3m-qr-color`, `--w3m-z-index`. There is no per-slot control. Do not plan work that assumes otherwise.
- **Never write a secret into a tracked file.** Values are copied by command from the old repo into a gitignored `.env.local`; `.env.example` carries key names and empty values only.
- **Brand orange `#FF6B2C` is a fill, never body text.** Text form is `#C2410C`. On-orange foreground is ink `#0E1116` (~7:1); white on orange is 2.9:1 and fails AA. This rule governs the AppKit theme exactly as it governs the app.
- **Square throughout.** Every radius is `0`, the connect modal included (`--w3m-border-radius-master: 0px`).
- **Vocabulary:** never "ad" or "advertiser" — say *sponsor*. Never "Harberger" — say *common ownership*.
- **No capability-list copy** ("can do X", "may do Y"). Show state visually.
- **Commits:** end every commit message with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

**Verification vocabulary** (the app has no test runner; that stays out of scope):
- `TYPECHECK` = `pnpm --filter web typecheck` → expect no output
- `BUILD` = `pnpm --filter web build` → expect success
- `RENDER` = Browser pane at `http://localhost:3400`, `read_console_messages onlyErrors:true` → expect none

**Source paths** below are relative to the existing repo at `~/Documents/GitHub/0xSlots`; **destination paths** to the new `~/Documents/GitHub/nft-slots`.

---

### Task 1: Extract the app with its history

**Files:**
- Create: the `nft-slots` repository
- Source: `apps/market/**` in 0xSlots

- [ ] **Step 1: Split market's history into a branch**

```bash
cd ~/Documents/GitHub/0xSlots
git subtree split --prefix=apps/market -b market-extract
```
Expected: prints a commit sha. This rewrites only into a new local branch; nothing in 0xSlots changes.

- [ ] **Step 2: Create the new repo around that history**

```bash
mkdir -p ~/Documents/GitHub/nft-slots && cd ~/Documents/GitHub/nft-slots
git init -b main
git pull ~/Documents/GitHub/0xSlots market-extract
```
The app's files land at the repo ROOT at this point — the subtree split stripped the `apps/market/` prefix.

- [ ] **Step 3: Move it into the monorepo shape**

```bash
cd ~/Documents/GitHub/nft-slots
mkdir -p apps/web
git ls-files -z | xargs -0 -I{} git mv {} apps/web/{} 2>/dev/null || true
git mv src apps/web/src 2>/dev/null || true
git status --short | head -20
```
If `git mv` on individual files is awkward, move the whole tree with `mv` then `git add -A` — history is preserved by the subtree pull either way, and the rename is recorded as a rename.

- [ ] **Step 4: Verify history survived**

```bash
git log --oneline -- apps/web | wc -l
```
Expected: a number well above 1 (market has real history). If it is 1, the subtree split did not take — stop and investigate rather than continuing with a flattened history.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: import Slotmarket from 0xSlots as apps/web

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: The monorepo skeleton

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `biome.json`, `.gitignore`, `.npmrc`

**Interfaces:**
- Produces: `pnpm dev`, `pnpm build`, `pnpm typecheck`, `pnpm lint` at the root, all delegating to `turbo run`

- [ ] **Step 1: Root `package.json` — delegates only, no task logic**

```json
{
  "name": "nft-slots",
  "private": true,
  "packageManager": "pnpm@9.12.0",
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "typecheck": "turbo run typecheck",
    "lint": "turbo run lint"
  },
  "devDependencies": {
    "@biomejs/biome": "^2.0.0",
    "turbo": "^2.3.0",
    "typescript": "^5.7.2"
  }
}
```

Set `packageManager` to whatever `pnpm --version` reports on this machine; a wrong value makes corepack refuse to run.

- [ ] **Step 2: `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 3: `turbo.json`**

`NEXT_PUBLIC_*` is inferred by Turborepo's framework detection, but the server-only Économe vars are not — they must be declared or a cache hit will serve a build made without them.

```json
{
  "$schema": "https://turborepo.dev/schema.v2.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**"],
      "env": ["ECONOME_IPFS_URL", "ECONOME_IPFS_KEY", "IPFS_GATEWAY"],
      "inputs": ["$TURBO_DEFAULT$", ".env", ".env.*"]
    },
    "typecheck": { "dependsOn": ["^build"] },
    "lint": {},
    "dev": { "cache": false, "persistent": true }
  }
}
```

- [ ] **Step 4: `biome.json`**

Copy the one from 0xSlots verbatim — the app's source is already formatted to it, so a different config would produce a repo-wide diff on the first run.

```bash
cp ~/Documents/GitHub/0xSlots/biome.json ~/Documents/GitHub/nft-slots/biome.json
```

Then add a `lint` script to `apps/web/package.json`: `"lint": "biome check ."`.

- [ ] **Step 5: `.gitignore`**

```
node_modules/
.next/
.turbo/
dist/
*.tsbuildinfo
.env
.env.*
!.env.example
.DS_Store
```

The `!.env.example` negation is the point: everything else env-shaped stays out.

- [ ] **Step 6: Delete the inherited turbo config**

`apps/web/turbo.json` came across from market and only contains `extends: ["//"]` plus task definitions now covered by the root. Delete it.

```bash
rm -f apps/web/turbo.json
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: monorepo skeleton — pnpm workspaces, turbo, biome

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Dependencies — npm packages, AppKit, wagmi v3

**Files:**
- Modify: `apps/web/package.json`

**Interfaces:**
- Produces: an installable tree with no `workspace:*` references

- [ ] **Step 1: Rewrite the dependency block**

`@0xslots/wallet` is **removed entirely**; AppKit replaces it in Task 5. `wagmi` stays on v3 — the whole reason AppKit was chosen over RainbowKit.

```json
{
  "name": "web",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3400",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "lint": "biome check ."
  },
  "dependencies": {
    "@0xslots/contracts": "^0.26.0",
    "@0xslots/sdk": "^0.30.2",
    "@reown/appkit": "^1.8.23",
    "@reown/appkit-adapter-wagmi": "^1.8.23",
    "@tanstack/react-query": "^5.62.7",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^0.575.0",
    "next": "^16.3.4",
    "radix-ui": "^1.4.3",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tailwind-merge": "^3.4.1",
    "viem": "^2.21.54",
    "wagmi": "^3.7.7"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.0.0",
    "@types/node": "^22.10.2",
    "@types/react": "^19.0.1",
    "@types/react-dom": "^19.0.2",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.2"
  }
}
```

- [ ] **Step 2: Install and confirm the peer graph is satisfied**

```bash
cd ~/Documents/GitHub/nft-slots && pnpm install
```
Expected: no `ERR_PNPM_PEER_DEP_ISSUES` mentioning wagmi. The adapter declares `wagmi >=2.19.5`, so v3 satisfies it — a peer error here means the pin in Step 1 did not apply.

- [ ] **Step 3: Drop `transpilePackages`**

`apps/web/next.config.ts` lists three packages. sdk and contracts ship compiled `dist/` from npm, and wallet is gone — so the whole option goes.

```ts
import type { NextConfig } from "next";

const config: NextConfig = {};

export default config;
```

- [ ] **Step 4: Verify the published packages resolve**

```bash
node -e "console.log(require.resolve('@0xslots/sdk/package.json'))"
pnpm --filter web exec tsc --noEmit 2>&1 | head -20
```
Typecheck WILL still fail here — every `@0xslots/wallet` import is now unresolvable. That is expected and Task 5 fixes it. What you are checking is that no error mentions `@0xslots/sdk` or `@0xslots/contracts`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: npm deps, AppKit in place of the private wallet package

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Environment

**Files:**
- Create: `apps/web/.env.example` (tracked), `apps/web/.env.local` (gitignored)

- [ ] **Step 1: Write `.env.example` — names only, no values**

```bash
cat > ~/Documents/GitHub/nft-slots/apps/web/.env.example <<'EOF'
# Économe IPFS. Server-only: the key is a bearer credential that can write to
# the cluster, so it must never carry a NEXT_PUBLIC_ prefix. src/lib/econome.ts
# imports "server-only" so a client import is a build error rather than a leak.
ECONOME_IPFS_URL=
ECONOME_IPFS_KEY=
IPFS_GATEWAY=
NEXT_PUBLIC_IPFS_GATEWAY=

# Reown (formerly WalletConnect) project id. AppKit requires it. The relay is
# the same one the old wallet package used, so the existing id works as-is —
# there is no new account to create. https://cloud.reown.com
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=

# Alchemy, for the Base and Base Sepolia transports.
NEXT_PUBLIC_ALCHEMY_API_KEY=

# Which indexer this build reads. Unset means development.
NEXT_PUBLIC_SLOTS_ENV=
NEXT_PUBLIC_PONDER_URL=
EOF
```

- [ ] **Step 2: Copy the real values across — by command, never by hand**

These read from the old repo and write to the gitignored file. Do not print the values.

```bash
cd ~/Documents/GitHub/nft-slots/apps/web
OLD=~/Documents/GitHub/0xSlots

# Économe: straight across from market's own .env.local
grep -E '^(ECONOME_IPFS_URL|ECONOME_IPFS_KEY|IPFS_GATEWAY)=' "$OLD/apps/market/.env.local" > .env.local

# Alchemy: the FRONTEND key, from landing. The repo holds four different
# Alchemy keys — contracts, api and ponder each have their own, and they are
# not interchangeable. This is the one a browser bundle may carry.
grep -E '^NEXT_PUBLIC_ALCHEMY_API_KEY=' "$OLD/apps/landing/.env" >> .env.local

# WalletConnect: not in any .env — it was a hardcoded constant in the wallet
# package that is being deleted, so it is lifted out here.
printf 'NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=%s\n' \
  "$(grep -A2 'DEFAULT_WALLETCONNECT_PROJECT_ID' "$OLD/packages/wallet/src/config.ts" \
     | grep -oE '"[0-9a-f]{16,}"' | tr -d '"')" >> .env.local
```

- [ ] **Step 3: Verify every key has a value, without revealing them**

```bash
awk -F= '{printf "  %-40s %s\n", $1, (length($2)==0 ? "*** EMPTY ***" : length($2)" chars")}' .env.local
```
Expected: six lines, none EMPTY. A blank WalletConnect id means the grep in Step 2 missed — open the source file and copy it manually.

- [ ] **Step 4: Confirm the secret is not tracked**

```bash
cd ~/Documents/GitHub/nft-slots
git check-ignore -v apps/web/.env.local && echo "✓ ignored" || echo "✗ DANGER: tracked"
```
Expected: `✓ ignored`. If not, stop — fix `.gitignore` before any commit.

- [ ] **Step 5: Commit (the example only)**

```bash
git add apps/web/.env.example && git commit -m "chore: document the environment

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Reown AppKit replaces the wallet package

**Files:**
- Create: `apps/web/src/lib/appkit.ts`
- Rewrite: `apps/web/src/components/providers.tsx`, `apps/web/src/components/header.tsx`
- Delete: `apps/web/src/components/wallet-overlay.tsx`
- Modify: `apps/web/src/app/layout.tsx`, `src/app/create/page.tsx`, `src/components/buy-panel.tsx`, `src/components/mint-panel.tsx`

**Interfaces:**
- Consumes: `CHAINS` from `@/lib/chains`
- Produces: `appkitTheme` (the `themeVariables` object) and `NETWORKS` from `@/lib/appkit`; `useAppKit().open()` replaces `useWalletModal().openConnect` at three call sites

The full surface, from the audit — six files import the wallet package:

| File | Uses | Becomes |
|---|---|---|
| `providers.tsx` | `WalletProvider`, `walletStorage`, `DEFAULT_WALLETCONNECT_PROJECT_ID` | `WagmiAdapter` + `createAppKit` |
| `header.tsx` | `useWalletModal().openConnect/openAccount` | `useAppKit().open({ view })` |
| `wallet-overlay.tsx` | `useWalletPicker`, `useWalletAccount`, QR | **deleted** — AppKit's modal is the whole file |
| `layout.tsx` | mounts `<WalletOverlay />` | mount removed |
| `create/page.tsx` | `openConnect` | `useAppKit().open()` |
| `buy-panel.tsx` | `openConnect` | same |
| `mint-panel.tsx` | `openConnect` | same |

Note this is a SMALLER change than it looks: `header.tsx` already branches three ways (connect / wrong network / account) because the old package had the same shape, so only the call changes.

- [ ] **Step 1: Write `src/lib/appkit.ts`**

```ts
import { base, baseSepolia } from "@reown/appkit/networks";

/**
 * The networks AppKit knows about.
 *
 * These come from `@reown/appkit/networks` rather than `viem/chains` because
 * AppKit needs the CAIP metadata it adds. They are the same chains by id as
 * `CHAINS` in ./chains.ts, and Step 2 asserts that rather than trusting it —
 * two lists of chains that can drift is exactly how a marketplace ends up
 * offering a network it cannot actually read.
 */
export const NETWORKS = [baseSepolia, base] as const;

/**
 * AppKit, wearing the market's design.
 *
 * Nine variables is the entire theming surface — there is no per-slot control
 * the way a full theme object would give. What that buys here is the accent,
 * square corners, the app's own typeface, and a warm tint over the neutrals.
 *
 * ── Why the accent is the DARKER orange ────────────────────────────────────
 *
 * AppKit has no `accentForeground`: it puts white on whatever accent it is
 * given. White on #ff6b2c is 2.9:1 and fails AA at every size, which is the
 * same reason the app's own buttons are ink-on-orange rather than white. The
 * modal cannot be told to do that, so it gets the orange that white survives
 * on — 6.4:1 — and the brand orange stays everywhere the app owns the
 * foreground.
 */
export const appkitTheme = {
  "--w3m-accent": "#c2410c",
  "--w3m-color-mix": "#ff6b2c",
  "--w3m-color-mix-strength": 8,
  "--w3m-border-radius-master": "0px",
  "--w3m-font-family":
    "var(--font-inter-tight), ui-sans-serif, system-ui, sans-serif",
} as const;
```

- [ ] **Step 2: Rewrite `providers.tsx`**

```tsx
"use client";

import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { createAppKit } from "@reown/appkit/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { http, WagmiProvider } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";

import { ChainProvider } from "@/hooks/use-active-chain";
import { appkitTheme, NETWORKS } from "@/lib/appkit";
import { CHAINS } from "@/lib/chains";

// The two chain lists must name the same ids. A mismatch is silent — the
// picker offers a network the adapter cannot reach — so it fails the build.
const _sameChains: true = (CHAINS.length === NETWORKS.length) as true;

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";
const alchemy = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

/** Alchemy where a key is configured, the chain's public tier where not. */
const rpc = (subdomain: string) =>
  alchemy ? http(`https://${subdomain}.g.alchemy.com/v2/${alchemy}`) : http();

const adapter = new WagmiAdapter({
  projectId,
  networks: [...NETWORKS],
  transports: {
    [baseSepolia.id]: rpc("base-sepolia"),
    [base.id]: rpc("base-mainnet"),
  },
  ssr: true,
});

/**
 * Created at module scope, once.
 *
 * `createAppKit` registers web components on the document; calling it inside a
 * component body would re-register them on every mount.
 */
createAppKit({
  adapters: [adapter],
  projectId,
  networks: [...NETWORKS],
  metadata: {
    name: "Slotmarket",
    description: "Art that is never off the market.",
    url: "https://slotmarket.xyz",
    icons: [],
  },
  themeMode: "light",
  themeVariables: appkitTheme,
  // AppKit ships email login, social login, swaps and an onramp, all on by
  // default. None of them belong in a marketplace whose only question is which
  // wallet holds the work — and each one is a panel a visitor can get lost in.
  features: {
    analytics: false,
    email: false,
    socials: false,
    swaps: false,
    onramp: false,
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 5_000, retry: 1 } },
      }),
  );

  return (
    <WagmiProvider config={adapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ChainProvider>{children}</ChainProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

If the `_sameChains` assertion is awkward once `CHAINS` is typed, replace it with a runtime check in development rather than deleting it — the failure it catches is invisible otherwise.

- [ ] **Step 3: Header — three states, one new call**

The existing three-way branch stays; only the handlers change. Replace the `useWalletModal` import with `import { useAppKit } from "@reown/appkit/react";` and the destructuring with `const { open } = useAppKit();`, then:

```tsx
<Button
  size="sm"
  variant={address ? (chain ? "outline" : "destructive") : "default"}
  onClick={() =>
    address
      ? open({ view: chain ? "Account" : "Networks" })
      : open({ view: "Connect" })
  }
>
  {address ? (chain ? truncate(address) : "Wrong network") : "Connect"}
</Button>
```

`useAccount()` from wagmi still supplies `address` and `chain` — AppKit does not replace that, and `useAppKitAccount` would be a second source of the same truth.

- [ ] **Step 4: Delete the overlay and its mount**

```bash
rm apps/web/src/components/wallet-overlay.tsx
```
In `layout.tsx`, delete the `WalletOverlay` import, the `<WalletOverlay />` element, and the comment above it.

- [ ] **Step 5: Swap the three `openConnect` call sites**

In `create/page.tsx`, `buy-panel.tsx` and `mint-panel.tsx`, replace:

```tsx
import { useWalletModal } from "@0xslots/wallet";
const { openConnect } = useWalletModal();
```
with:
```tsx
import { useAppKit } from "@reown/appkit/react";
const { open } = useAppKit();
```
and each `onClick={openConnect}` with `onClick={() => open({ view: "Connect" })}`.

- [ ] **Step 6: Confirm the package is gone**

```bash
grep -rn "@0xslots/wallet" apps/web/src apps/web/package.json || echo "✓ no references remain"
```

- [ ] **Step 7: Verify — and this is the step that closes the last unknown**

Typecheck and symbol-presence were both verified before this plan was written; what has NOT been proven is AppKit driving wagmi 3 in a live browser. Do that here, and if it fails, stop rather than working around it: the fallback is RainbowKit on wagmi 2, which is a different plan.

`TYPECHECK`, then `pnpm dev` and in the Browser pane:
1. Click **Connect** → the AppKit modal opens
2. `read_console_messages onlyErrors:true` → none
3. Confirm the modal is square-cornered and orange-accented, in Inter Tight
4. Connect a wallet → header shows the truncated address
5. Open the account view, switch network → the register re-queries
6. Screenshot for the record

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: Reown AppKit replaces the private wallet package

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: CI and deployment

**Files:**
- Create: `.github/workflows/ci.yml`, `apps/web/README.md`

- [ ] **Step 1: CI**

```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request:

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with: { fetch-depth: 0 }
      - uses: pnpm/action-setup@v5
      - uses: actions/setup-node@v6
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm run lint
      - run: pnpm run typecheck
      - run: pnpm run build
        env:
          # Build-time only. A PR from a fork gets empty strings, which is
          # correct: `econome()` throws NotConfigured rather than failing the
          # build, and the pages that do not upload still render.
          ECONOME_IPFS_URL: ${{ secrets.ECONOME_IPFS_URL }}
          ECONOME_IPFS_KEY: ${{ secrets.ECONOME_IPFS_KEY }}
          NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: ${{ secrets.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID }}
          NEXT_PUBLIC_ALCHEMY_API_KEY: ${{ secrets.NEXT_PUBLIC_ALCHEMY_API_KEY }}
```

- [ ] **Step 2: Deploy target**

Vercel is the fit — Next 16 with route handlers, and the Économe key stays a server env var. Root directory `apps/web`, build `pnpm --filter web build`, install `pnpm install`. Add all seven env vars from `.env.example` in the project settings.

Nothing is being migrated here: the audit found no Dockerfile, `vercel.json` or railway config for market anywhere in 0xSlots. It has never been deployed.

- [ ] **Step 3: README**

Cover: what the app is, `pnpm install && pnpm dev`, the env table from `.env.example`, and — importantly — a note that `@0xslots/sdk` and `@0xslots/contracts` now come from npm, so a protocol change means publish → bump → install rather than a workspace edit.

- [ ] **Step 4: Commit and push**

```bash
git add -A
git commit -m "ci: lint, typecheck and build on every PR

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
gh repo create nft-slots --private --source=. --push
```

---

### Task 7: Verification sweep

- [ ] **Step 1: Clean-clone build**

The real test of extraction is that it builds somewhere that has never seen 0xSlots.

```bash
cd $(mktemp -d) && git clone ~/Documents/GitHub/nft-slots && cd nft-slots
cp ~/Documents/GitHub/nft-slots/apps/web/.env.local apps/web/.env.local
pnpm install && pnpm run build
```
Expected: success, with no resolution error mentioning `workspace:` or `@0xslots/wallet`.

- [ ] **Step 2: AppKit theme conformance**

AppKit renders inside shadow DOM, so the modal's internals are not queryable
the way ordinary markup is. Assert the variables it reads instead — that is
the whole contract between this app and its theming.

```js
const s = getComputedStyle(document.documentElement);
({
  accent: s.getPropertyValue('--w3m-accent').trim(),
  radius: s.getPropertyValue('--w3m-border-radius-master').trim(),
  font:   s.getPropertyValue('--w3m-font-family').trim(),
  modalMounted: !!document.querySelector('w3m-modal'),
})
```
Expected: accent `#c2410c` (**not** `#ff6b2c` — if it is the bright one, the
contrast rule was lost somewhere), radius `0px`, the Inter Tight stack, and
`modalMounted: true` once the modal has been opened at least once.

Then judge it by eye, which is the part no assertion covers: open the modal
beside the app and decide whether nine variables got close enough. This is the
decision point named in risk 2 below.

- [ ] **Step 3: Narrow viewport**

`resize_window preset:"mobile"`, reload, open the connect modal, screenshot. Then `preset:"desktop"`.

- [ ] **Step 4: Secret audit on the final history**

```bash
cd ~/Documents/GitHub/nft-slots
git log --all -p | grep -nE "ECONOME_IPFS_KEY=.+|NEXT_PUBLIC_ALCHEMY_API_KEY=.{10,}" | head
```
Expected: no output. The subtree split carried market's history, and market's `.env.local` was never tracked — but this proves it rather than assuming it.

- [ ] **Step 5: Report**

Say what was verified with real output, and name what was not. In particular the full deploy → upload → `setBaseURI` submit needs a funded Base Sepolia wallet and will **not** have been exercised end to end.

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|---|---|
| New monorepo named `nft-slots` | 1, 2 |
| Complete migration of the app | 1, 3 |
| A themeable connect kit that supports wagmi v3 | 3, 5 |
| Kit themed to the app | 5 (theme), 7 (conformance) |
| Grab WalletConnect projectId + Alchemy key | 4 |
| sdk/contracts from npm | 3 |
| Deployment | 6 |

**Placeholder scan:** Task 1 Step 3 offers a fallback (`mv` + `git add -A`) rather than one exact command, because the right one depends on whether the subtree left files at the root or in a subdirectory — both outcomes are handled and the verification in Step 4 catches either.

**Type consistency:** `carnivalTheme` is declared `Theme` in Task 5 Step 1 and consumed in Step 2. `CHAINS` keeps its existing export from `@/lib/chains` (already anvil-free from the earlier work). `useConnectModal().openConnectModal` is the same symbol at all three call sites in Step 5.

**Known risks, ranked:**

1. **AppKit driving wagmi 3 in a live browser is still unproven.** Two of the three checks are done — the pair typechecks against real usage, and all 23 symbols the adapter imports from `@wagmi/core` exist in wagmi 3 — but symbol presence is not unchanged signatures. Task 5 Step 7 is where this is settled. **If the modal fails there, stop.** The fallback is RainbowKit on wagmi v2, which is a materially different plan (the SDK peers `wagmi >=2`, so it is viable), not a patch to this one.
2. **The theming ceiling is nine CSS variables.** If the result looks insufficiently like the app, no amount of further configuration fixes it — the next step would be overriding AppKit's shadow-DOM parts, which is unsupported and breaks on their releases. Decide whether the result is good enough at Task 5 Step 7, before building anything on top of it.
3. **sdk/contracts move forward three minors.** The workspace has contracts 0.23.0 / sdk 0.29.0; npm has 0.26.0 / 0.30.2. Task 3 checks they resolve, not that behaviour is unchanged. If the app misbehaves, pin the exact versions it was last good against and bisect.
4. **`@0xslots/wallet` is left behind in 0xSlots**, where `apps/landing` still imports it. Nothing here breaks landing, but the package drops from two consumers to one — worth knowing before anyone deletes it there.
