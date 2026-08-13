"use client";

import { isNativeCurrency, NATIVE_CURRENCY } from "@0xslots/sdk";
import { useQuery } from "@tanstack/react-query";
import { type Address, erc20Abi, getAddress, isAddress } from "viem";
import { usePublicClient } from "wagmi";

export interface Erc20Info {
  name: string;
  symbol: string;
  decimals: number;
  address: Address;
}

export function useErc20Check(rawAddress: string) {
  const publicClient = usePublicClient();

  let checksummed: Address | null = null;
  try {
    if (isAddress(rawAddress.trim(), { strict: false })) {
      checksummed = getAddress(rawAddress.trim());
    }
  } catch {
    // invalid
  }

  const query = useQuery<Erc20Info>({
    queryKey: ["erc20-check", checksummed],
    enabled: !!checksummed && !!publicClient,
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async () => {
      if (!checksummed || !publicClient) throw new Error("No address");

      // The native sentinel is not a contract — answer without an RPC round
      // trip rather than issuing three calls that all revert.
      if (isNativeCurrency(checksummed)) {
        return {
          name: NATIVE_CURRENCY.name,
          symbol: NATIVE_CURRENCY.symbol,
          decimals: NATIVE_CURRENCY.decimals,
          address: checksummed,
        };
      }

      const [name, symbol, decimals] = await Promise.all([
        publicClient.readContract({
          address: checksummed,
          abi: erc20Abi,
          functionName: "name",
        }),
        publicClient.readContract({
          address: checksummed,
          abi: erc20Abi,
          functionName: "symbol",
        }),
        publicClient.readContract({
          address: checksummed,
          abi: erc20Abi,
          functionName: "decimals",
        }),
      ]);

      return { name, symbol, decimals, address: checksummed };
    },
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading && !!checksummed,
    isError: query.isError,
    error: query.error,
    isValidAddress: !!checksummed,
  };
}
