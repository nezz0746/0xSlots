"use client";

import { slotAbi } from "@0xslots/contracts";
import { type Address, erc20Abi } from "viem";
import { useReadContract, useReadContracts } from "wagmi";

export type SlotOnChain = {
  // Identity
  id: string;
  recipient: string;
  currency: string;
  manager: string;
  mutableTax: boolean;
  mutableUtility: boolean;
  mutablePolicy: boolean;
  // State
  occupant: string | null;
  price: bigint;
  utility: string;
  liquidationBountyBps: bigint;
  minDepositSeconds: bigint;
  taxPercentage: bigint;
  // Financials
  deposit: bigint;
  collectedTax: bigint;
  taxOwed: bigint;
  lastSettled: bigint;
  secondsUntilLiquidation: bigint;
  insolvent: boolean;
  // Pending updates — at most one per dimension, applied together on the next
  // ownership transition. The `*ProposedAt` stamps are unix seconds and are
  // what separates a change queued last week from one queued moments ago;
  // zero alongside a set `has*` flag means the slot predates them being
  // recorded.
  hasPendingTax: boolean;
  pendingTaxPercentage: bigint;
  taxProposedAt: bigint;
  hasPendingUtility: boolean;
  pendingUtility: string;
  utilityProposedAt: bigint;
  hasPendingPolicy: boolean;
  pendingPolicy: string | null;
  policyProposedAt: bigint;
  // v3 occupancy layer
  occupancyPolicy: string | null;
  occupiedSince: bigint;
  // Currency metadata
  currencyName?: string;
  currencySymbol?: string;
  currencyDecimals?: number;

  // ── deprecated aliases ──────────────────────────────────────
  // The storage moved to clearer names; these mirror the deprecated
  // `module()` / `mutableModule()` getters the contract still ships, so a
  // consumer on the old names keeps working for one release.

  /** @deprecated use `utility` */
  module: string;
  /** @deprecated use `mutableUtility` */
  mutableModule: boolean;
  /** @deprecated use `hasPendingUtility` */
  hasPendingModule: boolean;
  /** @deprecated use `pendingUtility` */
  pendingModule: string;
};

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/**
 * The raw `getSlotInfo()` tuple. Field names must match the Solidity struct
 * exactly — viem decodes by ABI component name, so a mismatch here reads back
 * `undefined` rather than failing loudly. This drifted once already: the SDK
 * carried `module` / `mutableModule` while the contract had renamed them to
 * `utility` / `mutableUtility`, and only a stale checked-in ABI kept the two
 * agreeing.
 */
type SlotInfoResult = {
  recipient: string;
  currency: string;
  manager: string;
  mutableTax: boolean;
  mutableUtility: boolean;
  mutablePolicy: boolean;
  occupant: string;
  price: bigint;
  taxPercentage: bigint;
  utility: string;
  liquidationBountyBps: bigint;
  minDepositSeconds: bigint;
  deposit: bigint;
  collectedTax: bigint;
  taxOwed: bigint;
  lastSettled: bigint;
  secondsUntilLiquidation: bigint;
  insolvent: boolean;
  hasPendingTax: boolean;
  pendingTaxPercentage: bigint;
  hasPendingUtility: boolean;
  pendingUtility: string;
  occupancyPolicy: string;
  occupiedSince: bigint;
  hasPendingPolicy: boolean;
  pendingPolicy: string;
  taxProposedAt: bigint;
  utilityProposedAt: bigint;
  policyProposedAt: bigint;
};

function parseSlotInfo(
  slotAddress: string,
  info: SlotInfoResult,
  currencyMeta?: { name?: string; symbol?: string; decimals?: number },
): SlotOnChain {
  return {
    id: slotAddress.toLowerCase(),
    recipient: info.recipient.toLowerCase(),
    currency: info.currency.toLowerCase(),
    manager: info.manager.toLowerCase(),
    mutableTax: info.mutableTax,
    mutableUtility: info.mutableUtility,
    mutablePolicy: info.mutablePolicy,
    occupant:
      info.occupant === ZERO_ADDRESS ? null : info.occupant.toLowerCase(),
    price: info.price,
    taxPercentage: info.taxPercentage,
    utility: info.utility.toLowerCase(),
    liquidationBountyBps: info.liquidationBountyBps,
    minDepositSeconds: info.minDepositSeconds,
    deposit: info.deposit,
    collectedTax: info.collectedTax,
    taxOwed: info.taxOwed,
    lastSettled: info.lastSettled,
    secondsUntilLiquidation: info.secondsUntilLiquidation,
    insolvent: info.insolvent,
    hasPendingTax: info.hasPendingTax,
    pendingTaxPercentage: info.pendingTaxPercentage,
    taxProposedAt: info.taxProposedAt,
    hasPendingUtility: info.hasPendingUtility,
    pendingUtility: info.pendingUtility.toLowerCase(),
    utilityProposedAt: info.utilityProposedAt,
    hasPendingPolicy: info.hasPendingPolicy,
    pendingPolicy:
      info.pendingPolicy === ZERO_ADDRESS
        ? null
        : info.pendingPolicy.toLowerCase(),
    policyProposedAt: info.policyProposedAt,
    // Occupancy layer. `epochSeconds` is deliberately absent from SlotInfo:
    // six slots still carry a value in storage, nothing reads it, and
    // reporting a delay that is never applied would mislead.
    occupancyPolicy:
      info.occupancyPolicy === ZERO_ADDRESS
        ? null
        : info.occupancyPolicy.toLowerCase(),
    occupiedSince: info.occupiedSince,
    currencyName: currencyMeta?.name,
    currencySymbol: currencyMeta?.symbol,
    currencyDecimals: currencyMeta?.decimals,
    // Deprecated aliases, filled from the same source as the canonical fields.
    module: info.utility.toLowerCase(),
    mutableModule: info.mutableUtility,
    hasPendingModule: info.hasPendingUtility,
    pendingModule: info.pendingUtility.toLowerCase(),
  };
}

