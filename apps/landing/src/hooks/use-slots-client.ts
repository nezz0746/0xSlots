"use client";

import { type SlotsChain, SlotsClient } from "@0xslots/sdk";
import { useMemo } from "react";
import { usePublicClient, useWalletClient } from "wagmi";
import { useChain } from "@/context/chain";
import { INDEXER_API_KEY, indexerUrlFor } from "@/lib/indexer";

/**
 * Returns a unified SlotsClient wired to the current chain.
 * Read-only if no wallet is connected; read+write otherwise.
 */
export function useSlotsClient(): SlotsClient {
  const { chainId } = useChain();
  const publicClient = usePublicClient({ chainId });
  const { data: walletClient } = useWalletClient({ chainId });

  return useMemo(
    () =>
      new SlotsClient({
        chainId: chainId as SlotsChain,
        publicClient: publicClient ?? undefined,
        walletClient: walletClient ?? undefined,
        apiUrl: indexerUrlFor(chainId),
        apiKey: INDEXER_API_KEY,
      }),
    [chainId, publicClient, walletClient],
  );
}
