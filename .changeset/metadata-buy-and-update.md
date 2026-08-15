---
"@0xslots/contracts": minor
"@0xslots/sdk": minor
---

Add `buyAndUpdate` and `buyAndUpdateWithPermit` to MetadataModule (2.0.0 → 2.1.0).

Taking a slot and putting something in it was two calls that cannot be reordered:
`updateMetadata` is occupant-only, and `buy` clears the previous creative on its
way through, so the gap between them is a slot showing nothing. Wallets that
implement EIP-5792 closed that gap by bundling. A plain browser extension does
not — and it failed dishonestly: each receipt was awaited, but the wallet's own
RPC provider still had the previous occupant when it estimated gas for the
metadata write, so the call reverted and surfaced as a bare `-32603 internal
error`. Moving the sequencing on-chain removes the class of bug instead of
retrying it.

`buyAndUpdateWithPermit` is the one that reaches a single transaction for a plain
EOA, since USDC on Base implements EIP-2612. Plain `buyAndUpdate` remains two
confirmations (approve, then buy-and-publish) for tokens without permit, and one
for native slots, which are paid by value.

The module is a UUPS proxy, so this shipped as an in-place upgrade: the address
is unchanged and every slot already pointing at it gained both entry points at
once. No address-book change, and `slotAbi`/`metadataModuleAbi` consumers keep
working — this only adds.

SDK: `client.modules.metadata.buyAndUpdate()`, `.buyAndUpdateWithPermit()` and
`.quoteBuyCost()`. The permit signature is the caller's to produce; sign the
token's `Permit` typed data with `spender` set to the module address and `value`
covering `quoteBuyCost`.

Also corrects `metadataModuleAbi`'s `initialize` entry, which declared no
parameters while the contract has always taken `address initialOwner`.
