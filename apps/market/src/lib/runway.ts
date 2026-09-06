import { BASIS_POINTS, MONTH_SECONDS } from "@0xslots/sdk/slots";

/**
 * How long an escrow keeps a work solvent, and how alarming that is.
 *
 * Shared, because three places answer the same question and must not answer it
 * differently: the figures strip, the holder's form as it edits, and the
 * caption under a work. Two copies of this arithmetic would eventually
 * disagree about whether a position was safe, on the one figure where
 * disagreeing is the whole problem.
 */

const DAY = 24n * 60n * 60n;

/** How long `escrow` funds a work held at `price`, in seconds. */
export function runwaySeconds(
  escrow: bigint,
  price: bigint,
  taxBps: bigint,
): bigint {
  const perMonth = price * taxBps;
  if (perMonth === 0n) return 0n;
  return (escrow * MONTH_SECONDS * BASIS_POINTS) / perMonth;
}

/** Rent for `seconds` at this price and rate, by the contract's own formula. */
export function rentFor(
  seconds: bigint,
  price: bigint,
  taxBps: bigint,
): bigint {
  return (price * taxBps * seconds) / (BASIS_POINTS * MONTH_SECONDS);
}

/** Whole units, largest one. "6d", "3h", "40m". */
export function describeRunway(seconds: bigint, zeroLabel = "none"): string {
  if (seconds <= 0n) return zeroLabel;
  // Past a year, days stop being a unit anyone reads — and an escrow that
  // outlives the arithmetic reports 2^256-1, which in days is absurd.
  if (seconds > 365n * DAY) return "∞";
  const days = seconds / DAY;
  if (days >= 1n) return `${days}d`;
  const hours = seconds / 3600n;
  if (hours >= 1n) return `${hours}h`;
  return `${seconds / 60n}m`;
}

export type Tone = "safe" | "short" | "gone";

/**
 * Red, amber, green — and a word, because colour alone is not a signal.
 *
 * Roughly eight percent of men cannot separate this red from this green, and
 * this figure is the difference between a work that is fine and one about to
 * be taken. Every caller pairs the tone with the label below it, so the
 * meaning survives without the hue.
 *
 * The amber threshold is the work's OWN minimum window rather than a round
 * number of days: a runway shorter than one funded window means it can be
 * taken before the window being paid for has even elapsed, which is where
 * "funded for 5d" stops being a fact and starts being a warning.
 */
export function runwayTone(seconds: bigint, window: bigint): Tone {
  if (seconds <= 0n) return "gone";
  return seconds < window ? "short" : "safe";
}

export const TONE_TEXT: Record<Tone, string> = {
  safe: "text-live",
  short: "text-waning",
  gone: "text-ebbing",
};

export const TONE_LABEL: Record<Tone, string> = {
  safe: "funded",
  short: "running low",
  gone: "unfunded",
};
