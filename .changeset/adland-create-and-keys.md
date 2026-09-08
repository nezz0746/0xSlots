---
"@0xslots/contracts": minor
---

`AdLand` is version 2: it can create the slots it hooks, and a key can have an owner.

`createAdSlot(recipient, currency, taxBps, minDepositSeconds, tenureWindow, manager, key)` deploys through the recorded `SlotFactory` with `hook` fixed to AdLand. It removes the three fields of `SlotInit` that fail quietly: the hook address, which a form can fill with the wrong one and produce a valid slot that simply is not an ad space; `hookData`, a `bytes32` that is really seconds; and `mutableHook`, which is `false` here, so a slot made this way is an ad space permanently rather than currently. Anyone wanting the other trade still calls `SlotFactory.createSlot` directly — this gates nothing.

A non-zero `key` claims a registry name in the same transaction, first come first served, recorded in the new `keyOwner` mapping. Only an UNCLAIMED key can be taken, so `primary` and anything already pointing somewhere are not available; the owner can still repoint any key through `setSlot`'s two-day path, so a squatted name costs a delay rather than being lost. A taken key reverts the whole creation rather than handing back a slot the caller believes is named and is not.

`setSlot` accepts the key's owner as well as the contract owner. Everything else about it is unchanged, including that the first write to an unset key is immediate and every later one waits `CHANGE_DELAY` and needs `commitSlot`.

New surface on `adLandAbi`: `createAdSlot`, `setSlotFactory`, `slotFactory`, `keyOwner`, and a `NotKeyOwner` / `KeyTaken` / `NoFactory` error each. `slotFactory` must be set by the owner once after upgrading, or `createAdSlot` reverts with `NoFactory`.

Storage is append-only, so this upgrades the live proxies in place. The recorded AdLand address changes on Base, Base Sepolia and Ethereum Sepolia.
