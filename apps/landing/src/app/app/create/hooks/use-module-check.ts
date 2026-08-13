"use client";

import { type Abi, type Address, getAddress, isAddress } from "viem";
import { useReadContracts } from "wagmi";

/**
 * ERC-165 id for the utility HOOKS — `type(IUtility).interfaceId`, which is
 * equal to `type(ISlotsModule).interfaceId` by construction (the alias mirrors
 * it deliberately; see ISlotsModule.sol).
 *
 * Covers: onTransfer, onPriceUpdate, onRelease, onSettle, feeBps, feeRecipient.
 *
 * NOT name/version/metadataURI — those moved to `IModuleMetadata` and an ERC165
 * id is the XOR of an interface's OWN selectors, so they no longer count toward
 * this one. That is why there are two ids below, matching the two assertions in
 * `SlotFactory.setUtilityVerified`.
 *
 * ── Keep these in sync with the contracts ──
 * A hardcoded id silently rots. This one held `0x0871cc1c` — the value from
 * before `onSettle` was added to the interface — so every genuine utility had
 * been failing the ERC-165 branch and falling through to "probable" with a
 * warning, rather than "verified". Recompute with `type(IUtility).interfaceId`
 * whenever the interface changes.
 */
export const IUTILITY_INTERFACE_ID = "0xe120614a" as `0x${string}`;

/** `type(IModuleMetadata).interfaceId` — name(), version(), metadataURI(). */
export const IMODULE_METADATA_INTERFACE_ID = "0x51eed0df" as `0x${string}`;

/** @deprecated Use {@link IUTILITY_INTERFACE_ID}. */
export const ISLOTS_MODULE_INTERFACE_ID = IUTILITY_INTERFACE_ID;

const moduleProbeAbi = [
  {
    type: "function",
    name: "supportsInterface",
    stateMutability: "view",
    inputs: [{ name: "interfaceId", type: "bytes4" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "version",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
] as const satisfies Abi;

export type ModuleCheckStatus =
  /** ERC-165 confirms ISlotsModule support — definitive valid. */
  | "verified"
  /** name()/version() succeed but ERC-165 missing — probable, allow with warning. */
  | "probable"
  /** name()/version() revert — not module-shaped. */
  | "invalid"
  /** No contract code at this address. */
  | "no-code";

export interface ModuleCheckData {
  address: Address;
  status: ModuleCheckStatus;
  /** Module display name when probe succeeds. */
  name: string | null;
  version: string | null;
}

/**
 * Probe a custom module address to check whether it actually implements
 * ISlotsModule. Surfaces three failure modes that the contract's `extcodesize`
 * check cannot distinguish at form-fill time:
 *   - no-code:  empty address (e.g. wrong-chain Sepolia/Base mismatch)
 *   - invalid:  has code but is not module-shaped (e.g. ERC-20 token)
 *   - probable: has module functions but does not advertise ERC-165
 */
export function useModuleCheck(rawAddress: string, chainId?: number) {
  let checksummed: Address | null = null;
  try {
    if (isAddress(rawAddress.trim(), { strict: false })) {
      checksummed = getAddress(rawAddress.trim());
    }
  } catch {
    // invalid
  }

  const { data, isLoading, isError, error } = useReadContracts({
    contracts: checksummed
      ? [
          {
            address: checksummed,
            abi: moduleProbeAbi,
            functionName: "supportsInterface",
            args: [IUTILITY_INTERFACE_ID],
            chainId,
          },
          // Second id, mirroring `SlotFactory.setUtilityVerified`. Passing only
          // the hooks id would call a utility "verified" here that the factory
          // then refuses, which is a worse answer than "probable".
          {
            address: checksummed,
            abi: moduleProbeAbi,
            functionName: "supportsInterface",
            args: [IMODULE_METADATA_INTERFACE_ID],
            chainId,
          },
          {
            address: checksummed,
            abi: moduleProbeAbi,
            functionName: "name",
            chainId,
          },
          {
            address: checksummed,
            abi: moduleProbeAbi,
            functionName: "version",
            chainId,
          },
        ]
      : [],
    query: {
      enabled: !!checksummed,
      retry: false,
      staleTime: Number.POSITIVE_INFINITY,
    },
  });

  const result: ModuleCheckData | null = (() => {
    if (!checksummed || !data || data.length < 4) return null;

    const supportsHooks = data[0];
    const supportsMetadata = data[1];
    const nameRes = data[2];
    const versionRes = data[3];
    if (!supportsHooks || !supportsMetadata || !nameRes || !versionRes)
      return null;

    const name =
      nameRes.status === "success" ? (nameRes.result as string) : null;
    const version =
      versionRes.status === "success" ? (versionRes.result as string) : null;
    // Both, because the factory demands both. Either one alone advertises a
    // utility this app would call verified and the chain would reject.
    const isErc165Module =
      supportsHooks.status === "success" &&
      supportsHooks.result === true &&
      supportsMetadata.status === "success" &&
      supportsMetadata.result === true;

    let status: ModuleCheckStatus;
    if (isErc165Module) {
      status = "verified";
    } else if (name !== null && version !== null) {
      status = "probable";
    } else if (
      name === null &&
      version === null &&
      supportsHooks.status !== "success"
    ) {
      // Everything reverted → likely no code (or non-contract returning empty data)
      status = "no-code";
    } else {
      status = "invalid";
    }

    return { address: checksummed, status, name, version };
  })();

  return {
    data: result,
    isLoading: isLoading && !!checksummed,
    isError,
    error,
    isValidAddress: !!checksummed,
  };
}
