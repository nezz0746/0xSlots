"use client";

import { type SlotsChain, SlotsClient } from "@0xslots/sdk";
import { useMemo } from "react";
import { usePublicClient, useWalletClient } from "wagmi";
import { useChain } from "@/context/chain";
import { useSubgraphSource } from "@/context/subgraph-source";

/**
 * Returns a unified SlotsClient wired to the current chain.
 * Read-only if no wallet is connected; read+write otherwise.
 */
export function useSlotsClient(): SlotsClient {
  const { chainId } = useChain();
  const { source } = useSubgraphSource();
  const publicClient = usePublicClient({ chainId });
  const { data: walletClient } = useWalletClient({ chainId });

  return useMemo(
    () =>
      new SlotsClient({
        chainId: chainId as SlotsChain,
        publicClient: publicClient ?? undefined,
        walletClient: walletClient ?? undefined,
        // Reads only. Writes go through the wallet client to the chain and are
        // unaffected by which copy of the index is being read.
        subgraphSource: source,
        subgraphApiKey: process.env.NEXT_PUBLIC_SUBGRAPH_API_KEY,
      }),
    [chainId, source, publicClient, walletClient],
  );
}
