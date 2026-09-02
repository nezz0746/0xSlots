# @0xslots/protocol

The deploy and upgrade CLI. Private, never published, and deliberately not
built: `tsx` runs the TypeScript directly, so there is no `dist/` to go stale
and no build step between editing this and running it.

```bash
pnpm protocol                      # asks what to do, and where
pnpm protocol upgrade --dry --chain base-sepolia
pnpm protocol upgrade --chain base-sepolia
pnpm protocol deploy --chain <name|id>
```

Chains come from `apps/contracts/deployments/config/*.json`. Adding one is that
file and nothing else — the picker, `--chain` validation and the error message
all read it.
