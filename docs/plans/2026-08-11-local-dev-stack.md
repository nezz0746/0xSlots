# Local dev stack: anvil + deterministic deploys + ponder + landing

> **Status: B1, B2, B3, B6 done and verified (uncommitted). B4/B5 — landing on
> anvil and the time-warp sidebar — remain.**
>
> `pnpm dev:local` brings up anvil → deploy → seed → ponder from cold and serves 6
> slots. Verified: the pin holds across a bytecode-changing edit to `Slot.sol`, and
> the drift guard fires when perturbed. A +7d warp drew exactly 1.167e18 tax from a
> 3.5e18 deposit (100 USDX × 5% × 7d), and ponder indexed it — which also exercised
> `TaxPaid` for the first time, confirming `accountSlot.taxPaid` is credited once,
> not twice.
>
> Two things learned the hard way, both baked into the script:
> - anvil needs `--gas-limit 2000000000`. forge's estimator returns ~1.05e9 gas for
>   the native-currency `createSlot` (ERC-20 siblings estimate ~550k), and anvil
>   rejects any tx whose limit exceeds the block limit.
> - the seed's min-deposit helper must mirror `Math.ceilDiv`, not floor. Flooring
>   under-funds by one wei only when the division has a remainder — invisible for
>   generous multiples, fatal for the exact-minimum slot the seed exists to create.

Companion to [the Ponder migration plan](./2026-08-11-ponder-migration.md). Goal: one
VSCode task brings up an anvil chain with the protocol deployed, slots already occupied,
Ponder indexing that chain, and landing pointed at both — plus time-warp controls in the
explorer so tax accrual is observable in seconds.

---

## Findings from recon (these change the design)

**1. CREATE2 does the opposite of what's wanted here — this is worth getting right.**

The stated goal is "same addresses locally even after upgrades". The two opcodes behave
inversely on that axis:

| | address derived from | stable when contract code changes? | stable when the script reorders? |
|---|---|---|---|
| `CREATE` (nonce) | `(deployer, nonce)` | ✅ **yes** — code isn't an input | ❌ no |
| `CREATE2` (salt) | `(deployer, salt, keccak(initcode))` | ❌ **no** — initcode is an input | ✅ yes |

So plain sequential deploys from a fresh anvil *already* survive contract edits; it's
adding or reordering a deployment step that shifts everything. CREATE2 with a fixed salt
fixes the reorder problem but **reintroduces** the edit problem — change one line in
`Slot.sol` and the salted address moves.

The pattern that actually pins an address through both is the proxy they already have:

- CREATE2-deploy `ERC1967Proxy{salt}` pointing at a **fixed placeholder implementation**
  whose bytecode never changes, with empty initData. Its initcode is then constant, so
  the proxy address is constant forever.
- Then `upgradeToAndCall(realImpl, initData)` in the next transaction.

Only two addresses actually need pinning — the ones landing and `ponder.config.ts` would
otherwise have to be re-edited on every reset: the **SlotFactory proxy** and the
**MetadataModule proxy**. Implementation addresses can float; nothing references them
directly. Beacon-proxy slot addresses are derived from factory nonce and are already
stable given a stable factory.

**2. Half the scaffolding exists already.** `script/Base.s.sol` already has
`DeployementChain.Anvil` wired to the `local` fork, `ZERO_SALT`, a `TEST_MNEMONIC`
fallback in `_loadSender()`, and `_saveDeployment()` writing
`deployments/<chainid>/<name>.json` with `{address, startBlock}` — exactly the handoff
Ponder needs. `DeployV3.s.sol` just doesn't use the salt (plain `new`).

**3. Anvil predeploys the CREATE2 deterministic deployer.** Confirmed on the installed
anvil 1.4.0-nightly: `0x4e59b44847b379578588920cA78FbF26c0B4956C` holds the 69-byte
Arachnid proxy runtime. So `new C{salt: s}()` in a forge script works with no setup step.

---

## B1. Deterministic local deployment

