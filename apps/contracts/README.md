# 0xSlots — Contracts

Foundry smart contracts for the 0xSlots protocol: partial common ownership
slots, where the occupant declares a price, pays continuous tax on it from a
deposit, and anyone may buy at that price.

The full model and API are in the docs site (`apps/docs`): *How a slot works*,
*Modules*, and the contract reference.

## Setup

```bash
cd apps/contracts
forge install   # lib/ holds git submodules and is not checked in
forge build
forge test
```

## Layout

```
src/
├── Slot.sol, slot/        # one position: occupancy, escrow, tax, terms, module calls
├── SlotFactory.sol        # UUPS factory; deploys slots behind one beacon
├── types/SlotTypes.sol    # SlotInit, TaxTerms, ModuleTerms, Manifest, Terms, PendingTerms
├── interfaces/            # ISlotModule, IDescribedModule, ISlotEvents
├── libraries/             # ScopesLib, TermsLib, SlotMath, ModuleSchemaLib
├── modules/               # MinimumTenureModule, AdLand, slot-bound NFTs, SettingsStore
├── periphery/book/        # OfferBook — standing bids and the fill
└── collectives/           # SlotCollective(Factory) — split recipient + role-gated manager
```

### Core

- **`Slot`** — one position, deployed as a beacon proxy. Tax accrues per second
  at `rateBps` basis points of the declared price per 30 days, and is settled at
  the start of every mutating call. Liquidation is unconditional unless the
  slot's module declares `strict`. Terms a manager queues wait `TERMS_DELAY`
  and land at the next buy — never under a sitting occupant who did not ask.
- **`SlotFactory`** — `createSlot(SlotInit)` and batch `collectAll`. Its admin
  can upgrade the beacon, which moves every slot at once, so slot storage is
  ERC-7201-namespaced and append-only.

### Modules

A slot installs at most one module, `ISlotModule`. `before` callbacks are views
that may revert to refuse a buy or a reprice; `after` callbacks are gas-capped
and swallowed unless the module declares `strict`. A module's `manifest`
declares the scopes it needs and an optional fee on collected tax; the slot keeps
its own copy, and the manager accepts changes with `grant`. Per-slot
configuration is the slot's `settings` word, checked by the module's
`checkSettings`.

Shipped modules:

- **`MinimumTenureModule`** — a protection window read from `settings`; buyouts
  inside it cost 10x.
- **`AdLand`** — sponsor creatives with optional moderation and a minimum
  tenure; configured through `SettingsStore`.
- **`SlotBoundNFT`** / **`SlotBoundNFTWrapper`** — an ERC-721 owned by whoever
  occupies its slot; created by `SlotBoundNFTFactory`.

`collectives/draft/` holds work in progress that is not deployed.

## Deploying

```bash
pnpm dev:local                 # from the repo root: anvil + deploy + indexer
pnpm protocol deploy --chain <name|id>
```

`script/protocol/DeployProtocol.s.sol` deploys everything with CREATE2 and
writes one record per contract to `deployments/<chainId>/`. Chain settings live
in [`deployments/config/`](deployments/config/README.md).
`script/slots/SeedSlots.s.sol` seeds a local chain with a test token and sample
slots.

## Security

Audit reports for earlier versions of the protocol:

- [K Security audit, Feb 2026](./Audit/2026-02-08-k-security-audit.md)
- [v2 security audit, Feb 2026](./Audit/2026-02-17-v2-security-audit.md)
- [v3 occupancy review, Jul 2026](./Audit/2026-07-29-v3-occupancy-review.md)

## Dependencies

- [OpenZeppelin Contracts](https://github.com/OpenZeppelin/openzeppelin-contracts)
  and [Upgradeable](https://github.com/OpenZeppelin/openzeppelin-contracts-upgradeable)
- [0xSplits](https://github.com/0xSplits/splits-contracts-monorepo)
- [Solady](https://github.com/vectorized/solady)
- [Forge Std](https://github.com/foundry-rs/forge-std)
