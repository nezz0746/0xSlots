import { NATIVE_CURRENCY_ADDRESS } from "@0xslots/sdk/slots";
import { formatUnits } from "viem";

/** A price, with enough precision to be useful and not enough to be noise. */
export function amount(value: bigint, decimals = 18, symbol = ""): string {
  const n = Number(formatUnits(value, decimals));
  const text =
    n === 0
      ? "0"
      : n < 0.0001
        ? n.toExponential(2)
        : n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return symbol ? `${text} ${symbol}` : text;
}

export const isNative = (currency: string) =>
  currency.toLowerCase() === NATIVE_CURRENCY_ADDRESS.toLowerCase();

export const truncate = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/** Basis points per 30 days, said the way a person reads it. */
export const rate = (taxBps: bigint | string | null) =>
  taxBps === null ? "—" : `${Number(taxBps) / 100}% / mo`;

/** Seconds, rounded to the unit a reader can compare. */
export function duration(seconds: number): string {
  if (seconds <= 0) return "none";
  if (seconds >= 86_400 * 2) return `${Math.round(seconds / 86_400)}d`;
  if (seconds >= 3_600) return `${Math.round(seconds / 3_600)}h`;
  if (seconds >= 60) return `${Math.round(seconds / 60)}m`;
  return `${seconds}s`;
}
