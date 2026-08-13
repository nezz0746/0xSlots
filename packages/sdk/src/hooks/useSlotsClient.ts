"use client";

import { type SupportedChainId, slotFactoryAddress } from "@0xslots/contracts";
import { useMemo } from "react";
import { usePublicClient, useWalletClient } from "wagmi";
import { type SlotsChain, SlotsClient } from "../client";

/**
 * React hook that creates a memoized {@link SlotsClient} from wagmi's public/wallet clients.
 *
 * @param chainId - Optional chain ID override. Defaults to the connected chain.
 * @returns A configured SlotsClient instance.
 * @throws If no public client is available or the chain has no factory address.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const client = useSlotsClient(SlotsChain.BASE);
 *   // use client.getSlots(), client.buy(), etc.
 * }
 * ```
 */
export function useSlotsClient(chainId?: SlotsChain): SlotsClient {
  const publicClient = usePublicClient({ chainId });
  const { data: walletClient } = useWalletClient({ chainId });

  return useMemo(() => {
    if (!publicClient) throw new Error("No publicClient available");
    const resolvedChainId = (chainId ?? publicClient.chain.id) as SlotsChain;
    const factoryAddress =
      slotFactoryAddress[resolvedChainId as SupportedChainId];
    if (!factoryAddress)
      throw new Error(`No factory address for chain ${resolvedChainId}`);

    return new SlotsClient({
      chainId: resolvedChainId,
      factoryAddress,
      publicClient,
      walletClient: walletClient ?? undefined,
    });
  }, [chainId, publicClient, walletClient]);
}
