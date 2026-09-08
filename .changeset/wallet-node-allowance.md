---
"@0xslots/sdk": patch
---

An ERC-20 `buy` no longer arrives before the wallet believes the approve happened.

`ensureAllowance` already waited for the allowance to be visible — but on the app's own `publicClient`. The buy that follows is submitted through the WALLET, and a wallet estimates gas against its own provider. Two nodes, two views, and the approve reaches them at different moments; when the wallet's is slower it simulates the buy against a state with no allowance and warns the user that a perfectly good transaction will probably fail. Waiting and retrying worked, which is what made it look like a wallet bug.

The same poll now also asks through `wallet.request`, which reaches whichever node the wallet uses. Best-effort: a wallet that will not answer `eth_call` stops the poll rather than blocking a buy on a diagnostic.

No API change. A buy may take a second or two longer to leave, which is the second or two it was previously spending on a failed estimate.