// Block-watching removed — use refetch() for manual refresh to save RPC calls

/**
 * Fetch a single slot's complete state from on-chain via getSlotInfo() + currency metadata.
 *
 * @param slotAddress - The slot contract address
 * @param chainId - The chain ID to read from
 */
export function useSlotOnChain(
  slotAddress: string,
  chainId: number,
): {
  data: SlotOnChain | null;
  isLoading: boolean;
  refetch: () => void;
} {
  // Manual refetch only — no block watching
  const addr = slotAddress as Address;

  const {
    data: info,
    isLoading: infoLoading,
    refetch,
  } = useReadContract({
    address: addr,
    abi: slotAbi,
    functionName: "getSlotInfo",
    chainId,
    query: { gcTime: 0, staleTime: 0, refetchOnMount: "always" },
  });

  // Currency metadata — only fetch when we have info (static, can cache)
  const currencyAddr = info
    ? ((info as SlotInfoResult).currency as Address)
    : undefined;
  const { data: currencyMeta, isLoading: metaLoading } = useReadContracts({
    contracts: currencyAddr
      ? [
          {
            address: currencyAddr,
            abi: erc20Abi,
            functionName: "name",
            chainId,
          },
          {
            address: currencyAddr,
            abi: erc20Abi,
            functionName: "symbol",
            chainId,
          },
          {
            address: currencyAddr,
            abi: erc20Abi,
            functionName: "decimals",
            chainId,
          },
        ]
      : [],
    query: { enabled: !!currencyAddr, staleTime: Infinity },
  });

  const isLoading = infoLoading || metaLoading;

  const slot = info
    ? parseSlotInfo(
        slotAddress,
        info as SlotInfoResult,
        currencyMeta
          ? {
              name: currencyMeta[0]?.result as string | undefined,
              symbol: currencyMeta[1]?.result as string | undefined,
              decimals: currencyMeta[2]?.result as number | undefined,
            }
          : undefined,
      )
    : null;

  return { data: slot, isLoading, refetch };
}

/**
 * Fetch multiple slots' state via multicall getSlotInfo().
 *
 * @param slotAddresses - Array of slot contract addresses
 * @param chainId - The chain ID to read from
 */
export function useSlotsOnChain(
  slotAddresses: string[],
  chainId: number,
): {
  data: SlotOnChain[];
  isLoading: boolean;
  refetch: () => void;
} {
  // Manual refetch only — no block watching
  const contracts = slotAddresses.map((addr) => ({
    address: addr as Address,
    abi: slotAbi,
    functionName: "getSlotInfo" as const,
    chainId,
  }));

  const {
    data: infos,
    isLoading: infosLoading,
    refetch,
  } = useReadContracts({
    contracts,
    query: {
      enabled: slotAddresses.length > 0,
      gcTime: 0,
      staleTime: 0,
      refetchOnMount: "always",
    },
  });

  // Get unique currencies to fetch metadata
  const currencies = new Set<string>();
  if (infos) {
    for (const r of infos) {
      if (r.result)
        currencies.add((r.result as SlotInfoResult).currency.toLowerCase());
    }
  }
  const currencyList = Array.from(currencies);

  const { data: metaResults, isLoading: metaLoading } = useReadContracts({
    contracts: currencyList.flatMap((c) => [
      {
        address: c as Address,
        abi: erc20Abi,
        functionName: "name" as const,
        chainId,
      },
      {
        address: c as Address,
        abi: erc20Abi,
        functionName: "symbol" as const,
        chainId,
      },
      {
        address: c as Address,
        abi: erc20Abi,
        functionName: "decimals" as const,
        chainId,
      },
    ]),
    query: { enabled: currencyList.length > 0 },
  });

  // Build currency metadata map
  const currencyMeta: Record<
    string,
    { name?: string; symbol?: string; decimals?: number }
  > = {};
  if (metaResults) {
    currencyList.forEach((c, i) => {
      currencyMeta[c] = {
        name: metaResults[i * 3]?.result as string | undefined,
        symbol: metaResults[i * 3 + 1]?.result as string | undefined,
        decimals: metaResults[i * 3 + 2]?.result as number | undefined,
      };
    });
  }

  const isLoading = infosLoading || metaLoading;

  const slots: SlotOnChain[] = [];
  if (infos) {
    for (let i = 0; i < infos.length; i++) {
      const r = infos[i];
      if (r.result) {
        const result = r.result as SlotInfoResult;
        const currency = result.currency.toLowerCase();
        slots.push(
          parseSlotInfo(slotAddresses[i], result, currencyMeta[currency]),
        );
      }
    }
  }

  return { data: slots, isLoading, refetch };
}
