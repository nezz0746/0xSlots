# 0xSlots

![0xSlots Banner](banner.png)

**Modular & Immutable Collective Ownership Slots** — Perpetual onchain real estate powered by partial common ownership. Native ETH or any ERC-20.

Every slot has a price. Holders self-assess and pay continuous tax. Anyone can buy any slot at the posted price. Resources flow to whoever values them most.

## How it works

1. **Self-assessment** — Slot holders set their own price
2. **Continuous tax** — Pay tax proportional to your assessed price, deducted linearly from a deposit
3. **Always for sale** — Anyone can force-buy at the posted price, instantly
4. **No squatting** — Holding costs money. Insolvent occupants get liquidated

## Architecture

```
0xSlots/
├── apps/
│   ├── contracts/       # Foundry smart contracts (Solidity)
│   ├── landing/         # Next.js app — marketing at /, explorer at /app/*
│   ├── docs/            # Vocs documentation site
│   └── api/             # Supporting API
├── packages/
│   ├── contracts/       # Published ABIs & addresses (@0xslots/contracts)
│   ├── sdk/             # Type-safe protocol SDK (@0xslots/sdk)
│   ├── ponder/          # GraphQL indexer (@0xslots/ponder)
│   ├── protocol/        # Deploy & upgrade CLI (pnpm protocol)
│   ├── config/          # Shared configuration
│   └── mcp/             # MCP server
```

**Monorepo:** pnpm workspaces + Turborepo

## Contracts

| Contract | Purpose |
|----------|---------|
| **Slot** | Core primitive — occupancy, pricing, deposits, tax, liquidation |
| **SlotFactory** | UUPS-upgradeable factory deploying Slots behind one beacon |
| **OfferBook** | Standing bids; the occupant accepts one to sell |
| **SlotCollective** | Splits payout + role-gated management for a slot's terms |
| **SlotCollectiveFactory** | Mints collectives behind one upgradeable beacon |
| **MinimumTenureModule** | Module — a minimum holding window, one deployment for every duration |
| **AdLand** | Module — sponsor creatives, moderation and an optional minimum tenure |
| **SlotBoundNFTFactory** | Slot-bound NFT collections and a wrapper for existing ERC-721s |

A slot installs at most one **module** (`ISlotModule`) — the single extension
point. Its `before` callbacks may refuse a buy or a reprice; its `after`
callbacks are told what happened, gas-capped and unable to block anything unless
the module declares `strict`. The module's manifest lists the scopes it needs
and any fee it takes, and the slot keeps its own copy.

Slots are immutable by default. Tax, recipient and module are each optionally
mutable by a manager — three independent flags, because they are three
different promises. Changes are queued, not applied: they land at the next buy
after a one-day delay, so terms cannot shift under someone mid-tenancy.

See [apps/contracts/README.md](apps/contracts/README.md) and the
[docs](apps/docs) for the full picture.

Audit reports for earlier versions of the protocol are in
[apps/contracts/Audit](apps/contracts/Audit).

## Frontend

Next.js 16 · React 19 · TailwindCSS 4 · wagmi 3 · viem 2 · RainbowKit · shadcn/ui

| Feature | Description |
|---------|-------------|
| **Explorer** | Tabbed dashboard — Slots, Recipients, Modules, Events |
| **Collectives** | Create and govern a shared payout + role-gated manager |
| **Create Slot** | Multi-step stepper with ENS resolution, currency selection and a module picker |
| **Slot Detail** | Tabbed view — Details, Activity, Manage. Buy section with deposit slider |
| **EIP-5792** | Atomic batching (approve + buy in one prompt) when wallet supports it |
| **Profile** | Slots as recipient & occupant for connected wallet |
| **Toasts** | Transaction success/error notifications via Sonner |

## NPM Packages

| Package | Version | Description |
|---------|---------|-------------|
| [@0xslots/contracts](https://www.npmjs.com/package/@0xslots/contracts) | [![npm version](https://img.shields.io/npm/v/@0xslots/contracts.svg)](https://www.npmjs.com/package/@0xslots/contracts) | Contract ABIs and addresses for use with viem |
| [@0xslots/sdk](https://www.npmjs.com/package/@0xslots/sdk) | [![npm version](https://img.shields.io/npm/v/@0xslots/sdk.svg)](https://www.npmjs.com/package/@0xslots/sdk) | Type-safe SDK for reads and writes |

## Deployments

The current protocol is not deployed on a public chain yet; it runs locally with
`pnpm dev:local`. Addresses are generated into `@0xslots/contracts` from
`apps/contracts/deployments/<chainId>/*.json` — import them rather than copying
one. See [the deployments docs](apps/docs/docs/pages/deployments.mdx).

### Indexer

Lists and history come from a [Ponder](https://ponder.sh) deployment — one
instance serving every chain, which is why `chainId` is a query filter rather
than an endpoint. See [packages/ponder](packages/ponder/README.md). It indexes
the core protocol and one module: AdLand's creatives, because what a sponsor
slot is showing lives nowhere else.

## Development

```bash
# Install dependencies
pnpm install

# Run frontend
pnpm dev:landing

# Build everything
pnpm build

# Lint & format
pnpm check
pnpm format
```

### Contracts (Foundry)

```bash
cd apps/contracts
forge build
forge test
```

## Built with

Foundry · Solidity · OpenZeppelin · 0xSplits · Ponder · Next.js · wagmi · viem · RainbowKit · TailwindCSS · Turborepo

## Links

- [Website](https://0xslots.org)
- [Docs](https://docs.0xslots.org)
- [GitHub](https://github.com/adcommune/0xSlots)

---

*by [adcommune](https://github.com/adcommune)*
