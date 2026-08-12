---
"@0xslots/sdk": minor
---

Add `getAccountChains` — recipient counts scoped to one chain.

`account` has no `chainId`. It is one row per address, with `slotCount` and
`occupiedCount` summed across every network, so `getAccounts` cannot answer
"who receives on THIS chain" and never could. Asking it anyway is what made the
explorer list base-sepolia's recipients while base was selected, each labelled
with its base-sepolia slot count — and clicking one opened a recipient page
that does filter by chain, found nothing, and rendered zeros throughout.

`getAccountChains` reads the new `accountChain` table instead. `chainId` is
injected the same way every other list query gets it, so the default is the
client's chain and callers opt out by passing their own `where`.

Three counters, and the distinction between them is the point:

- `slotCount` — slots on this chain where the account is the **recipient**
- `occupiedAsRecipient` — how many of those are currently occupied
- `occupiedCount` — slots on this chain the account **occupies**

The first two form an occupancy ratio. The third describes a different role and
must never be paired with `slotCount`, however much the names suggest
otherwise — that mistake has now been made twice against this data.

`occupiedAsRecipient` also replaces counting a 500-row page client-side, so the
number no longer caps at 500 and no longer sums across chains.

Nothing is removed. `getAccounts` still returns protocol-wide totals for
callers that want them; its docblock now says so.

Requires an indexer carrying the `accountChain` table — deploy ponder before
upgrading, or the query resolves against a schema that has no such field.
