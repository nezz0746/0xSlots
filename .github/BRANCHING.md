# Branches

```
feature/*  ──PR──▶  develop  ──PR──▶  main
                      │                 │
                      │                 └─ publishes packages. Never touches a chain.
                      └─ testnet deploys and upgrades are dispatched from here.
```

## Why deployments hang off `develop` and not `main`

Two different risks, and they want opposite defaults.

**Packages** are published from `main` because a bad publish is recoverable —
you release a patch and consumers move on.

**A chain deployment is not.** A beacon upgrade replaces the code behind every
slot in one transaction, and there is no version to roll forward to; the state
is already live. So the chain-touching workflow is manual, dispatchable only
from `develop`, and refuses to broadcast to any chain whose config does not say
`testnet: true`.

Mainnet is never upgraded by CI. The workflow will *prepare* one — deploy the
implementation, validate the storage layout against what is deployed, and print
the address and calldata — and then stop, so a human signs it from a wallet
they control having read what they are signing.

## Protecting main

Suggested rules, none of which CI can enforce for you:

- require the `test`, `upgrade-safety` and `version-bump` checks
- require a review
- no direct pushes

`upgrade-safety` is the one that matters most: it is the only thing standing
between a merge and every deployed proxy reading its storage wrongly.
