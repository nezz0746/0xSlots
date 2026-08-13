import { formatUnits, parseUnits } from "viem";

export const truncateAddress = (address: string) => {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

/**
 * Format a raw token amount (string or bigint) for display.
 *
 * - >= 1B       → "1.23B"
 * - >= 1M       → "4.56M"
 * - >= 1K       → "12.3K"
 * - >= 1        → "123.45"
 * - < 1 & > 0   → show enough decimals to see the first significant digits
 *                  (e.g. 0.00042 → "0.00042"), but if more than 5 leading zeros
 *                  use scientific notation (e.g. 1.2e-7)
 * - 0           → "0"
 */
export function formatAmount(
  raw: string | bigint,
  decimals: number = 18,
): string {
  const val = typeof raw === "bigint" ? raw : BigInt(raw || "0");
  if (val === 0n) return "0";
  const formatted = formatUnits(val, decimals);
  const num = parseFloat(formatted);
  if (num === 0) return "0";

  const abs = Math.abs(num);

  // Billions
  if (abs >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(2)}B`;
  }
  // Millions
  if (abs >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(2)}M`;
  }
  // Thousands
  if (abs >= 1_000) {
    return `${(num / 1_000).toFixed(2)}K`;
  }
  // >= 1
  if (abs >= 1) {
    return parseFloat(num.toFixed(2)).toString();
  }
  // < 1: count leading zeros after "0."
  const leadingZeros = -Math.floor(Math.log10(abs)) - 1;
  if (leadingZeros >= 5) {
    return num.toExponential(1);
  }
  // Show enough decimals: leading zeros + 2 significant digits
  const precision = leadingZeros + 2;
  return parseFloat(num.toFixed(precision)).toString();
}

export const formatPrice = formatAmount;
export const formatBalance = formatAmount;

/**
 * How many decimal places a plain number needs to stay legible.
 *
 * Two fixed places suit a stablecoin and erase anything smaller than a cent:
 * 0.001 ETH renders as "0.00", which reads as a broken field rather than a
 * small number. Below 1, count the leading zeros and keep two significant
 * digits past them — the same rule {@link formatAmount} applies to raw units.
 *
 * Capped at 18, the most decimals any supported currency has.
 */
export function decimalPlacesFor(n: number): number {
  const abs = Math.abs(n);
  if (!Number.isFinite(abs) || abs === 0 || abs >= 1) return 2;
  const leadingZeros = -Math.floor(Math.log10(abs)) - 1;
  return Math.min(leadingZeros + 2, 18);
}

/**
 * Format a plain number for display, adapting precision to its magnitude.
 *
 * Deliberately never switches to exponential notation, unlike
 * {@link formatAmount}. This backs an editable field, and "1.2e-7" is not
 * something a user can sensibly type back in.
 */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: decimalPlacesFor(n),
  });
}

/** Normalize decimal separators (comma → dot) for locales like French. */
export function normalizeDecimal(value: string): string {
  return value.replace(",", ".");
}

/**
 * Parse a human-readable amount to raw units using viem's parseUnits.
 * Handles comma as decimal separator (e.g. French locale).
 */
export function toRawUnits(value: string, decimals: number): bigint {
  try {
    return parseUnits(normalizeDecimal(value) || "0", decimals);
  } catch {
    return 0n;
  }
}

export function formatDuration(totalSeconds: number): string {
  if (totalSeconds >= 2 ** 128) return "∞";
  const years = Math.floor(totalSeconds / 31_536_000);
  const months = Math.floor((totalSeconds % 31_536_000) / 2_592_000);
  const days = Math.floor((totalSeconds % 2_592_000) / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  if (years > 0) return `${years}y ${months}mo`;
  if (months > 0) return `${months}mo ${days}d`;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0) return `${mins}m`;
  return `${totalSeconds}s`;
}

export function formatBps(bps: string | number): string {
  return `${Number(bps) / 100}%`;
}
