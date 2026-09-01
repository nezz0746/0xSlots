"use client";

import type { Address } from "viem";
import type { CurrencyMeta } from "@/hooks/slots/use-slots";
import { useCurrencyBalance } from "@/hooks/use-currency-balance";
import { formatBalance } from "@/utils";

/**
 * What the viewer holds of the slot's own currency.
 *
 * Sits between the escrow figures and the form that spends them, because that
 * is the question the form raises: the total is meaningless without knowing
 * whether you can cover it, and sending someone to their wallet to find out is
 * how a buy gets abandoned halfway.
 *
 * Takes the resolved {@link CurrencyMeta} rather than reading `symbol` and
 * `decimals` itself. It used to issue its own pair of ERC-20 reads, which meant
 * every slot page fetched the same two immutable values twice and could render
 * a balance at 18 decimals beside a price at 6 while the second pair was still
 * in flight.
 */
export function UserCurrencyBalance({
  currency,
  meta,
}: {
  currency: Address;
  meta: CurrencyMeta;
}) {
  const balance = useCurrencyBalance(currency);

  return (
    <div className="flex justify-between border-b px-4 py-2 text-sm">
      <span className="text-muted-foreground">
        Your {meta.symbol || "token"} balance
      </span>
      <span className="font-bold tabular-nums">
        {formatBalance(balance, meta.decimals)}
      </span>
    </div>
  );
}
