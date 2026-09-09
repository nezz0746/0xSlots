---
"@0xslots/contracts": minor
---

Slots, collectives and slot-bound collections no longer share an address across chains.

All three factories deployed their children with plain `new`, which is CREATE, whose address is `keccak(rlp(deployer, nonce))` and nothing else. Constructor arguments do not enter a CREATE address at all, so two slots with different recipients, currencies, hooks and tax rates still landed on the same address whenever the factory's nonce matched — nothing about a slot's own terms ever separated it from another chain's.

Each factory is deployed at the same address on every chain, deliberately, and each therefore ran through the same nonce sequence on each of them. Slot #N on Base and slot #N on Ethereum Sepolia were consequently not merely at risk of colliding: they were the same address, by arithmetic. `SlotFactory` at `0x14df7d78` produced `0xf37e7bbf` as its first slot on both.

That is what took the indexer down. Its `slot` table was keyed on the address alone, so the second chain's row was a duplicate primary key, the insert threw unhandled, and the container restart-looped. The indexer is now keyed on (address, chainId); this is the other half, so the chains stop producing the same address in the first place.

`createSlot`, `createCollective` and `createCollection` now use CREATE2, salted with `keccak256(abi.encode(block.chainid, <counter>))` — `slotCount`, `collectives.length` and `collectionCount` respectively. Both halves are load bearing. The counter makes children distinct within a chain, and because it only ever increases, a salt never repeats and CREATE2 cannot revert on an occupied address. `block.chainid` makes them distinct across chains, and without it the collision would have survived the move untouched: a BeaconProxy's initcode is its beacon and its initializer calldata, both of which can be byte-identical on two chains.

Factories keep one address across chains. That is deliberate and is not what changes here — only their children stop sharing one. Contracts deployed directly rather than through a factory, such as `MinimumTenureHook`, are unaffected and still land at one address everywhere, which is why anything indexing them must treat (chainId, address) as the identity regardless.

No ABI change: all three creation signatures are unchanged, and an address is still returned the same way. `SlotFactory.version()` is now 4, `SlotCollectiveFactory.version()` 3, and `SlotBoundNFTFactory.version()` 2.

This does not upgrade in place. The deployment namespace moved to `0xslots.v3`, so every recorded address changes on Base, Base Sepolia and Ethereum Sepolia — factories, implementations, `AdLand`, `OfferBook` and `MinimumTenureHook` alike. The previous deployment keeps working, untouched, at addresses this package no longer names, but nothing carries over: slots, collectives, collections and every AdLand key from it are orphaned, and any embed pointing at an old slot address resolves to a space the new deployment does not know about.
