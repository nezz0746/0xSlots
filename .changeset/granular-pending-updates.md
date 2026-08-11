---
"@0xslots/contracts": minor
---

Expose the per-kind pending-update surface, and correct three ABIs that had drifted from the deployed contracts.

A slot has always held up to three queued changes — tax, utility, occupancy policy — but they could only ever be cancelled as a set, and the log could not say which one had moved. The implementation now addresses them one at a time, and the ABI follows: `cancelPendingUpdate(uint8)` retracts a single dimension, `pendingUpdateOf(uint8)` reads one uniformly across both storage structs, and `taxProposedAt` / `utilityProposedAt` / `policyProposedAt` say when each was queued. Three events carry the same shape: `UpdateProposed(uint8,bytes32,uint64)`, `UpdateCancelled(uint8)`, `UpdateApplied(uint8,bytes32)`, where `kind` is `0` tax, `1` utility, `2` policy and `value` is the proposed value widened to 32 bytes.

They are additions, not replacements. `TaxUpdateProposed`, `ModuleUpdateProposed`, `PolicyUpdateProposed`, `PendingUpdateCancelled`, `PendingUpdateApplied` and `PolicyUpdateApplied` all still fire, because changing an existing event's signature changes its topic0 and splits historical indexing across two shapes. What the new ones add is the thing the old ones structurally cannot express: `PendingUpdateApplied` carries BOTH tax and utility on every apply, filling the unchanged one in from current state, so a reader sees a utility "change" to the value it already had. `UpdateApplied` fires only for what actually moved.

`getSlotInfo` returns three more `uint64` fields at the end of its tuple. A consumer on the previous ABI decodes the same tuple fine and ignores them. The reverse does not hold and does not fail loudly — see the note in the SDK changeset.

**The correction is the breaking part.** `slot.ts`, `slotFactory.ts` and `erc721Slots.ts` still described `SlotConfig.mutableModule`, `SlotInitParams.module` and `SlotInfo.module` long after the contracts renamed those components to `mutableUtility` and `utility`. viem encodes and decodes a struct argument BY COMPONENT NAME, so anything reading `info.module` or building a config with `mutableModule` was working only because the ABI was wrong in the same direction as the caller. Regenerating from `forge inspect` fixes the ABIs, which means any code holding those field names now sees `undefined` and must move to the new spelling — `@0xslots/sdk` accepts either and normalises, so most consumers need no change.

Regenerated wholesale rather than hand-edited, which also picked up entries these files had been missing entirely: `utility()`, `mutableUtility()`, `proposeUtilityUpdate`, and on the factory side `ModuleVerified`'s renamed `utility` parameter.

New `Slot` implementations are live behind the existing beacons — `0x8eE2370CE8A1CE0139bdF868acC4F0F59D7C8EA3` on Base and `0x4EFd8917aea62B70B354AfD11AE97CF9096a901C` on Base Sepolia. Beacon-only: `Slot.initialize` did not change, the factory proxies are untouched, and no address exported from this package moves. The storage layout is strictly append-only — every pre-existing variable sits at its original slot and offset, and the three new timestamps pack into one previously-unused slot.
