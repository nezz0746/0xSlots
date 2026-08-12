---
"@0xslots/sdk": minor
---

**Breaking:** `module.moduleURI` is now `module.metadataURI`.

Regenerated against the indexer after `IUtility.moduleURI()` and
`IOccupancyPolicy.policyURI()` were unified into
`IModuleMetadata.metadataURI()`. The column follows the contract, so every
query selecting it moved: `GetModules`, and `SlotFields` — which means `getSlots`,
`getSlotsWithMetadata`, `getSlot` and everything else built on that fragment.

```diff
- slot.moduleRef?.moduleURI
+ slot.moduleRef?.metadataURI
```

### Upgrade this in lockstep with the indexer

There is no compatibility window in either direction, because ponder serves
exactly one schema:

- An **older SDK against the new indexer** fails every affected query with
  `Cannot query field "moduleURI" on type "module"`. GraphQL rejects the whole
  document, so the result is not a missing field — it is an empty list. A slots
  table simply renders nothing.
- A **newer SDK against an older indexer** fails the same way in reverse.

Deploy the indexer and publish this together. The symptom, if they drift, is an
explorer with no rows rather than a visible error.
