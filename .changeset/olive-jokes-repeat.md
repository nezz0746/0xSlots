---
"@0xslots/contracts": minor
---

**Breaking:** `moduleURI` → `metadataURI`, and new policy factory addresses.

### ABI

`IUtility.moduleURI()` and `IOccupancyPolicy.policyURI()` are now one
`IModuleMetadata.metadataURI()`. The exported `slotFactory` ABI follows: the
last field of `ModuleVerified` and `PolicyVerified` is `metadataURI`.

Event *signatures* are unchanged — parameter names are not part of a topic0 —
so log decoding keeps working. Only the field label moved, plus the function
selector on the contracts themselves.

This shipped to Base and Base Sepolia. Utilities are UUPS proxies and were
upgraded in place, keeping their addresses; `moduleURI()` now reverts on them
and `metadataURI()` answers.

### ERC-165 ids changed

An id is the XOR of an interface's OWN selectors, and moving `name`/`version`/
`metadataURI` to a parent narrows it. There are now two, and
`SlotFactory.setUtilityVerified` asserts both:

| interface | id | covers |
| --- | --- | --- |
| `IUtility` | `0xe120614a` | the six hooks |
| `IOccupancyPolicy` | `0xd8a073cb` | `checkBuy`, `checkPriceUpdate` |
| `IModuleMetadata` | `0x51eed0df` | `name`, `version`, `metadataURI` |

Anything hardcoding the old single id must move to checking both, or it will
call a contract verified that the chain then rejects.

### Policy factory addresses moved — update required

Policies are immutable and minted at a CREATE2 address derived from the INIT
CODE, so new bytecode means new factories and new addresses for every set of
terms they predict. `MINIMUM_TENURE_POLICY_FACTORY` and
`MINIMUM_PRICE_POLICY_FACTORY` now point at the redeployed ones:

| chain | tenure | price |
| --- | --- | --- |
| base | `0x6C90Ca1A…b30a5` | `0xFA64C889…0Ff1A` |
| base-sepolia | `0x2a399E4D…14E4a` | `0x958088c4…C6551` |

Creating a policy through the previous factory now produces one the upgraded
`SlotFactory` will not verify, which is why these had to move rather than being
left in place.

`POLICY_FACTORIES` keeps the superseded factories so existing policies still
resolve, ordered current-first. This also repairs an existing gap: the
`2026-08-08` price factories (`0x6a1F9D1F…` / `0xe218F2e7…`) were never added to
that list, so policies minted by them did not resolve at all.

Slots already pointing at a pre-rename policy are unaffected — `Slot` only ever
calls `checkBuy` and `checkPriceUpdate`, neither of which changed.
