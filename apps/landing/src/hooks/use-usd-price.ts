"use client";

import { useQuery } from "@tanstack/react-query";

/**
 * USD spot price for a slot's currency, or `null` where there isn't one.
 *
 * Base only. Testnet and anvil tokens are worthless or invented, so a dollar
 * figure there would be misleading rather than merely absent — the route
 * returns an empty map for any other chain and every consumer renders nothing.
 *
 * Goes through `/api/price` rather than calling Alchemy directly: the key the
 * app holds is `NEXT_PUBLIC_`, and this sits beside a field people type in, so
 * a direct call would ship a billable credential to the browser and spend quota
 * per keystroke. See the route for the full reasoning.
 */
export function useUsdPrice(
  currency: string | undefined,
  chainId: number | undefined,
) {
  const address = currency?.toLowerCase();

  const { data } = useQuery({
    queryKey: ["usd-price", chainId, address],
    enabled: !!address && !!chainId,
    // The route caches for 60s; matching that here keeps a mounted form from
    // refetching more often than the answer can actually change.
    staleTime: 60_000,
    queryFn: async (): Promise<number | null> => {
      const res = await fetch(
        `/api/price?chainId=${chainId}&tokens=${address}`,
      );
      if (!res.ok) return null;
      const body = (await res.json()) as { prices?: Record<string, number> };
      return body.prices?.[address as string] ?? null;
    },
  });

  const usd = data ?? null;

  /**
   * Convert a token amount to USD, or `null` when there is no price.
   *
   * Returning `null` rather than 0 is load-bearing: every caller renders
   * nothing on `null`, and a zero would print "≈ $0.00" beside a real balance.
   */
  const toUsd = (amount: number): number | null =>
    usd === null || !Number.isFinite(amount) ? null : amount * usd;

  return { usd, toUsd };
}

/** Format a USD figure, keeping sub-cent amounts visible rather than "$0.00". */
export function formatUsd(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) return null;
  if (value === 0) return "$0.00";
  const decimals = Math.abs(value) >= 0.01 ? 2 : 4;
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: decimals,
  })}`;
}
