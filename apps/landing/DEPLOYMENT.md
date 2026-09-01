# Where the explorer runs

Dokploy, Railpack build, on the `Slots` project — two applications off the same
repo, each pinned to a branch, both `autoDeploy: true` with a push trigger.

| App | Branch | Domain |
|---|---|---|
| `Landing` | `main` | `0xslots.org` |
| `Landing:DEV` | `develop` | `dev.0xslots.org` |

There is no deployment config in this repo. The branch pin lives in Dokploy,
which is why this file exists — otherwise the only place that answers "which
branch is production" is a dashboard nobody reads during an incident.

## The rule the two have to obey together

The explorer reads a live protocol. So the branch that deploys the app has to
be a branch whose contracts are actually deployed:

- `develop` → base-sepolia and anvil → `dev.0xslots.org` is the explorer.
- `main` → nothing yet. The hook-based protocol has no mainnet deployment.

A build promoted from `main` before the contracts are on a mainnet would come
up pointing at addresses that do not exist and render an empty explorer — which
reads as a broken app rather than an undeployed one. Keep the protocol's chain
configuration (`apps/contracts/deployments/config/`) ahead of the branch, not
behind it.

## Adding a chain

Three things have to name it before the explorer can show it:

1. `apps/contracts/deployments/config/<chainId>.json` — admin, RPC env, warehouse
2. a deploy — `script/protocol/DeployProtocol.s.sol`
3. `packages/contracts/src/slots.ts` — the addresses the app reads

## Known wart

`Landing:DEV` carries a redirect `www.0xslots.org → 0xslots.org`, which belongs
to the production app and appears to have been copied when the DEV app was
created. Harmless today because nothing points `www` at the dev container, but
it is a rule on the wrong application.
