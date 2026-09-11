---
"@0xslots/contracts": minor
---

`AdLand` is version 3: two ways to do several things in one transaction.

`createAdSlotMany(AdSlotParams[])` takes an array of the same seven fields `createAdSlot` takes and returns the addresses it made, in order. One dispatch and one `slotFactory` read rather than one of each per space — and, more usefully, calldata a wallet can decode: ten spaces read as ten structs instead of ten opaque `bytes` blobs. An empty array reverts `EmptyBatch` rather than succeeding at nothing. One revert takes the whole batch down, which follows from the single transaction and is the behaviour to want: the reverts reachable here are a missing factory, terms the core refuses, and a name already taken, none of which is a reason to keep the other nine and leave the caller to work out which is missing. Two entries claiming the same name revert on the second, because the first has already written `slotOf` — the same rule as two separate transactions, with no special case.

`multicall(bytes[])` batches anything else on the hook — publishes, terms changes, a create and a `setSlot` together. It is OpenZeppelin's `MulticallUpgradeable`, so each entry is a self-`delegatecall` and `msg.sender` is preserved throughout. That is the difference from routing the same batch through a generic aggregator like Multicall3, where every call arrives from the aggregator and a name claimed in the batch ends up owned by IT rather than by the person. It grants nothing new: every function it reaches is one the caller could already call directly, with the same access control in the same order.

`createAdSlot` keeps its exact signature and now delegates to an internal shared with the batch path, so the two cannot drift into making different kinds of slot.

Additive, and safe on a live proxy. `MulticallUpgradeable` declares no storage — it extends `Initializable` and `ContextUpgradeable`, both already inherited through `OwnableUpgradeable`, and OZ v5 keeps their state in ERC-7201 namespaced slots. `forge inspect` on the new implementation is byte-identical to the recorded layout, and the upgrade reported `layout ok` on every chain.
