"use client";

import {
  compositeHookAbi,
  minimumTenureHookAbi,
} from "@0xslots/contracts/slots";
import { useQuery } from "@tanstack/react-query";
import { type Address, zeroAddress } from "viem";
import { usePublicClient } from "wagmi";
import { useChain } from "@/context/chain";

/** The minimum-tenure family id, as the hook itself reports it. */
const TENURE_FAMILY =
  "0x0d7513dbf4adcafafb5452802cd9f31f7756b1fea3b6105f694902aa59312b8b";

/**
 * How long this slot's hook protects its occupant, if it protects them at all.
 *
 * Asked of the hook by DESCRIPTOR first, not by address: the protocol's
 * optional discovery interface (`descriptors()`) returns a family id per
 * behaviour, so a CompositeHook fanning out to a tenure rule answers just as
 * well as a bare MinimumTenureHook. Matching on a known address instead would
 * draw the meter for the one hook this app ships with and silently omit it for
 * every equivalent someone else deployed.
 *
 * Falls back to reading `tenureSeconds()` directly, for a hook that predates
 * descriptors or declines to implement them. A revert on both, or an unknown
 * family, means "no tenure window" — which is an ordinary answer, not an error:
 * most slots have no hook at all.
 */
export function useTenureWindow(hook: Address | undefined) {
  const { chainId } = useChain();
  const publicClient = usePublicClient({ chainId });
  const attached = !!hook && hook !== zeroAddress;

  const { data } = useQuery({
    queryKey: ["slots", "tenure-window", chainId, hook],
    enabled: attached && !!publicClient,
    // A hook's declared duration is immutable — MinimumTenureHook is a
    // stateless singleton, one deploy per duration.
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async (): Promise<bigint | null> => {
      // 1. Descriptors, where the hook offers them.
      try {
        const descriptors = (await publicClient!.readContract({
          address: hook!,
          abi: compositeHookAbi,
          functionName: "descriptors",
        })) as readonly { family: `0x${string}`; data: `0x${string}` }[];
        const tenure = descriptors.find(
          (d) => d.family.toLowerCase() === TENURE_FAMILY,
        );
        // `data` is the abi-encoded duration for this family. A descriptor that
        // carries none is still a valid claim to the family, so fall through
        // rather than treating an empty payload as "no window".
        if (tenure && tenure.data && tenure.data.length >= 66)
          return BigInt(tenure.data.slice(0, 66));
      } catch {
        // No descriptors(), or a revert. Both are allowed — it is optional.
      }

      // 2. The direct read, for a plain MinimumTenureHook.
      try {
        return (await publicClient!.readContract({
          address: hook!,
          abi: minimumTenureHookAbi,
          functionName: "tenureSeconds",
        })) as bigint;
      } catch {
        return null;
      }
    },
  });

  return data ?? null;
}
