"use client";

import { SplitsProvider } from "@0xsplits/splits-sdk-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { type ReactNode, useEffect, useState } from "react";
import { useConnect, WagmiProvider } from "wagmi";
import { TooltipProvider } from "@/components/ui/tooltip";
import { miniAppConfig } from "@/config/wagmi-miniapp";
import { ChainProvider } from "@/context/chain";
import { FarcasterProvider, useFarcaster } from "@/context/farcaster";
import { NavigationProvider } from "@/context/navigation";
import { SplitsClientSync } from "./splits-client-sync";

/** Lazy-load the web provider tree (includes RainbowKit) only when needed. */
const WebProviders = dynamic(
  () => import("./web-providers").then((m) => ({ default: m.WebProviders })),
  { ssr: false },
);

/**
 * Auto-connects the Farcaster wallet when running inside a miniapp.
 */
function FarcasterAutoConnect() {
  const { connect, connectors } = useConnect();

  useEffect(() => {
    const fc = connectors.find((c) => c.id === "farcasterMiniApp");
    if (fc) connect({ connector: fc });
  }, [connect, connectors]);

  return null;
}

/**
 * Miniapp provider tree — plain wagmi, no RainbowKit.
 */
function MiniAppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={miniAppConfig}>
      <QueryClientProvider client={queryClient}>
        <FarcasterAutoConnect />
        <ChainProvider>
          <SplitsProvider>
            <SplitsClientSync />
            <TooltipProvider>
              <NavigationProvider>{children}</NavigationProvider>
            </TooltipProvider>
          </SplitsProvider>
        </ChainProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

/**
 * Detects miniapp environment first via FarcasterProvider, then renders
 * either lightweight miniapp providers or full web providers with RainbowKit.
 */
function InnerProviders({ children }: { children: ReactNode }) {
  const { isMiniApp, isReady } = useFarcaster();

  if (!isReady) return null;

  if (isMiniApp) {
    return <MiniAppProviders>{children}</MiniAppProviders>;
  }

  return <WebProviders>{children}</WebProviders>;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <FarcasterProvider>
      <InnerProviders>{children}</InnerProviders>
    </FarcasterProvider>
  );
}