New `script/DeployLocal.s.sol` (leaves `DeployV3.s.sol` alone — that's the live-network
path and shouldn't change):

1. Deploy a tiny `Placeholder` contract at a salted address.
2. `ERC1967Proxy{salt: FACTORY_SALT}(placeholder, "")` → **pinned SlotFactory address**.
3. Deploy the real `SlotFactory` impl + `Slot` impl (plain `new`, addresses may float).
4. `upgradeToAndCall(factoryImpl, abi.encodeCall(initialize, (deployer, slotImpl)))`.
5. Same placeholder-then-upgrade for `MetadataModule` → **pinned module address**.
6. `setModuleVerified(metadataModule, true)`.
7. `_saveDeployment(...)` → `deployments/31337/*.json`.

Assert the two pinned addresses against hardcoded constants at the end of the script, so
a silent drift fails the deploy instead of quietly breaking ponder's config.

## B2. Seeding occupied slots

`script/SeedLocal.s.sol`, run straight after the deploy, using anvil accounts 1..n from
the standard test mnemonic:

- A handful of slots across the interesting axes: native vs ERC20 currency, mutable vs
  immutable tax, with and without an occupancy policy, one with a utility module.
- Several distinct buyers occupy most of them at varied prices and deposit multiples —
  the goal is a populated explorer, not one lonely slot.
- Leave at least one unoccupied (buy flow) and one deliberately under-deposited (so a
  small warp makes it liquidatable — that's the thing that's untestable today).
- Some metadata set through MetadataModule so the metadata pipeline has rows.
- Needs a local ERC20; deploy a mock and `deal` it to the buyers.

## B3. Ponder against anvil

- Add an `anvil` chain (id 31337, `http://127.0.0.1:8545`) to `ponder.config.ts`,
  **gated behind an env flag** so the Railway/prod config isn't polluted.
- `disableCache: true` on that chain — otherwise a fresh anvil collides with cached
  blocks from the previous run.
- Register anvil **only** on the `SlotFactory` / `Slot` / `MetadataModule` sources, never
  on `SlotFactoryLegacy` / `SlotLegacy`. A fresh local deploy emits the current
  `SlotDeployed` signature only; pointing the legacy sources at it indexes nothing and
  just adds noise.
- Factory address is the pinned constant from B1; `startBlock: 0`.
- **Restart hazard:** if anvil restarts, Ponder's database still holds state for a chain
  that no longer exists. The orchestrator must wipe `.ponder/` (and the local schema)
  whenever anvil is restarted, or indexing resumes against a history that's gone.

## B4. Landing on anvil

- Add anvil to `appChains` (`packages/config/src/chains.ts`) and to the contracts
  package's `CHAINS`/`slotFactoryAddress` map, both gated on a dev flag so production
  builds never offer chain 31337 in the switcher.
- Point the SDK at `http://localhost:42069/graphql` when the selected chain is 31337.
- Add an injected/local connector so an anvil account connects without WalletConnect.

## B5. Time-warp dev sidebar

Dev-only panel in the explorer, rendered only when `chainId === 31337`:

- **+1 day / +7 days / +30 days** → viem `testClient.increaseTime({seconds})` then
  `mine({blocks: 1})`.
- Show the chain's current `block.timestamp` and the delta from wall clock, so it's
  obvious how far the chain has drifted.
- Worth having alongside: `setBalance` on the connected account, and a "mine 1 block"
  button — after a warp, nothing settles until a block is mined.
- Note it's one-way: time can't go backwards. The reset path is restarting the stack.
- After a warp, Ponder needs a moment to poll; the panel should surface Ponder's
  `_meta { status }` block height so it's visible when the indexer has caught up rather
  than looking like a bug.

## B6. Orchestration

VSCode's `dependsOn` sequencing doesn't handle "start a server, wait for ready, then run
a command" — a background task never completes, so the chain stalls. Use a single
orchestrator script instead:

`scripts/dev-local.sh`:
1. Wipe `.ponder/` and `deployments/31337/`.
2. Start anvil (`--block-time 2`, so warps settle without manual mining; `--silent`).
3. Poll `cast block-number` until it answers.
4. `forge script DeployLocal` then `SeedLocal`, both to completion (do not background
   them — an earlier version of this pattern in another repo killed forge mid-broadcast
   and the deployment JSON was written during simulation only).
5. Start ponder (anvil flag on) and landing concurrently, forwarding both logs.
6. Trap `EXIT` to kill the whole process group.

Then in `.vscode/tasks.json`, alongside the existing tasks:
- **`Dev: Local Stack`** → runs the orchestrator (the one-button task).
- **`Dev: Anvil`**, **`Dev: Ponder (local)`** → individual tasks for partial restarts.

Add `pnpm dev:local` at the root pointing at the same script, so it isn't VSCode-only.

---

## Sequencing against the migration

B3 depends on `ponder.config.ts` being stable, so it should land **after** migration
phase 0. B1/B2 are pure contracts work and can go first — and they're independently
useful, since a seeded local chain is the fastest way to exercise the new feed and
relation queries from phase 0 without waiting on a testnet backfill.

Suggested order: **migration 0a → B1 → B2 → migration 0b (feeds) → B3 → B4/B5 → B6 →
migration 1 → 2 → 3**.
