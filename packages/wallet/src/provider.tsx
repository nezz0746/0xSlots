"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { WalletOptions } from "./connectors";
import { useRestoreWallet } from "./restore";

/** Which panel the app should be showing, if any. */
export type WalletPanel = "connect" | "account" | null;

type WalletContextValue = {
  panel: WalletPanel;
  openConnect: () => void;
  openAccount: () => void;
  close: () => void;
  /** What the provider was mounted with; the picker reads the relay id here. */
  options: WalletOptions;
};

const WalletContext = createContext<WalletContextValue | null>(null);

/**
 * Holds which wallet panel is open and restores the previous session.
 *
 * Renders nothing of its own. Mount it inside the app's `WagmiProvider` and
 * `QueryClientProvider`, then draw an overlay wherever the app's layout wants
 * one, reading `panel` from `useWalletModal`.
 */
export function WalletProvider({
  children,
  ...options
}: WalletOptions & { children: ReactNode }) {
  const [panel, setPanel] = useState<WalletPanel>(null);
  const openConnect = useCallback(() => setPanel("connect"), []);
  const openAccount = useCallback(() => setPanel("account"), []);
  const close = useCallback(() => setPanel(null), []);
  useRestoreWallet(options);

  const { appName, appUrl, appIcon, walletConnectProjectId } = options;
  const value = useMemo<WalletContextValue>(
    () => ({
      panel,
      openConnect,
      openAccount,
      close,
      options: { appName, appUrl, appIcon, walletConnectProjectId },
    }),
    [
      panel,
      openConnect,
      openAccount,
      close,
      appName,
      appUrl,
      appIcon,
      walletConnectProjectId,
    ],
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function useWalletModal(): WalletContextValue {
  const context = useContext(WalletContext);
  if (!context) throw new Error("useWalletModal requires WalletProvider");
  return context;
}
