"use client";

/**
 * Wallet logic for the 0xSlots apps. No chrome.
 *
 * The catalogue of wallets, how each is reached, what a picker has to track
 * while it connects, and what an account panel can do once it has. Rendering
 * all of that is the app's job: the explorer and the marketplace do not share
 * a design, and a dialog that suited one would be the wrong shape in the
 * other. Each mounts `WalletProvider` and draws its own overlay from
 * `useWalletModal`, `useWalletPicker` and `useWalletAccount`.
 */

export type { WalletOptions } from "./connectors";
export { resolveConnector } from "./connectors";
export { onMobile, useOnMobile } from "./mobile";
export {
  useWalletModal,
  type WalletPanel,
  WalletProvider,
} from "./provider";
export { useRestoreWallet } from "./restore";
export { useWalletAccount } from "./use-wallet-account";
export {
  type DiscoveredChoice,
  type Pairing,
  useWalletPicker,
  type WalletChoice,
} from "./use-wallet-picker";
export {
  connectorFor,
  deepLink,
  OFFERED,
  type OfferedWallet,
  unlisted,
  walletLabel,
} from "./wallets";
