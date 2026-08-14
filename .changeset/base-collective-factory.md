---
"@0xslots/contracts": minor
---

Add the Base mainnet SlotCollectiveFactory (`0x9DE033C5E2FAC9e096c91a83635d7a7Cf21b4486`, block 49962974).

Collectives were base-sepolia only until now. Anything deriving availability from
`slotCollectiveFactoryAddress` — notably `CollectiveUnavailable` in the app — starts
offering collectives on Base with this entry.

The factory admin is still the deployer EOA on both chains, and that key can
`upgradeBeacon` every collective at once. `transferAdmin` exists; it has not been
called yet.
