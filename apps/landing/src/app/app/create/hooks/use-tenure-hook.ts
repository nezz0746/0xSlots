"use client";

import {
  getTenureHookFactoryAddress,
  isTenureHookDeployed,
  predictTenureHook,
} from "@0xslots/sdk/slots";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { usePublicClient } from "wagmi";
import { useChain } from "@/context/chain";

export interface TenureHookPrediction {
  /** Where the hook for this duration lives, or will live. */
  hook: Address;
  /** Whether it is already on chain. False means creating costs one extra tx. */
  deployed: boolean;
}

/**
 * The hook address for a tenure, before it necessarily exists.
 *
 * `MinimumTenureHookFactory` places one hook per duration at a CREATE2 address,
 * so `predict` is a pure view and is correct whether or not anything has been
 * deployed there — which is what lets the form show the resulting address while
 * the creator is still choosing the duration.
 *
 * `deployed` is the interesting half. One hook per duration means a popular
 * duration is almost always already there and creating a slot on it is a single
 * transaction; an unusual one needs a deploy first. That is a real difference in
 * what the button is about to do, so the form says which case it is in rather
 * than surprising the user with a second wallet prompt.
 *
 * Deliberately no `metadataURI`: passing one is a DIFFERENT configuration at a
 * DIFFERENT address, and quietly attaching one here would fork the canonical
 * per-duration address into a second family nobody asked for.
 */
export function useTenureHook(tenureSeconds: bigint, enabled = true) {
  const { chainId } = useChain();
  const publicClient = usePublicClient({ chainId });
  const factory = getTenureHookFactoryAddress(chainId);

  return useQuery({
    queryKey: ["tenure-hook", chainId, tenureSeconds.toString()],
    enabled: enabled && !!publicClient && !!factory && tenureSeconds > 0n,
    // The mapping from duration to address is fixed by CREATE2 and cannot
    // change; only `deployed` can, and only in one direction.
    staleTime: 30_000,
    queryFn: async (): Promise<TenureHookPrediction> => {
      const hook = await predictTenureHook({
        publicClient: publicClient!,
        tenureSeconds,
      });
      const deployed = await isTenureHookDeployed({
        publicClient: publicClient!,
        tenureSeconds,
      });
      return { hook, deployed };
    },
  });
}

/** Whether this chain has a tenure-hook factory at all. */
export function useHasTenureFactory(): boolean {
  const { chainId } = useChain();
  return !!getTenureHookFactoryAddress(chainId);
}
