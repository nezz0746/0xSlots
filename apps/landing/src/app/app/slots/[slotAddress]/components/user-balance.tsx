"use client";

import type { Address } from "viem";
import type { CurrencyMeta } from "@/hooks/slots/use-slots";
import { useCurrencyBalance } from "@/hooks/use-currency-balance";
import { formatBalance } from "@/utils";

/**
 * What the viewer holds of the slot's own currency.
 *
 * Sits directly UNDER the valuation field, not above the form. Above, it read
 * as one more statistic in a column already full of them. Under the field you
 * are typing a number into, it is the answer to the question that number
 * raises — can I afford that — at the moment it occurs to you.
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
    <p className="mt-1 flex items-baseline justify-between gap-2 text-[10px] text-muted-foreground">
      <span>Your {meta.symbol || "token"} balance</span>
      <span className="font-medium tabular-nums text-foreground">
        {formatBalance(balance, meta.decimals)}
      </span>
    </p>
  );
}
