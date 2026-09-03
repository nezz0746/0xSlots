"use client";

import { compositeHookAbi } from "@0xslots/contracts/slots";
import { useQuery } from "@tanstack/react-query";
import { type Address, type Hex, zeroAddress } from "viem";
import { usePublicClient } from "wagmi";
import { useChain } from "@/context/chain";

/** The minimum-tenure family id, as the hook itself reports it. */
const TENURE_FAMILY =
  "0x0d7513dbf4adcafafb5452802cd9f31f7756b1fea3b6105f694902aa59312b8b";

/**
 * How long this slot's hook protects its occupant, if it protects them at all.
 *
 * The window is the SLOT's, not the hook's. One `MinimumTenureHook` serves every
 * duration and reads the number out of `hookData` on each callback, so the only
 * source that can be right for a given slot is that slot's own storage — which
 * the caller already has. This used to read `tenureSeconds()` off the hook,
 * back when the duration was an immutable and the address was the
 * configuration; against the current hook that read does not exist, and against
 * an old one it would report a window the slot is not enforcing.
 *
 * What still takes a round trip is WHETHER the number means a tenure at all.
 * `hookData` is opaque — a different hook's configuration is 32 bytes too — so
 * the hook is asked by DESCRIPTOR whether it claims the minimum-tenure family.
 * By family rather than by address, so a CompositeHook fanning out to a tenure
 * rule answers as well as a bare one.
 *
 * A hook with no descriptors, an unknown family, or zero data all mean "no
 * window" — an ordinary answer, not an error. Most slots have no hook at all.
 */
export function useTenureWindow(
  hook: Address | undefined,
  hookData: Hex | undefined,
) {
  const { chainId } = useChain();
  const publicClient = usePublicClient({ chainId });
  const attached = !!hook && hook !== zeroAddress;

  const { data } = useQuery({
    queryKey: ["slots", "tenure-family", chainId, hook],
    enabled: attached && !!publicClient,
    // Which families a hook claims is fixed by its code, so this answer only
    // changes if the hook itself is replaced — at which point the key changes
    // with it.
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async (): Promise<boolean> => {
      try {
        const descriptors = (await publicClient!.readContract({
          address: hook!,
          abi: compositeHookAbi,
          functionName: "descriptors",
        })) as readonly { family: `0x${string}` }[];
        return descriptors.some(
          (d) => d.family.toLowerCase() === TENURE_FAMILY,
        );
      } catch {
        // No descriptors(), or a revert. Both are allowed — it is optional.
        return false;
      }
    },
  });

  if (!data || !hookData) return null;
  const seconds = BigInt(hookData);
  return seconds > 0n ? seconds : null;
}
