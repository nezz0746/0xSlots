"use client";

import { slotAbi } from "@0xslots/contracts";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { usePublicClient } from "wagmi";
import { useChain } from "@/context/chain";

/**
 * The slot's own arithmetic bounds, read from the chain.
 *
 * `MAX_PRICE` and `MAX_TAX_BPS` exist so `price * taxPercentage * elapsed`
 * cannot be driven to overflow — which used to revert `_settle()`, and with it
 * every entry point including `liquidate()`, bricking a slot permanently.
 *
 * Read rather than hardcoded, deliberately. A constant copied into the client
 * silently rots the day the contract changes, and this codebase has already
 * paid for that once: `IUTILITY_INTERFACE_ID` in `use-module-check.ts` carried
 * a stale value long enough that every genuine utility was quietly failing its
 * ERC-165 check.
 *
 * Returns `undefined` while loading. Callers should treat that as "no ceiling
 * known yet" and let the contract be the backstop, rather than blocking input.
 */
export function useSlotBounds(slotAddress?: Address) {
  const { chainId } = useChain();
  const client = usePublicClient({ chainId });

  const { data } = useQuery({
    // Not under an `offer-book`/subgraph root: these are immutable constants,
    // so they never need invalidating after a transaction.
    queryKey: ["slot-bounds", chainId, slotAddress],
    enabled: !!client && !!slotAddress,
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: async () => {
      if (!client || !slotAddress) return undefined;
      const [maxPrice, maxTaxBps] = await Promise.all([
        client.readContract({
          address: slotAddress,
          abi: slotAbi,
          functionName: "maxPrice",
        }) as Promise<bigint>,
        client.readContract({
          address: slotAddress,
          abi: slotAbi,
          functionName: "maxTaxBps",
        }) as Promise<bigint>,
      ]);
      return { maxPrice, maxTaxBps };
    },
  });

  return data;
}
