# Clean slate: protocol v1

Every contract, deployment record, indexer start block and package version starts over.
No compatibility with anything deployed before.

## Goals

- Terms are one extensible shape, proposed with a bit mask, applied only at occupancy
  transitions after `TERMS_DELAY`.
- Hooks can take a fee of the rent, stored on the slot, never read from the hook.
- Storage is ERC-7201 namespaced per concern, so every group can grow in an upgrade.
- Everything restarts at `version() == 1`, under a new CREATE2 namespace.

## Storage

Each struct lives at its own ERC-7201 location.

| Namespace | Struct | Fields |
|---|---|---|
| `slots.settings` | `Settings` | `currency`, `manager`, `mutableTax`, `mutableRecipient`, `mutableHook` |
| `slots.terms.tax` | `TaxTerms` | `recipient`, `uint16 rateBps`, `uint32 minRunwaySeconds` |
| `slots.terms.hook` | `HookTerms` | `target`, `bytes32 config` |
| `slots.hook.offer` | `HookOffer` | `uint8 permissions`, `uint16 feeBps`, `feeRecipient` (copy taken at attach, updated on accept) |
| `slots.next.tax` | `TaxTerms` | queued copy |
| `slots.next.hook` | `HookTerms` | queued copy |
| `slots.queue` | `TermsQueue` | `uint8 mask`, `uint64 proposedAt`, `uint8 hookPermissions` |
| `slots.occupancy` | `Occupancy` | `occupant`, `since`, `tenureId`, `lastSettled`, `price`, `deposit` |
| `slots.ledger` | `Ledger` | `collectedTax`, `withdrawableOf`, `arrearsOf`, `operatorOf` |

Rule for upgrades: append fields at the end of a struct; never reorder, retype or
reuse a namespace string or a mask bit.

## Terms

```
TAX_RATE          = 1 << 0   TaxTerms.rateBps
RECIPIENT         = 1 << 1   TaxTerms.recipient
MIN_RUNWAY        = 1 << 2   TaxTerms.minRunwaySeconds
HOOK              = 1 << 3   all of HookTerms together
HOOK_PERMISSIONS  = 1 << 4   accepted hook permissions (never proposed)
```

- `proposeTerms(TaxTerms taxTerms, HookTerms hookTerms, uint8 mask)`: manager only. Validates
  only the masked fields, writes them to the queued copy, ORs the mask, restarts the
  clock. Each term reverts `NotMutable` unless the slot was created mutable for it
  (`mutableTax` covers tax and minimum runway).
- `cancelTerms(uint8 mask)`: clears whichever of those bits are queued; reverts only
  if none were.
- `_applyPending`: at buy, release and liquidate, once ripe. Pays out collected rent
  under the OUTGOING terms first, then copies the masked fields. The hook-read gas
  guard and fail-open detach are unchanged.
- `setManager(address)`: immediate, non-zero.
- Logic lives in `TermsLib`; adding a term is a field, a bit and two lines.

## Hook offer

- The hook declares it: `hookOffer(bytes32 config) returns (HookOffer { permissions, feeBps, feeRecipient })`.
  Permissions are `HookPermissionsLib` bits, so a new callback is a new bit, not a new field.
- The slot reads it when the hook is proposed (strict) and when it attaches (fail-open,
  gas-capped), and keeps a copy. Payouts and callbacks never call the hook for it.
- `_flush` splits `collectedTax`: `feeBps` to the fee recipient, the rest to `recipient`.
  Every apply flushes first, so the pot is always earned under the current terms.
- A hook changing its offer is an offer to accept. `hookOfferStatus()` returns
  `(accepted, offered, feeDiffers, permissionsDiffer)` and never reverts.
- `acceptHookOffer(HookOffer expected)`: manager only, pinned (`HookOfferChanged`),
  `NothingToAccept` when it would change nothing.
  - Fee: immediate, on any slot, after flushing under the old fee. It splits rent between
    recipient and hook and never changes what an occupant pays.
  - Permissions: they change what the hook may do to an occupant, so they queue under
    `HOOK_PERMISSIONS` for the next occupancy transition, and only when `mutableHook`. On an
    immutable hook they are frozen. At apply the hook is read again and permissions it no longer
    declares are dropped (`HookPermissionsDropped`). A queued `HOOK` supersedes them.
- A manager who never accepts risks the hook refusing service. The copy bounds which
  callbacks run and what fee is paid, not what the hook's code does inside them.

## Contracts

- Core: `Slot` (+ layers), `TermsLib`, `SlotFactory`.
- Hooks: `MinimumTenureHook`, `AdLand` (create params: owner = manager = recipient,
  `mutableHook: false`, moderation mode), `SlotBoundNFT`, `SlotBoundNFTWrapper`,
  `SlotBoundNFTFactory` (wrapper beacon set in `initialize`).
- Collectives: `SlotCollective`, `SlotCollectiveFactory`, `SlotGovernance` relay masks.
- Periphery: `OfferBook`.
- Deleted: `src/v1`, every v1 test and script, stale deployment records.

## Rollout

1. Contracts + tests (`forge test`).
2. `DeployProtocol` with a new CREATE2 namespace; deployment records wiped except
   `deployments/config`.
3. Codegen, SDK, indexer (new schema, start blocks from records).
4. Explorer and adland against the new ABI.
5. Deploy: local, Base Sepolia, Base. Then codegen and publish packages.
6. Publish `@adland/react` / `@adland/embed` with new hook addresses; notify publishers.
7. Recover funds on the retired contracts (URD, collectives, live slot deposits).

## Status (2026-09-17)

Done, uncommitted: steps 1–4 and the adland side of 6.

- Contracts rewritten; 465 tests pass. `DeployProtocol` uses namespace `0xslots.v1.2026-09`
  and sets AdLand's factory. Fork dry runs predict, on Base and Base Sepolia (these move if
  any contract code changes):
  - SlotFactory `0xfFB4C3959b4896aA127DAa6f6B9b3FAbd42D7DAf`
  - AdLand `0x47971a3308E448D7CE3ADe0AB8Eb9150892c25A4`
  - SlotCollectiveFactory `0xf8B1BEc9BF8E7010080EE1C050DC4871E5ee6c36`
  - SlotBoundNFTFactory `0x07eEfAc305c4adEBE482b009679D809928D63705`
  - SlotBoundNFTWrapper `0x3C6bB301e2A54717b984A72BabE1449469D74faC`
  - MinimumTenureHook `0x7E9D5E96b21b6D067C3121e5e476c88e84119E2D`
  - OfferBook `0xAF7363c3B42AFA2cF76C880D5e666d36a4605ae4`
- Local records (31337) written from a fresh anvil; deploy, seed and indexer verified end to end.
- SDK (72 tests), indexer, explorer, adland web/react/agent/api typecheck against the new ABI.
- Changesets: one major for `@0xslots/contracts` + `@0xslots/sdk`; minor for
  `@adland/react` + `@adland/embed` (new `DEFAULT_AD_HOOKS`).

Left: deploy (step 5), codegen and publish, adland config addresses (primary slot, mini
app slot, agent recipient) after creating the new primary, `@0xslots/mcp` (still on the
retired SDK root), the docs site, and step 7.
