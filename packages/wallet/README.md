# @0xslots/wallet

Wallet logic for the 0xSlots apps. **No UI.**

The catalogue of wallets and how each is reached, what a picker has to track
while it connects, and what an account panel can do once it has — as hooks.
Drawing any of it is the app's job: the explorer and Slotmarket do not share a
design, and a dialog that suited one would be the wrong shape in the other. Each
mounts `WalletProvider` and renders its own overlay from the hooks below.

- Installed wallets discovered by wagmi/EIP-6963, including ones outside the named list.
- Base Account through Coinbase's smart-wallet connector.
- MetaMask, Rabby, Rainbow and Zerion through their installed provider or WalletConnect.
- Generic WalletConnect relay for anything else, hidden on a phone where it is
  how the other rows already work.
- Mobile deep links with a stranded-handoff signal, install links, cancellation,
  and errors trimmed to their first line.
- Address copying, network switching, changing wallets and disconnecting.

## Integration

Keep chains, RPCs and the query client in the app. Configure wagmi with
`ssr: true`, EIP-6963 discovery on (the default), and
`storage: walletStorage("your-app.wallet")` from `@0xslots/wallet/config`. List
only app-specific connectors — Anvil, Farcaster — in that config.

```tsx
import { WalletProvider, useWalletModal } from "@0xslots/wallet";

// Inside BOTH WagmiProvider and QueryClientProvider:
<WalletProvider
  appName="Your app"
  walletConnectProjectId={process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID}
>
  {children}
  <YourWalletOverlay />
</WalletProvider>;
```

`useWalletModal()` gives `panel` (`"connect" | "account" | null`) plus
`openConnect`, `openAccount` and `close`. Render whatever chrome the app wants
around it — the overlay in each of these apps is a centred dialog, and neither
package nor app forces a bottom sheet.

```tsx
const { wallets, installable, others, pairing, picking, stranded, error, cancel } =
  useWalletPicker();
const { address, walletName, chains, supported, copy, switchChain, disconnect } =
  useWalletAccount();
```

Both hooks reset themselves when their panel closes, so an overlay that stays
mounted behaves like one that unmounts.

`@0xslots/wallet/qr` default-exports an unstyled SVG QR for a `pairing.uri` —
a separate entry point so an app that never shows one does not bundle the
encoder. Lazy-load it.

Connectors are built when first requested, or when restoring a previous session,
and belong to the active wagmi config; storage namespaces keep the explorer,
marketplace and Farcaster environments apart. The picker never imports an app's
config. `connectors.ts` isolates wagmi's internal deferred-registration API; run
its config-isolation test when upgrading wagmi.

Wallet names, deep-link schemes and bundled icons come from Adland's catalogue.
Icons are embedded, so consumers need no copied public assets.

## Verification

`pnpm --filter @0xslots/wallet typecheck`

`pnpm --filter @0xslots/wallet test`

Covering provider selection, config isolation, pairing URI delivery and mobile
handoff, errors, cancellation, reconnect, and account actions.
