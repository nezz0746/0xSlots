# @0xslots/protocol

The deploy and upgrade CLI. Private, never published, and deliberately not
built: `tsx` runs the TypeScript directly, so there is no `dist/` to go stale
and no build step between editing this and running it.

```bash
pnpm protocol                                       # asks what to do, and where
pnpm protocol upgrade --dry --chain base-sepolia
pnpm protocol upgrade --chain base-sepolia,base     # several, in that order
pnpm protocol upgrade --chain all
pnpm protocol deploy --chain <name|id>
```

Chains come from `apps/contracts/deployments/config/*.json`. Adding one is that
file and nothing else — the picker, `--chain` validation and the error message
all read it.

## Several chains at once

The prompt is a multi-select and `--chain` takes a comma-separated list, because
what gets rolled out is *one* set of implementations and the real question is
which chains are behind it.

**Everything is read before anything is written.** Every selected chain is
simulated first, all the plans are printed, and then there is a single
confirmation naming the whole set — mainnets called out separately. Planning and
sending per chain in turn would put the mainnet prompt *after* transactions had
already landed elsewhere, where answering "no" means nothing.

Order is the order you asked for. `--chain base-sepolia,base` describes a
sequence — prove it on the testnet, then go — and reordering that would send the
mainnet transaction first. The exception is `all`, which has no stated
preference and so runs in config order: local, testnets, mainnets.

**A chain that cannot be acted on is skipped, not fatal.** An unreachable node,
a missing RPC, a zeroed admin, or nothing deployed yet on an `upgrade` — each
takes that chain out of the run and says so in the summary. Refusing to upgrade
four healthy chains because a fifth is unreachable turns one flaky endpoint into
a stalled rollout.

When *every* chain is turned away for the same reason — you ran `deploy` on
chains that already have the protocol, or `upgrade` on chains that do not — that
is a mistyped command rather than a state to investigate, so the outro hands you
the one you meant instead of a table saying "wrong mode" once per chain.

**One moved storage slot stops everything.** That is a fact about the code, not
about a chain: the others simply have not been asked yet, and letting them
proceed would corrupt them one at a time.

Broadcasting is sequential — `forge script` keeps a broadcast cache under
`apps/contracts` and two runs would be writing the same files. If one chain's
script fails the rest still run, because the chains already broadcast to cannot
be un-broadcast; stopping there would leave the set half-applied *and*
half-unattempted. The exit code is non-zero and the summary names what failed.

ABIs and packages are rebuilt once at the end rather than per chain.
