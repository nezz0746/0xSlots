---
"@0xslots/sdk": minor
---

`createSlotWithTenure` and `createSlotWithPriceFloor` take an optional `count`, batching through `createSlots` when it is above one. The policy is a single stateless contract per set of terms, so a batch points every slot at the same address and still deploys it at most once — previously a slot with a tenure or price-floor policy could only be created one at a time.
