"use client";

import { type Abi, type Address, getAddress, isAddress } from "viem";
import { useBytecode, useReadContracts } from "wagmi";
import { useSlotsFactory } from "@/hooks/slots/use-slots";
import { describeFlags, type HookFlagSet } from "@/lib/hook-flags";

/**
 * The successor to the old `useModuleCheck`.
 *
 * Modules advertised themselves through ERC-165, so probing one meant asking
 * whether it claimed an interface id — and that id rotted every time the
 * interface changed, silently downgrading every genuine module to "probable".
 * A hook declares itself differently and better: `hooks()` returns the exact
 * set of callbacks it wants, which is data rather than a claim, and the slot
 * snapshots that set once at attach time. So the probe here asks the same
 * question the slot will ask, and there is no constant to keep in sync.
 *
 * Three things are worth separating at form-fill time, because the chain
 * collapses all of them into one revert:
 *
 *  - `no-code`   — nothing deployed at this address ON THIS CHAIN. Overwhelmingly
 *                  a hook address copied from another network.
 *  - `not-a-hook`— has code, but `hooks()` does not answer. An ERC-20, a proxy
 *                  pointing nowhere, the wrong contract entirely.
 *  - `inert`     — answers, but subscribes to nothing. The slot REJECTS this
 *                  outright rather than attaching a hook that can never fire,
 *                  so it is a hard error here too, not a warning.
 *
 * Whether anyone vouches for a hook is not asked here and never gates anything:
 * a slot may point at any address with code. The `knownHooks` list this app
 * ships is the only opinion in the product, and it is a label, not a gate.
 */

const hookProbeAbi = [
  {
    type: "function",
    name: "subscriptions",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "beforeBuy", type: "bool" },
          { name: "beforeSelfAssess", type: "bool" },
          { name: "afterBuy", type: "bool" },
          { name: "afterRelease", type: "bool" },
          { name: "afterLiquidate", type: "bool" },
          { name: "afterSettle", type: "bool" },
          { name: "strict", type: "bool" },
        ],
      },
    ],
  },
] as const satisfies Abi;

export type HookCheckStatus = "ok" | "inert" | "not-a-hook" | "no-code";

export interface HookCheckData {
  address: Address;
  status: HookCheckStatus;
  /** The raw declared set, for rendering. */
  flags: HookFlagSet;
  /** Declared `strict`: its `after` calls are uncapped and may revert. */
  strict: boolean;
  /** The callbacks it declared, in the order `HookFlags` declares them. */
  subscriptions: string[];
  /**
   * What it may REFUSE, and what it is merely told about.
   *
   * The split matters more than the list. A `before` hook is a veto — it can
   * stop your buy, your sale or your reprice. An `after` hook is a
   * notification: gas-capped, its revert swallowed, unable to change the
   * outcome. Presenting all eight as one row of "callbacks" hid the only
   * distinction an occupant actually cares about.
   */
  mayRefuse: string[];
  notifiedOn: string[];
}

export function useHookCheck(rawAddress: string, chainId?: number) {
  const factory = useSlotsFactory();

  let checksummed: Address | null = null;
  try {
    if (isAddress(rawAddress.trim(), { strict: false })) {
      checksummed = getAddress(rawAddress.trim());
    }
  } catch {
    // not an address — nothing to probe
  }

  // Asked separately from `hooks()` because a revert cannot tell the two apart:
  // an address with no code and an address whose `hooks()` reverts both come
  // back as a failed call, and they call for opposite advice.
  const bytecode = useBytecode({
    address: checksummed ?? undefined,
    chainId,
    query: { enabled: !!checksummed, staleTime: Number.POSITIVE_INFINITY },
  });

  const { data, isLoading, isError, error } = useReadContracts({
    contracts:
      checksummed && factory
        ? [
            {
              address: checksummed,
              abi: hookProbeAbi,
              functionName: "subscriptions",
              chainId,
            } as const,
          ]
        : [],
    query: {
      enabled: !!checksummed && !!factory,
      retry: false,
      staleTime: Number.POSITIVE_INFINITY,
    },
  });

  const result: HookCheckData | null = (() => {
    if (!checksummed) return null;
    if (bytecode.isLoading || !data || data.length < 1) return null;

    const hasCode = !!bytecode.data && bytecode.data !== "0x";

    if (!hasCode)
      return {
        address: checksummed,
        status: "no-code",
        ...describeFlags(null),
      };

    const flagsRes = data[0];
    if (!flagsRes || flagsRes.status !== "success")
      return {
        address: checksummed,
        status: "not-a-hook",
        ...describeFlags(null),
      };

    const described = describeFlags(
      flagsRes.result as unknown as Record<string, boolean>,
    );

    return {
      address: checksummed,
      status: described.subscriptions.length === 0 ? "inert" : "ok",
      ...described,
    };
  })();

  return {
    data: result,
    isLoading: (isLoading || bytecode.isLoading) && !!checksummed,
    isError,
    error,
    isValidAddress: !!checksummed,
  };
}
