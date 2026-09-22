"use client";

import { minimumTenureModuleAbi } from "@0xslots/contracts/slots";
import { unpackScopes, ZERO_SETTINGS } from "@0xslots/sdk/slots";
import { type Address, getAddress, isAddress } from "viem";
import { useBytecode, useReadContracts } from "wagmi";
import { useSlotsFactory } from "@/hooks/slots/use-slots";
import {
  describeScopes,
  type ScopeSet,
} from "@/lib/module-scopes";

/**
 * The successor to the old `useModuleCheck`.
 *
 * Modules advertised themselves through ERC-165, so probing one meant asking
 * whether it claimed an interface id — and that id rotted every time the
 * interface changed, silently downgrading every genuine module to "probable".
 * A module declares itself differently and better: `manifest()` returns the exact
 * set of callbacks it wants, which is data rather than a claim, and the slot
 * snapshots that set once at attach time. So the probe here asks the same
 * question the slot will ask, and there is no constant to keep in sync.
 *
 * Three things are worth separating at form-fill time, because the chain
 * collapses all of them into one revert:
 *
 *  - `no-code`   — nothing deployed at this address ON THIS CHAIN. Overwhelmingly
 *                  a module address copied from another network.
 *  - `not-a-app`— has code, but `manifest()` does not answer. An ERC-20, a proxy
 *                  pointing nowhere, the wrong contract entirely.
 *  - `inert`     — answers, but asks for no scopes. The slot REJECTS this
 *                  outright rather than attaching a module that can never fire,
 *                  so it is a hard error here too, not a warning.
 *
 * Whether anyone vouches for a module is not asked here and never gates anything:
 * a slot may point at any address with code. The `knownModules` list this app
 * ships is the only opinion in the product, and it is a label, not a gate.
 */

/**
 * Any module, read through one module's generated ABI.
 *
 * `manifest` is `ISlotModule`, so every module answers it with the same selector
 * and the same `Manifest` — which is why the probe works on an address this
 * module has never heard of. Taken from the package rather than written here so
 * the tuple cannot drift from the struct the slot decodes.
 */
const moduleProbeAbi = minimumTenureModuleAbi;

export type ModuleCheckStatus = "ok" | "inert" | "not-a-app" | "no-code";

export interface ModuleCheckData {
  address: Address;
  status: ModuleCheckStatus;
  /** The raw declared set, for rendering. */
  scopes: ScopeSet;
  /** The fee it declares for an empty configuration. Null when it did not answer. */
  fee: { feeBps: number; feeRecipient: Address } | null;
  /** Declared `strict`: its `after` calls are uncapped and may revert. */
  strict: boolean;
  /** The callbacks it declared, in the order `Scopes` declares them. */
  granted: string[];
  /**
   * What it may REFUSE, and what it is merely told about.
   *
   * The split matters more than the list. A `before` module is a veto — it can
   * stop your buy, your sale or your reprice. An `after` module is a
   * notification: gas-capped, its revert swallowed, unable to change the
   * outcome. Presenting all eight as one row of "callbacks" hid the only
   * distinction an occupant actually cares about.
   */
  mayRefuse: string[];
  notifiedOn: string[];
}

export function useModuleCheck(rawAddress: string, chainId?: number) {
  const factory = useSlotsFactory();

  let checksummed: Address | null = null;
  try {
    if (isAddress(rawAddress.trim(), { strict: false })) {
      checksummed = getAddress(rawAddress.trim());
    }
  } catch {
    // not an address — nothing to probe
  }

  // Asked separately from `manifest()` because a revert cannot tell the two apart:
  // an address with no code and an address whose `manifest()` reverts both come
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
              abi: moduleProbeAbi,
              functionName: "manifest",
              args: [ZERO_SETTINGS],
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

  const result: ModuleCheckData | null = (() => {
    if (!checksummed) return null;
    if (bytecode.isLoading || !data || data.length < 1) return null;

    const hasCode = !!bytecode.data && bytecode.data !== "0x";

    if (!hasCode)
      return {
        address: checksummed,
        status: "no-code",
        fee: null,
        ...describeScopes(null),
      };

    const offerRes = data[0];
    if (!offerRes || offerRes.status !== "success")
      return {
        address: checksummed,
        status: "not-a-app",
        fee: null,
        ...describeScopes(null),
      };

    const offer = offerRes.result as {
      scopes: number;
      feeBps: number;
      feeRecipient: Address;
    };
    const described = describeScopes(
      unpackScopes(offer.scopes),
    );

    return {
      address: checksummed,
      status: described.granted.length === 0 ? "inert" : "ok",
      fee: { feeBps: offer.feeBps, feeRecipient: offer.feeRecipient },
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
