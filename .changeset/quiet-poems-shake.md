---
"@0xslots/contracts": minor
---

Add `SlotFactory.collectAll(address[])` — flush accrued tax out of many slots in
one transaction, and `collectFrom(address)` for a single one.

Collection is already permissionless and the money always goes to each slot's
own `recipient`, so this grants no new authority: it is a gas convenience for a
keeper, or for a recipient holding many slots.

Each collection is isolated, so a slot that reverts — `NothingToCollect`, or a
`strict` hook that reverts in `afterSettle` — leaves a zero in the returned
array instead of denying every other recipient their rent. Addresses the factory
did not create are skipped rather than rejected.

The returned amounts are what actually moved, capped by each slot's deposit: for
an insolvent slot the raw `taxOwed()` exceeds what settlement will pay out, and
the excess is carried as arrears rather than transferred. Simulate the call to
price a "collect all" button before showing it.

Adds a `NotASlot` error. `SlotFactory.version()` is now 3; this is an
implementation change with no storage change, so it upgrades in place.
