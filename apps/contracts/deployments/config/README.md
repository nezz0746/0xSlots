# Chain configuration

One file per chain, named by chain id. Adding a chain is adding a file — no
script changes.

| Field | Meaning |
|---|---|
| `admin` | Owns every upgrade on this chain. **Must be the same address on every chain** for CREATE2 address parity — see below. |
| `rpcEnv` | Name of the env var holding the RPC URL. The value never lives here. |
| `explorerVerify` | Whether the deploy script attempts source verification. |
| `testnet` | Gates what CI is allowed to do unattended. A mainnet entry is never upgraded by CI. |

## Why the admin must match across chains

A proxy's CREATE2 address is derived from its initcode, and the initcode
contains the initializer calldata — which contains the admin. Two chains with
different admins get different proxy addresses, and the whole point of CREATE2
here is that they do not.

Use one Safe address (or one EOA) everywhere. If a chain genuinely needs a
different owner, deploy with the shared admin and `transferAdmin` afterwards —
that changes who controls it without moving the address.

The mainnet entries ship with a zero admin on purpose: the deploy refuses it,
so nobody deploys to mainnet with a placeholder by accident.
