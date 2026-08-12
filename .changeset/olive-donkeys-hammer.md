---
"@0xslots/contracts": minor
---

Add local anvil (31337) as a first-class chain.

`slotFactoryAddress` gains a pinned anvil entry, matching the address
`apps/contracts/script/DeployLocal.s.sol` deploys to. The address survives edits
to the Solidity — see `LocalBootstrap.sol` for why a plain CREATE2 would not,
since CREATE2 hashes the initcode and so moves whenever the contract changes.

`CHAINS` filters anvil out unless `NODE_ENV === "development"`. Bundlers inline
`NODE_ENV`, so a production build drops the entry at compile time rather than
shipping a chain option that resolves to nobody's localhost.

The address table itself is unconditional — it is only data. Whether a chain is
*offered* is `CHAINS`'s decision, and keeping those separate means a consumer
that knows it wants the local factory can still ask for it by id.
