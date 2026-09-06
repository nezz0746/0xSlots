"use client";

import { WalletProvider } from "@0xslots/wallet";
import { DEFAULT_WALLETCONNECT_PROJECT_ID } from "@0xslots/wallet/config";

import { SplitsProvider } from "@0xsplits/splits-sdk-react";
import { QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { WagmiProvider } from "wagmi";
import { TooltipProvider } from "@/components/ui/tooltip";
import { config } from "@/config/wagmi";
import { ChainProvider } from "@/context/chain";
import { NavigationProvider } from "@/context/navigation";
import { createQueryClient } from "@/lib/query-client";
import { SplitsClientSync } from "./splits-client-sync";
import { WalletOverlay } from "./wallet/wallet-overlay";

export function WebProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <WalletProvider
          appName="0xSlots"
          walletConnectProjectId={
            process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ??
            DEFAULT_WALLETCONNECT_PROJECT_ID
          }
        >
          <ChainProvider>
            <SplitsProvider>
              <SplitsClientSync />
              <TooltipProvider>
                <NavigationProvider>{children}</NavigationProvider>
              </TooltipProvider>
            </SplitsProvider>
          </ChainProvider>
          <WalletOverlay />
        </WalletProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
