# 0xSlots — Contracts

Foundry smart contracts for the 0xSlots protocol: partial common ownership
slots, where the occupant declares a price, pays continuous tax on it from a
deposit, and anyone may buy at that price.

## Setup

```bash
cd apps/contracts
forge install   # lib/ holds git submodules and is not checked in
forge build
forge test
```

## Architecture

### Core

- **`Slot.sol`** — one slot, one contract, deployed as a BeaconProxy. Holds the
  occupant, the declared price, the deposit and the tax accounting. Tax accrues
  per second at `taxPercentage` basis points per 30 days and is charged against
  the deposit at the start of every mutating call — nothing runs on a timer, and
  a charge is capped by the remaining deposit.
- **`SlotFactory.sol`** — UUPS-upgradeable factory. Deploys slots behind one
  shared beacon, so `upgradeBeacon` moves every slot at once and storage is
  strictly append-only. Also holds the informational verified-utility and
  verified-policy registries.
- **`SlotCollective.sol`** — a 0xSplits PushSplit wearing a role-gated control
  panel. Fills both of a slot's named addresses: `recipient` (tax flows to it)
  and `manager` (it may propose changes). Ownership is bound to the contract
  itself and cannot move — that is what makes the inherited `execCalls`
  unreachable and the roles meaningful.
- **`SlotCollectiveFactory.sol`** — mints collectives from one implementation
  behind an upgradeable beacon, mirroring `SlotFactory`.

### The two pluggable contracts

A slot can plug in exactly two things, and they are deliberately asymmetric.

| | Answers | On failure |
| --- | --- | --- |
| **Utility** (`IUtility`) | what holding the slot *grants* | fails **open** — hooks are gas-capped and reverts are swallowed |
| **Occupancy policy** (`IOccupancyPolicy`) | *who* may hold it, and when | fails **closed** — a revert blocks the action |

A broken utility degrades to a slot that grants nothing; it can never block a
buy, a release or a liquidation. A policy answers yes or no and nothing else —
it can never move funds, change the price or redirect the buyer.

Both describe themselves through **`IModuleMetadata`** (`name`, `version`,
`metadataURI`). That inheritance narrows each child's ERC-165 id to its own
behaviour, so `SlotFactory.setUtilityVerified` and `setPolicyVerified` assert
*both* ids — checking one alone would verify a contract that cannot describe
itself.

`ISlotsModule` is the former name for `IUtility`, kept as an ABI-identical alias
so existing utilities keep compiling.

### Utility hooks

```solidity
function onTransfer(uint256 slotId, address from, address to) external;
function onPriceUpdate(uint256 slotId, uint256 oldPrice, uint256 newPrice) external;
function onRelease(uint256 slotId, address from) external;
function onSettle(uint256 slotId, address occupant, uint256 owed, uint256 paid) external;
```

`slotId` is always `0` — one slot is one contract, so the caller is `msg.sender`.

`onSettle` is the economic hook and the only one that reports money moving.
`paid` is capped by the remaining deposit and is the sound basis for accounting;
`owed - paid` is non-zero exactly when the occupant has run dry. It fires
mid-transaction, from inside the settle that begins every mutating call, so
treat anything read there as in flux.

Because utility calls are swallowed on failure, a utility must never be the
source of truth for anything financial. Reduce over the `TaxPaid` event, which
always fires.

### Shipped utilities and policies

- **`MetadataModule`** — a URI and structured metadata per slot, set by the
  occupant, cleared on release.
- **`FeedPostModule`**, **`FeedRouter`**, **`FeedSocialGroup`** — posting rights
  into a feed.
- **`MinimumTenurePolicy`** — requires the whole window's tax up front and
  blocks buy-outs before it elapses; also blocks price cuts while protected.
- **`MinimumPricePolicy`** — a price floor, bound to a currency because the
  floor is a bare integer whose meaning depends on the token's decimals.

Policies are immutable and deployed per set of terms at a CREATE2 address
derived from those terms, by a factory implementing `IPolicyFactory` — so a
client can ask any factory "did you make this?" without per-kind knowledge.

### Peripherals

- **`BatchCollector.sol`** — collect tax from many slots in one transaction.
- **`ERC721Slots.sol`** / **`ERC721SlotsFactory.sol`** — ERC-721 wrapper.

## Deploying

```bash
forge script script/DeployLocal.s.sol   # local anvil, pinned addresses
forge script script/SeedLocal.s.sol     # test token + sample slots
```

`LocalBootstrap.sol` explains why the local addresses survive edits to the
Solidity, which a plain CREATE2 would not — CREATE2 hashes the init code and so
moves whenever the contract changes.

From the repo root, `pnpm dev:local` runs a chain, deploys and indexes in one go.

## Security

- [K Security audit, Feb 2026](./Audit/2026-02-08-k-security-audit.md)
- [v2 security audit, Feb 2026](./Audit/2026-02-17-v2-security-audit.md)
- [v3 occupancy review, Jul 2026](./Audit/2026-07-29-v3-occupancy-review.md)

## Dependencies

- [OpenZeppelin Contracts](https://github.com/OpenZeppelin/openzeppelin-contracts)
  and [Upgradeable](https://github.com/OpenZeppelin/openzeppelin-contracts-upgradeable)
- [0xSplits](https://github.com/0xSplits/splits-contracts-monorepo)
- [Solady](https://github.com/vectorized/solady)
- [Forge Std](https://github.com/foundry-rs/forge-std)
