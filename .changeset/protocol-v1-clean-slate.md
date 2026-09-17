---
"@0xslots/contracts": major
"@0xslots/sdk": major
---

Protocol v1: a clean-slate redeploy of every contract, at new addresses, with every `version()` back at 1. Nothing is compatible with the previous deployment.

**Terms.** A slot's terms are `TaxTerms { recipient, rateBps (uint16), minRunwaySeconds (uint32) }` and `HookTerms { target, config }`. `SlotInit` is `{ currency, manager, mutableTax, mutableRecipient, mutableHook, taxTerms, hookTerms }`; a manager is required exactly when something is mutable.

- `proposeTerms(TaxTerms, HookTerms, uint8 mask)` queues any combination of `TERM_TAX_RATE | TERM_RECIPIENT | TERM_MIN_RUNWAY | TERM_HOOK`, each allowed only if the slot was created mutable for it (`mutableTax` covers the tax rate and minimum runway). `TERM_HOOK_PERMISSIONS` is queued only by accepting a hook's offer. `cancelTerms(uint8 mask)` clears whichever of those are queued. Everything lands at the next occupancy transition once `TERMS_DELAY` has passed.
- `setManager(address)` hands over immediately.
- Views: `terms()` (`Terms { taxTerms, hookTerms, hookOffer }`), `pendingTerms()` (`PendingTerms { taxTerms, hookTerms, hookPermissions, mask, proposedAt, ripe }`), `taxTerms()`, `hookTerms()`, `hookOffer()`, `hookOfferStatus()`, `mutableTax()`, `mutableRecipient()`, `mutableHook()`, `taxRateBps()`, `minRunwaySeconds()`, `hookPermissions()`, and `getSlotInfo()` with grouped `terms` and `pending`. `Initialized`, `TermsProposed`, `TermsCancelled` and `TermsApplied` carry the structs and mask.

**Hook offers.** A hook declares what it asks of a slot in `hookOffer(bytes32 config) returns (HookOffer { permissions, feeBps, feeRecipient })`: its permissions (callbacks, and `strict`) as `HookPermissionsLib` bits, and a share of rent. The slot reads the offer when the hook is proposed and when it attaches, keeps its own copy, and pays the fee share of collected rent on every payout (`HookFeePaid`). Payouts and callbacks never read the hook's current answer.

- A hook changing its offer is an offer to accept: `hookOfferStatus()` returns `(accepted, offered, feeDiffers, permissionsDiffer)`.
- The manager takes it with `acceptHookOffer(HookOffer expected)`, which reverts `HookOfferChanged` unless the hook still offers exactly `expected`, and `NothingToAccept` if it would change nothing (`HookOfferAccepted(offer, feeApplied, permissionsQueued)`).
- A new fee applies at once on any slot, after paying out earned rent under the old fee: it never changes what an occupant pays.
- New permissions queue under `TERM_HOOK_PERMISSIONS` for the next occupancy transition, only when the hook is mutable. At that transition the hook is read again; permissions it no longer declares are dropped (`HookPermissionsDropped`). A queued `TERM_HOOK` supersedes them.
- Hooks validate configuration in `validateHookConfig(bytes32)`.

**Debt.** Tax an occupant's deposit could not cover is `debtOf(account)` (`DebtRepaid` when paid). It is paid out of the account's next buy of the slot, out of the price when the account is bought out, and out of a top-up before it funds the deposit.

**Hardening.** Settling rounds the paid seconds up, so settling every block charges what settling once does. A currency that delivers less than it transfers reverts with `CurrencyTakesACut`. `OfferBook.acceptOffer(slot, id, minPrice)` pins the lowest accepted price. Hook re-entry bars are written only by the slot itself (`MinimumTenure.NotTheSlot`), and AdLand records them on release and liquidation for slots with a tenure window.

**Storage.** Every concern lives at its own ERC-7201 location, so each group can grow in an upgrade.

**Indexer.** Slot columns follow the contract: `taxRateBps`, `minRunwaySeconds`, `mutableTax`, `perm*` for accepted permissions, `pendingTaxRateBps`, `pendingHasTaxRate`, `pendingMinRunwaySeconds`, `pendingHasMinRunway`, `pendingHookPermissions`, `pendingHasHookPermissions`. `debtRepaidTotal` on the slot and a `debt_repaid_event` table record every `DebtRepaid`.

**AdLand.** Moderation (`setModerationMode`, `approveCreative`, `rejectCreative`, `moderationOf`), a key registry, and `createAdSlot` / `createAdSlotMany` taking `{ owner, currency, taxRateBps, minRunwaySeconds, tenureWindow, moderation, key }`: the owner is manager and recipient, the tax terms and recipient are mutable, the hook is not.

**Carried over.** `SlotFactory.collectAll` / `collectFrom`, `OfferBook`, `SlotCollective` governance (relays masks; `proposeHook` takes `HookTerms`), `SlotBoundNFTFactory` (the wrapper beacon is set in `initialize`).

**SDK.** `SlotInit`, `TaxTerms`, `HookTerms`, `NO_HOOK`, `TERMS`, `ALL_TERMS`; `proposeTerms({ taxRateBps, recipient, minRunwaySeconds, hookTerms })`; `cancelTerms(slot, mask)`; `hookOfferStatus(slot)`, `acceptHookOffer(slot, expected)`, `acceptOffer(slot, id, minPrice)` (OfferBook, defaulting to the deployed book), `debtOf(slot, account)`, `HookOffer`, `HOOK_PERMISSION_BITS`, `unpackHookPermissions`, `TERMS.HOOK_PERMISSIONS`; `SlotState` carries `taxRateBps`, `minRunwaySeconds`, the three `mutable*` flags, `hook`, `hookConfig`, `hookOffer` and `hookPermissions`, read from `getSlotInfo()` in one call; `pending` carries `taxTerms`, `hookTerms`, `hookPermissions`, `mask` and a flag per term.
