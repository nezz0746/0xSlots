"use client";

import { type Query, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { Hash } from "viem";
import { usePublicClient } from "wagmi";
import { useChain } from "@/context/chain";
import { useSlotsClient } from "./use-slots-client";

/**
 * wagmi's own query keys. These read the chain directly, so they are already
 * accurate the moment a receipt lands.
 */
const ONCHAIN_ROOTS = new Set(["readContract", "readContracts", "balance"]);

/**
 * Content-addressed or chain-independent data. No transaction can change these,
 * so re-fetching them is pure waste.
 */
const IMMUTABLE_ROOTS = new Set(["ipfs-content", "ens", "erc20-check"]);

function rootKey(query: Query): string | null {
  const root = query.queryKey[0];
  return typeof root === "string" ? root : null;
}

function isOnChain(query: Query): boolean {
  const root = rootKey(query);
  return root !== null && ONCHAIN_ROOTS.has(root);
}

/**
 * Everything that is neither a direct chain read nor immutable is treated as
 * subgraph-derived. Defaulting this way means a query added later is refreshed
 * automatically instead of being silently forgotten.
 */
function isSubgraphDerived(query: Query): boolean {
  const root = rootKey(query);
  if (root === null) return false;
  return !ONCHAIN_ROOTS.has(root) && !IMMUTABLE_ROOTS.has(root);
}

const POLL_INTERVAL_MS = 1_000;
const POLL_TIMEOUT_MS = 45_000;

/**
 * Refresh cached data after a transaction confirms.
 *
 * Chain reads and subgraph reads are refreshed on different schedules on
 * purpose: the chain is authoritative immediately, while the subgraph trails
 * the head by some blocks. Invalidating subgraph queries as soon as the receipt
 * arrives would just re-cache the same pre-transaction response, which is what
 * made the UI appear stuck until a manual refresh.
 */
export function usePostTxRefresh() {
  const queryClient = useQueryClient();
  const { chainId } = useChain();
  const publicClient = usePublicClient({ chainId });
  const slotsClient = useSlotsClient();

  return useCallback(
    async (hash: Hash) => {
      // 1. On-chain state is correct as of the receipt. This is what drives the
      //    occupant UI, so refresh it before doing anything slow.
      queryClient.invalidateQueries({ predicate: isOnChain });

      const refreshSubgraph = () =>
        queryClient.invalidateQueries({ predicate: isSubgraphDerived });

      if (!publicClient) {
        refreshSubgraph();
        return;
      }

      let blockNumber: bigint;
      try {
        ({ blockNumber } = await publicClient.getTransactionReceipt({ hash }));
      } catch {
        refreshSubgraph();
        return;
      }

      // 2. Wait for the indexer to reach our block before refreshing anything
      //    subgraph-backed. Bounded, so a stalled indexer degrades to the old
      //    behaviour rather than leaving the UI never refreshing.
      const deadline = Date.now() + POLL_TIMEOUT_MS;
      while (Date.now() < deadline) {
        try {
          const { _meta } = await slotsClient.getMeta();
          // `status` is keyed by ponder's own chain label, which this app does
          // not know, so the entry is matched on its numeric id instead.
          const chain = Object.values(_meta?.status ?? {}).find(
            (c) => c?.id === slotsClient.getChainId(),
          );
          if (BigInt(chain?.block?.number ?? 0) >= blockNumber) break;
        } catch {
          break; // indexer unreachable — refresh anyway and let queries retry
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }

      refreshSubgraph();
    },
    [queryClient, publicClient, slotsClient],
  );
}
