"use client";

import { isNativeCurrency, NATIVE_CURRENCY } from "@0xslots/sdk";
import { type Address, erc20Abi } from "viem";
import { useReadContract } from "wagmi";
import { useCurrencyBalance } from "@/hooks/use-currency-balance";
import { formatBalance } from "@/utils";

export function UserCurrencyBalance({ currency }: { currency: Address }) {
  const balance = useCurrencyBalance(currency);
  const native = isNativeCurrency(currency);

  // Both reads revert against address(0), so they are disabled rather than
  // merely ignored — otherwise wagmi issues them on every render.
  const { data: erc20Symbol } = useReadContract({
    address: currency,
    abi: erc20Abi,
    functionName: "symbol",
    query: { enabled: !native },
  });
  const { data: erc20Decimals } = useReadContract({
    address: currency,
    abi: erc20Abi,
    functionName: "decimals",
    query: { enabled: !native },
  });

  const symbol = native ? NATIVE_CURRENCY.symbol : erc20Symbol;
  const decimals = native ? NATIVE_CURRENCY.decimals : erc20Decimals;

  return (
    <div className="px-4 py-2 border-b flex justify-between text-sm">
      <span className="text-muted-foreground">
        Your {symbol ?? "Token"} Balance
      </span>
      <span className="font-bold">
        {decimals !== undefined ? formatBalance(balance, decimals) : "—"}
      </span>
    </div>
  );
}
