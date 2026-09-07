"use client";

import { describeRunway, Figures } from "@/components/figures";
import { amount, duration } from "@/lib/format";

/**
 * What a work is worth, what it costs, and how long it survives.
 *
 * The reader's question is "what would holding this cost me", and these three
 * answer it in order. Everything behind them — the deposit posted, the tax
 * accrued against it, what is left — is arithmetic this strip already implies,
 * and the buy panel reads better without it.
 */
export function HoldingCost({
  price,
  taxBps,
  symbol,
  decimals = 18,
  secondsUntilLiquidation,
  isVacant,
  isInsolvent,
  minDepositSeconds,
}: {
  price: bigint;
  /** The monthly rate in basis points. */
  taxBps: bigint;
  symbol: string;
  /** The currency's own scale. Not every collection prices in 18 places. */
  decimals?: number;
  /** `2^256 - 1` when the escrow can outlive the arithmetic. */
  secondsUntilLiquidation: bigint;
  isVacant: boolean;
  isInsolvent: boolean;
  /** The runway a buy must fund. Zero means no minimum. */
  minDepositSeconds?: bigint;
}) {
  // The contract's own formula: basis points of the declared price per 30 days.
  // Integer arithmetic, so this cannot drift from `SlotMath.taxFor`.
  const rentPerMonth = (price * taxBps) / 10_000n;
  const runway = describeRunway(secondsUntilLiquidation, isVacant, isInsolvent);
  const at = (v: bigint) => amount(v, decimals, symbol);
  const dash = "—";

  return (
    <Figures
      items={[
        { label: "Valuation", value: isVacant ? dash : at(price) },
        {
          label: "Rent / mo",
          qualifier: `${Number(taxBps) / 100}%`,
          value: isVacant ? dash : at(rentPerMonth),
        },
        {
          label: "Runway",
          value: runway.value,
          tone: runway.tone,
          foot:
            minDepositSeconds && minDepositSeconds > 0n
              ? `min ${duration(Number(minDepositSeconds))}`
              : undefined,
        },
      ]}
    />
  );
}
