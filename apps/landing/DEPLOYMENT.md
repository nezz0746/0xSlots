# Where the explorer runs

**`develop` only.** `main` is disabled in `vercel.json`.

The explorer reads a live protocol, and the protocol is deployed on
base-sepolia and anvil — not on any chain `main` would imply. A build promoted
from `main` would come up pointing at addresses that do not exist and render an
empty explorer, which reads as a broken app rather than as an undeployed one.

So the branch that deploys the contracts is the branch that deploys the app.
They move together or they disagree, and disagreeing is the failure that costs
an afternoon.

## The one thing this file cannot do

`vercel.json` can disable a branch, but it cannot choose the **production
branch** — that is a project setting. Set it to `develop` in the Vercel
dashboard (Settings → Git → Production Branch), or `develop` will keep
deploying as a preview while production sits empty.

## When a chain is added

`deployments/config/<chainId>.json` is the source of truth for the contracts;
`packages/contracts/src/slots.ts` carries the addresses the app reads. Both
have to name the chain before the explorer can show it.
