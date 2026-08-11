---
"@0xslots/sdk": minor
---

Address a slot's three pending updates one at a time, and finish the utility rename on the read and write paths.

`UpdateKind` is a new export — `Tax`, `Utility`, `Policy`, numbered to match the Solidity enum. It is the argument to `cancelPendingUpdate(slot, kind)`, which retracts one queued change and leaves the others standing. `cancelPendingUpdates(slot)` still exists and still drops all three; prefer the singular unless clearing everyone's queued work is genuinely what you mean. `useSlotAction` exposes both, and labels each cancel per dimension so a pending spinner lands on the row that is actually in flight rather than on all three at once.

`proposePolicyUpdate(slot, newPolicy)` is new. The occupancy policy has been proposable on-chain since policies existed, but this client never offered it, so the one update that decides whether a slot can be taken from you was unreachable through the SDK. `proposeUtilityUpdate` joins it as the canonical name for `proposeModuleUpdate`, which is deprecated and now forwards to the same place.

`SlotOnChain` gains `taxProposedAt`, `utilityProposedAt` and `policyProposedAt`. A `has*` flag says only THAT something is queued; these say how long it has been true, which is what separates a change queued last week from one queued against a transaction that is already in flight. Zero alongside a set flag means the slot predates the contract recording it — read the pair, never the timestamp alone.

**Renames, with a bridge.** `SlotOnChain.module`, `mutableModule`, `hasPendingModule` and `pendingModule` are now `utility`, `mutableUtility`, `hasPendingUtility` and `pendingUtility`. The old names remain as deprecated aliases filled from the same source, mirroring the deprecated `module()` and `mutableModule()` getters the contract itself still ships, so existing code keeps working for one release.

The write path could not be bridged with an alias, and this is worth knowing even if you never touched these types. `SlotConfig` and `SlotInitParams` are encoded by viem BY COMPONENT NAME, and both this package and the checked-in ABIs still used `mutableModule` / `module` after the contracts had renamed those components. The two were wrong in the same direction, so they agreed with each other and disagreed with the chain; correcting either one alone would have started silently creating slots with a zero utility and a dropped `mutablePolicy` flag. `createSlot` and `createSlots` now build the tuple explicitly through a normaliser that accepts either spelling, so a caller on the old names is unaffected and a missing field is a type error here rather than a zero address on-chain.

**This version requires the upgraded `Slot` implementation.** `getSlotInfo` grew three fields, and reading a slot that has not been upgraded does not throw — because the tuple carries strings, the three extra reads land on tail bytes and return plausible-looking garbage for the timestamps while every other field decodes correctly. Base and Base Sepolia are both upgraded; point this at a fork or a chain that is not, and pending-update timestamps are meaningless rather than absent.
