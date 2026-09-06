"use client";

import { WalletProvider } from "@0xslots/wallet";
import {
  DEFAULT_WALLETCONNECT_PROJECT_ID,
  walletStorage,
} from "@0xslots/wallet/config";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { createConfig, http, WagmiProvider } from "wagmi";
import { anvil, base, baseSepolia } from "wagmi/chains";
import { ChainProvider } from "@/hooks/use-active-chain";
import { anvilConnectors } from "@/lib/anvil-connectors";
import { CHAINS } from "@/lib/chains";

const config = createConfig({
  // The same list the pages offer, so the picker can never name a chain
  // wagmi was not configured for.
  chains: CHAINS,
  connectors: anvilConnectors,
  storage: walletStorage("0xslots.market"),
  transports: {
    [baseSepolia.id]: http(),
    [base.id]: http(),
    [anvil.id]: http("http://127.0.0.1:8545"),
  },
  ssr: true,
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 5_000, retry: 1 },
        },
      }),
  );

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <WalletProvider
          appName="Slotmarket"
          walletConnectProjectId={
            process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ??
            DEFAULT_WALLETCONNECT_PROJECT_ID
          }
        >
          <ChainProvider>{children}</ChainProvider>
        </WalletProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
