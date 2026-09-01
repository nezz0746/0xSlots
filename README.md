# 0xSlots

![0xSlots Banner](banner.png)

**Modular & Immutable Collective Ownership Slots** — Perpetual onchain real estate powered by partial common ownership and Harberger tax. Any ERC-20.

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
│   ├── ponder/          # The indexer the SDK reads (@0xslots/ponder)
│   ├── subgraph/        # Legacy The Graph indexing
│   ├── config/          # Shared configuration
│   └── mcp/             # MCP server
```

**Monorepo:** pnpm workspaces + Turborepo

## Contracts

| Contract | Purpose |
|----------|---------|
| **Slot** | Core primitive — occupancy, pricing, deposits, tax, liquidation |
| **SlotFactory** | UUPS-upgradeable factory deploying Slots via Beacon proxy |
| **SlotCollective** | Splits payout + role-gated governance for a slot's tax |
| **SlotCollectiveFactory** | Mints collectives behind one upgradeable beacon |
| **MetadataModule** | UUPS-upgradeable utility storing metadata per slot |
| **MinimumTenurePolicy** | Occupancy policy — a minimum holding window |
| **MinimumPricePolicy** | Occupancy policy — a price floor, per currency |
| **BatchCollector** | Collect tax from multiple slots in one transaction |

A slot plugs in exactly two things, deliberately asymmetric: a **utility**
(`IUtility` — what holding it grants, fails open) and an **occupancy policy**
(`IOccupancyPolicy` — who may hold it, fails closed). Both describe themselves
through `IModuleMetadata`.

Slots are immutable once deployed. Tax rate, utility and policy are set at
creation and each is optionally mutable by the manager — three independent flags,
because they are three different promises. Changes are proposed, not applied:
they take effect at the next occupancy change, so terms cannot shift under
someone mid-tenancy.

See [apps/contracts/README.md](apps/contracts/README.md) for the full picture.

**Security:** Audited by K Security (Feb 2026)

## Frontend

Next.js 16 · React 19 · TailwindCSS 4 · wagmi 3 · viem 2 · RainbowKit · shadcn/ui

| Feature | Description |
|---------|-------------|
| **Explorer** | Tabbed dashboard — Slots, Recipients, Utilities, Events |
| **Collectives** | Create and govern a shared payout + role-gated manager |
| **Create Slot** | Multi-step stepper with ENS resolution, currency selection, utility and policy pickers |
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

`packages/contracts/src/addresses.ts` is the source of truth — import from
`@0xslots/contracts` rather than copying an address.

| Contract | Base (8453) | Base Sepolia (84532) |
|----------|-------------|----------------------|
| SlotFactory | `0xbf2F890E8F5CCCB3A1D7c5030dBC1843B9E36B0e` | `0x6D87C1647f228Baf8DE0374FCd7FdEBF6900fdFF` |
| SlotCollectiveFactory | — | `0x03825eA2529e9eA2d5aDFf9DBc3773cDE61Da43d` |
| MinimumTenurePolicyFactory | `0x6C90Ca1A6ac6bBC0e4B48cc3CF589F6A3c2b30a5` | `0x2a399E4D93d9b7Ffa8367894A39859013B214E4a` |
| MinimumPricePolicyFactory | `0xFA64C88960c0aaC55279d42131A5B7fB57e0Ff1A` | `0x958088c4Afb2cf3E4c7C23560B57fCb64dfC6551` |
| BatchCollector | — | `0xd3c7090C2F89c5132C3f91DD1da4bCffEAe10e13` |

Local anvil (31337) addresses are pinned by `apps/contracts/script/DeployLocal.s.sol`.

Superseded policy factories stay listed in `POLICY_FACTORIES` so existing
policies keep resolving — see [the deployments docs](apps/docs/docs/pages/deployments.mdx).

### Indexer

Reads come from a [Ponder](https://ponder.sh) deployment — one instance serving
every chain, which is why `chainId` is a query filter rather than an endpoint.
See [packages/ponder](packages/ponder/README.md). `packages/subgraph` still
exists but is no longer what the SDK queries.

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
