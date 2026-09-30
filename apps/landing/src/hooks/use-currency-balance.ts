"use client";

import { isNativeCurrency } from "@0xslots/sdk";
import { type Address, erc20Abi } from "viem";
import { useAccount, useBalance, useReadContract } from "wagmi";

/**
 * Balance of `currency` for the connected account, in that currency's smallest
 * unit.
 *
 * wagmi v2's `useBalance` reads native ETH only — the `token` parameter that
 * used to cover ERC-20s was removed — so the two cases need different apps.
 * Both are called unconditionally to respect the rules of hooks, and each is
 * disabled when it does not apply so only one request is ever issued.
 */
export function useCurrencyBalance(currency: Address | undefined) {
  const { address } = useAccount();
  const native = isNativeCurrency(currency);

  const { data: nativeBalance } = useBalance({
    address,
    query: { enabled: !!address && native },
  });

  const { data: tokenBalance } = useReadContract({
    address: currency,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!currency && !native },
  });

  return (native ? nativeBalance?.value : tokenBalance) ?? 0n;
}
