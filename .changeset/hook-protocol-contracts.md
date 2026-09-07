---
"@0xslots/contracts": minor
---

The hook-based protocol replaces the policy-based one, and this package is now generated rather than hand-written.

**Entry points changed.** `./abis` and `./addresses` are gone; the package exports `.` and `./slots`. Both carry the same thing — `./slots` is the explicit path, the root re-exports it.

**Everything is generated.** ABIs and addresses come from the Foundry build and the deployment records via the wagmi CLI, so a contract's ABI and the address it is deployed at can no longer disagree. `version()` reached none of the ABIs for a whole release under the previous hand-rolled generator, and the local test token pointed at an address with no code.

**The protocol surface is different, not extended.** A slot takes one `SlotInit` struct with a `hook` and a `bytes32 hookData`; `taxPercentage` is `taxBps`; term changes are proposed and applied on a delay. The policy resolvers, the module gallery and the sell-order surface are gone. Nothing that compiled against 0.22.0 compiles against this.

**New:** `knownHooks` and `findKnownHook` — the hooks a client can offer by name on a given chain, derived from the deployment records rather than typed, so a hook appears on exactly the chains it is deployed to. `KnownHook` carries `by` alongside `name` and `description`, with optional `url` and `logo`, so a client can say who maintains a hook rather than presenting every one as stock. `minimumTenureHookAddress` and `adLandAddress`. `CHAINS`, `DEFAULT_CHAIN` and `isDeployedOn`, all derived from where the factory actually exists, so a chain nobody can use is never offered.

**Hook descriptors gained a schema.** `HookDescriptor` now carries a `signature` — a plain ABI type list such as `"uint256 window"` — beside `data`, which holds `abi.encode(HookBounds[])`: a name, a unit and the range the contract will accept for each value. A client renders a working configuration form for a hook it has never heard of, and the bounds come from the hook's own constants, so the form cannot offer a value the transaction would refuse.

**Ethereum Sepolia** joins the chain map. Chains sort local, then testnets, then mainnets, off `chain.testnet` rather than a hard-coded id — which also fixes an ordering bug where any testnet other than Base Sepolia ranked as a mainnet and could become the default.
