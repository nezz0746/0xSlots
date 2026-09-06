"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAccount, useSwitchChain } from "wagmi";

import { CHAINS, DEFAULT_CHAIN_ID, isSupported } from "@/lib/chains";

/**
 * Which chain the market is looking at.
 *
 * Not `useAccount().chainId`. That is the chain the WALLET is on, and reading
 * it directly meant a visitor with no wallet could only ever see the default
 * one: every page fell back to it, and the network picker was disabled because
 * there was nothing for it to write to. A marketplace has to be browsable
 * before it is usable — you look, then you connect.
 *
 * So the choice lives here, and a connected wallet overrides it: whatever the
 * wallet is on is what a transaction would go to, and a page that listed one
 * chain while buying on another would be lying about the price.
 *
 * Seeded from `?chain=` after mount rather than through `useSearchParams`,
 * which would oblige every page under it to sit inside a Suspense boundary to
 * stay statically renderable.
 */
const ChainContext = createContext<{
  chainId: number;
  setChain: (id: number) => void;
} | null>(null);

export function ChainProvider({ children }: { children: ReactNode }) {
  const { chainId: walletChain, isConnected } = useAccount();
  const { switchChain } = useSwitchChain();
  const [chosen, setChosen] = useState<number>(DEFAULT_CHAIN_ID);

  useEffect(() => {
    const param = Number(
      new URLSearchParams(window.location.search).get("chain"),
    );
    if (isSupported(param)) setChosen(param);
  }, []);

  // A connected wallet is the authority: it decides where a buy would land.
  const chainId =
    isConnected && walletChain && isSupported(walletChain)
      ? walletChain
      : chosen;

  const setChain = useCallback(
    (id: number) => {
      if (!isSupported(id)) return;
      setChosen(id);
      const url = new URL(window.location.href);
      url.searchParams.set("chain", String(id));
      window.history.replaceState(null, "", url);
      // Ask the wallet to follow. It may refuse, and the browsing choice above
      // stands either way — the wallet is only the authority once it agrees.
      if (isConnected) switchChain({ chainId: id as never });
    },
    [isConnected, switchChain],
  );

  const value = useMemo(() => ({ chainId, setChain }), [chainId, setChain]);
  return (
    <ChainContext.Provider value={value}>{children}</ChainContext.Provider>
  );
}

export function useActiveChain() {
  const context = useContext(ChainContext);
  if (!context) throw new Error("useActiveChain requires ChainProvider");
  return context;
}

export { CHAINS };
