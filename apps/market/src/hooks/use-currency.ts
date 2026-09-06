"use client";

import { NATIVE_CURRENCY_ADDRESS } from "@0xslots/sdk/slots";
import { type Address, erc20Abi } from "viem";
import { useAccount, useBalance, useReadContracts } from "wagmi";

import { isNative } from "@/lib/format";

/** What a collection's currency is called, and how its figures are scaled. */
export type Currency = { symbol: string; decimals: number };

const NATIVE: Currency = { symbol: "ETH", decimals: 18 };

/**
 * The currency a collection prices in.
 *
 * Every figure on a collection page — the price, the escrow, the balance —
 * is denominated in this, and the app used to assume ETH at 18 decimals for
 * all of them. An ERC-20 collection therefore rendered its prices unlabelled
 * and, for a six-decimal token like USDC, wrong by a factor of a trillion.
 */
export function useCurrency(chainId: number, currency?: Address): Currency {
  const erc20 = !!currency && !isNative(currency);
  const { data } = useReadContracts({
    query: { enabled: erc20, staleTime: Number.POSITIVE_INFINITY },
    contracts: erc20
      ? [
          { address: currency, abi: erc20Abi, functionName: "symbol", chainId },
          {
            address: currency,
            abi: erc20Abi,
            functionName: "decimals",
            chainId,
          },
        ]
      : [],
  });

  if (!erc20) return NATIVE;
  const symbol = data?.[0]?.result;
  const decimals = data?.[1]?.result;
  // Until the reads land, the figures are still rendered — unlabelled and at
  // 18 places, which is what they were before. Better than an empty page, and
  // it settles within a block.
  return {
    symbol: typeof symbol === "string" ? symbol : "",
    decimals: typeof decimals === "number" ? decimals : 18,
  };
}

/**
 * What the connected wallet holds of that currency.
 *
 * `undefined` when there is no wallet — which is a different thing from zero,
 * and the mint panel says so rather than claiming an empty balance.
 */
export function useCurrencyBalance(
  chainId: number,
  currency?: Address,
): bigint | undefined {
  const { address } = useAccount();
  const native = !currency || isNative(currency);

  const { data: nativeBalance } = useBalance({
    address,
    chainId,
    query: { enabled: !!address && native, refetchInterval: 12_000 },
  });

  const { data: tokenBalance } = useReadContracts({
    query: { enabled: !!address && !native, refetchInterval: 12_000 },
    contracts:
      address && !native
        ? [
            {
              address: currency as Address,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [address],
              chainId,
            },
          ]
        : [],
  });

  if (!address) return undefined;
  if (native) return nativeBalance?.value;
  const held = tokenBalance?.[0]?.result;
  return typeof held === "bigint" ? held : undefined;
}

export { NATIVE_CURRENCY_ADDRESS };
