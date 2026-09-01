# Running the Slots protocol locally

The hook-based protocol in `apps/contracts/src/slots/`. Two scripts, no address
pinning, no bootstrap indirection — deploy, seed, paste the addresses.

## Start

```bash
apps/contracts/scripts/slots-local.sh
```

Starts anvil if it is down, deploys and seeds if the chain is empty, and does
nothing if everything is already up — so it is safe to run whenever you are not
sure. `--reset` wipes and rebuilds.

**Do not restart anvil by hand.** It wipes the deployment and leaves the app
talking to a chain with no contracts on it, which reads as a client bug from
every side — an SDK agent lost ten minutes to exactly that. Use `--reset`.

From a **fresh** anvil run by account 0 the addresses are deterministic — they
come out of the nonce sequence, so they only move if the scripts change what
they deploy or in what order:

| | |
|---|---|
| SlotFactory (proxy) | `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0` |
| Slot implementation | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| MinimumTenureHook (7d) | `0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9` |
| Test token (USDX) | `0x5FC8d32690cc91D4c39d9d3abcBD16989F875707` |
| Admin / deployer | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` |
| Start block | `0` |

## What the seed covers

Chosen for the axes the UI branches on, not for volume.

| # | Slot | Covers |
|---|---|---|
| 1 | `0xE451…d73F` | native, no hook, occupied — the plainest case |
| 2 | `0x5392…9E67` | ERC-20 currency, occupied — the approve path |
| 3 | `0xa783…05A9` | tenure hook, occupied inside its window — "not available yet" |
| 4 | `0xB30d…Aa0D` | vacant — the empty state |
| 5 | `0x61ef…4296` | immutable terms, no manager |
| 6 | `0xF45b…647b` | a term change pending until the next transition |
| 7 | `0xeCaE…8489` | funded to the exact minimum — liquidatable after ~1h |

Slot 7 is the one worth having: it is the state that is effectively untestable
against a testnet, and the liquidation UI is built against it.

```bash
cast rpc evm_increaseTime 3700 && cast rpc evm_mine
cast send 0xeCaE6Cc78251a4F3B8d70c9BD4De1B3742338489 'liquidate()' \
  --rpc-url http://127.0.0.1:8545 --private-key <any other account>
```

Verified end to end: a stranger liquidates, and the slot goes vacant.

## Two things that will bite

**`--rpc-url` is honoured here, unlike the older scripts.** `BaseScript.broadcastOn`
opens its own fork from a foundry.toml alias and ignores the flag entirely, so
you can read a simulation against a completely different chain than the one you
named. These scripts extend `Script` directly for that reason.

**A manager is required exactly when something is mutable, and forbidden
otherwise.** `initialize` reverts `NotManager()` both ways. It means "immutable"
is a fact about the slot rather than a promise about somebody's restraint — but
a create form that always sends `manager = msg.sender` will revert the moment
someone unticks both boxes.
