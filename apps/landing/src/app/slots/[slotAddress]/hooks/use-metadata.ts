"use client";

import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { useChain } from "@/context/chain";
import { useSlotsClient } from "@/hooks/use-slots-client";
import { useSlotsClient as useSubgraphSlotsClient } from "@/hooks/use-v3";

type AdContent = {
  type: string;
  data: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

/**
 * Fetch IPFS content via the cached Next.js API route.
 */
async function fetchIpfsContent(uri: string): Promise<AdContent | null> {
  const res = await fetch(`/api/ipfs?uri=${encodeURIComponent(uri)}`);
  if (!res.ok) return null;
  return res.json();
}

/**
 * Read the current metadata URI from chain (RPC).
 */
export function useMetadataUri(
  moduleAddress: string | undefined,
  slotAddress: string,
) {
  const client = useSlotsClient();
  const { chainId } = useChain();

  return useQuery({
    queryKey: ["metadata-uri", chainId, slotAddress],
    queryFn: async () => {
      const uri = await client.modules.metadata.getURI(
        moduleAddress as Address,
        slotAddress as Address,
      );
      return uri || null;
    },
    staleTime: 10_000,
    enabled: !!slotAddress && !!moduleAddress,
  });
}

/**
 * Fetch ad content from IPFS for a given URI.
 * Cached forever on the server via /api/ipfs, and stale after 60s on the client.
 */
export function useIpfsContent(uri: string | null | undefined) {
  return useQuery({
    queryKey: ["ipfs-content", uri],
    queryFn: () => fetchIpfsContent(uri!),
    staleTime: Infinity, // IPFS content is immutable
    enabled: !!uri,
  });
}

/**
 * Fetch metadata update history from the indexer.
 */
export function useMetadataHistory(slotAddress: string) {
  const subgraphClient = useSubgraphSlotsClient();
  const { chainId } = useChain();

  return useQuery({
    queryKey: ["metadata-history", chainId, slotAddress],
    queryFn: async () => {
      const { metadataUpdatedEvents } =
        await subgraphClient.modules.metadata.getUpdateHistory({
          where: { slot: slotAddress.toLowerCase() },
          limit: 10,
        });
      return metadataUpdatedEvents.items;
    },
    staleTime: 10_000,
    enabled: !!slotAddress,
  });
}
