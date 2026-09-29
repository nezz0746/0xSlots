# Chain configuration

One file per chain, named by chain id. Adding a chain is adding a file — no
script changes.

| Field | Meaning |
|---|---|
| `name`, `chainId` | What `pnpm protocol --chain` accepts. |
| `admin` | Owns every upgrade on this chain. **Must be the same address on every chain** for CREATE2 address parity — see below. |
| `splitsWarehouse` | The 0xSplits warehouse collectives are built on. Zero on a testnet means the deploy script deploys one; on a mainnet it is refused. |
| `rpcEnv` | Name of the env var holding the RPC URL. |
| `rpcUrl` | Optional public fallback the `protocol` CLI uses when `rpcEnv` is unset. |
| `explorerVerify` | Whether to attempt source verification. Read by the deploy script, not yet acted on. |
| `testnet` | Orders chains local → testnets → mainnets, and makes the `protocol` CLI call mainnets out separately before it sends anything. |

## Why the admin must match across chains

A proxy's CREATE2 address is derived from its initcode, and the initcode
contains the initializer calldata — which contains the admin. Two chains with
different admins get different proxy addresses, and the whole point of CREATE2
here is that they do not.

Use one Safe address (or one EOA) everywhere. If a chain genuinely needs a
different owner, deploy with the shared admin and `transferAdmin` afterwards —
that changes who controls it without moving the address.

A zero `admin` is refused before anything is sent, so a placeholder config
cannot be deployed by accident.
