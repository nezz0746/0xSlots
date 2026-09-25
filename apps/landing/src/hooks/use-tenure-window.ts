"use client";

import { useQuery } from "@tanstack/react-query";
import { type Address, decodeAbiParameters, type Hex, zeroAddress } from "viem";
import { usePublicClient } from "wagmi";
import { useChain } from "@/context/chain";
import { parseDefinition } from "./use-module-schema";

/** The tag a module puts on whichever of its fields is a tenure window. */
const TENURE = "minimum-tenure";

const abi = [
  {
    type: "function",
    name: "uiMetadata",
    stateMutability: "pure",
    inputs: [],
    outputs: [{ type: "string" }],
  },
] as const;

/**
 * How long this slot's module protects its occupant, if it protects them at all.
 *
 * The window is the SLOT's, not the module's: one deployment serves every
 * duration and reads the number out of the slot's configuration on each
 * callback, so the only source that can be right for a given slot is that
 * slot's own settings.
 *
 * What takes a round trip is WHETHER the number means a tenure at all, and
 * where inside the configuration it sits. Both come from the module's own
 * `definition()`: the field carrying `x-semantic: "minimum-tenure"` is the
 * window, whatever that module chose to call it. By tag rather than by address,
 * so somebody else's implementation of the same rule reads correctly without
 * this file learning about it.
 *
 * The settings are decoded against `x-abi`. That is the generic path: nothing
 * here knows AdLand packs three values, only that the schema says how to read
 * them back.
 *
 * A module with no definition, no tagged field, or an unreadable configuration
 * all mean "no window" — an ordinary answer, not an error. Most slots have no
 * module at all.
 */
export function useTenureWindow(
  module: Address | undefined,
  settings: Hex | undefined,
) {
  const { chainId } = useChain();
  const publicClient = usePublicClient({ chainId });
  const attached = !!module && module !== zeroAddress;

  const { data } = useQuery({
    queryKey: ["slots", "tenure-window", chainId, module, settings],
    enabled: attached && !!settings && !!publicClient,
    queryFn: async (): Promise<string | null> => {
      try {
        const raw = await publicClient!.readContract({
          address: module!,
          abi,
          functionName: "uiMetadata",
        });
        const config = parseDefinition(raw)?.settings;
        if (!config) return null;

        const index = config.fields.findIndex((f) => f.semantic === TENURE);
        if (index < 0) return null;

        const values = decodeAbiParameters(
          config.fields.map((f) => f.param),
          settings as Hex,
        );
        return String(values[index]);
      } catch {
        // No definition, empty settings, or bytes that do not decode.
        // All of them mean the same thing to a reader: no window to show.
        return null;
      }
    },
    // The schema is fixed by the module's code and the settings by the slot's terms,
    // so this only changes when one of them does — and both are in the key.
    staleTime: Number.POSITIVE_INFINITY,
  });

  if (!data) return null;
  const seconds = BigInt(data);
  return seconds > 0n ? seconds : null;
}
