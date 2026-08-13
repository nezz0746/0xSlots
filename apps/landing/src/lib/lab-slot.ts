/**
 * The lab's slot model — mock data, real arithmetic.
 *
 * Every formula here mirrors `Slot.sol` exactly, because the point of the page
 * is to teach the mechanism and a demo that lies about the numbers teaches the
 * wrong thing. What is fake is the SLOT: no chain, no wallet, no transaction.
 *
 * Amounts are plain numbers in display units rather than bigint raw units. The
 * contract cannot do that — rounding a fraction of a cent in the protocol's
 * favour is load-bearing on-chain — but here it costs nothing and keeps the
 * arithmetic legible.
 */

export const MONTH_SECONDS = 30 * 24 * 60 * 60;
export const DAY = 24 * 60 * 60;
export const BASIS_POINTS = 10_000;

/** What the occupant burns per second at this price. Mirrors `_accrue`. */
export function burnPerSecond(price: number, taxBps: number): number {
  return (price * taxBps) / (BASIS_POINTS * MONTH_SECONDS);
}

/** Monthly cost of holding at `price`. The number people actually feel. */
export function burnPerMonth(price: number, taxBps: number): number {
  return (price * taxBps) / BASIS_POINTS;
}

/**
 * Seconds of funding left. Mirrors `secondsUntilLiquidation`.
 *
 * A price of zero burns nothing, so runway is unbounded — the contract returns
 * `type(uint256).max` for the same case.
 */
export function runwaySeconds(
  deposit: number,
  price: number,
  taxBps: number,
): number {
  const burn = burnPerSecond(price, taxBps);
  if (burn <= 0) return Number.POSITIVE_INFINITY;
  return Math.max(0, deposit) / burn;
}

/** The floor the slot refuses to drop below. Mirrors `_minDepositFor`. */
export function minDepositFor(
  price: number,
  taxBps: number,
  minDepositSeconds: number,
): number {
  if (minDepositSeconds === 0) return 0;
  return (price * taxBps * minDepositSeconds) / (BASIS_POINTS * MONTH_SECONDS);
}

/**
 * What a buyer hands over.
 *
 * A vacant slot costs only the deposit; taking one from someone costs their
 * declared price on top, and that price goes to them. Mirrors the `owedByBuyer`
 * branch in `buy`.
 */
export function costToTake(
  currentPrice: number,
  deposit: number,
  occupied: boolean,
): number {
  return occupied ? currentPrice + deposit : deposit;
}

// ── Situations ───────────────────────────────────────────────

/**
 * The five states worth seeing, in narrative order.
 *
 * Not a settings matrix. Someone arriving here is one of three people — never
 * held a slot, holds one, or is passing by — and the two urgency states are the
 * ones the interface exists to make visible. A cross-product of toggles would
 * cover the same ground and teach none of it.
 */
export type SituationId =
  | "vacant"
  | "held-other"
  | "held-you-healthy"
  | "held-you-low"
  | "held-you-insolvent";

export interface Situation {
  id: SituationId;
  /** Who you are in this scene, in the second person. */
  label: string;
  /** One line of scene-setting, shown under the switcher. */
  scene: string;
  occupied: boolean;
  /** Whether the connected wallet is the occupant. */
  youHold: boolean;
  /** Occupant's declared price. 0 when vacant. */
  price: number;
  /** Occupant's remaining deposit. 0 when vacant. */
  deposit: number;
  /** Who holds it, for display. */
  occupantName: string | null;
  /** Seconds since they took it. Drives the tenure policy. */
  heldForSeconds: number;
}

export const SITUATIONS: Situation[] = [
  {
    id: "vacant",
    label: "Nobody holds it",
    scene:
      "The slot is empty. Name a price and it is yours — you only pay the funding.",
    occupied: false,
    youHold: false,
    price: 0,
    deposit: 0,
    occupantName: null,
    heldForSeconds: 0,
  },
  {
    id: "held-other",
    label: "Someone else holds it",
    scene:
      "Ana holds it at 40 USDC. You can take it right now by paying her that — she does not get to refuse.",
    occupied: true,
    youHold: false,
    price: 40,
    // Every deposit below is derived from the intended RUNWAY, not picked to
    // look plausible. At 5%/month on a 40 USDC price the burn is 2 USDC/month,
    // so a number chosen by eye lands in the wrong health band and the scene
    // text ends up contradicting the widget. 60 days.
    deposit: 4,
    occupantName: "ana.eth",
    heldForSeconds: 12 * DAY,
  },
  {
    id: "held-you-healthy",
    label: "You hold it, funded",
    scene: "You hold it and you are paid up. Nothing needs doing.",
    occupied: true,
    youHold: true,
    price: 40,
    deposit: 3, // 45 days
    occupantName: "you",
    heldForSeconds: 9 * DAY,
  },
  {
    id: "held-you-low",
    label: "You hold it, running out",
    scene:
      "Your funding is nearly gone. When it hits zero anyone can remove you and you keep nothing.",
    occupied: true,
    youHold: true,
    price: 40,
    deposit: 0.133, // 2 days — inside the "critical" band
    occupantName: "you",
    heldForSeconds: 26 * DAY,
  },
  {
    id: "held-you-insolvent",
    label: "You hold it, out of funds",
    scene:
      "You have run out. Anyone can remove you from the slot right now, and they earn a fee for doing it.",
    occupied: true,
    youHold: true,
    price: 40,
    deposit: 0,
    occupantName: "you",
    heldForSeconds: 31 * DAY,
  },
];

/** The slot's own terms — fixed at creation, identical in every situation. */
export const SLOT_TERMS = {
  name: "Homepage banner",
  description: "Top of the explorer, above the table. Seen by every visitor.",
  currency: "USDC",
  /** Basis points per 30 days. 5% — a deliberately gentle rate. */
  taxBps: 500,
  /** The slot refuses to let funding drop below 7 days' worth. */
  minDepositSeconds: 7 * DAY,
  /** Nobody can take it from you for the first 3 days. */
  tenureSeconds: 3 * DAY,
  liquidationBountyBps: 500,
} as const;

/** Your pretend wallet, so the widget can run out of money realistically. */
export const WALLET_BALANCE = 250;

// ── Formatting ───────────────────────────────────────────────

export function money(
  n: number,
  currency: string = SLOT_TERMS.currency,
): string {
  if (!Number.isFinite(n)) return "∞";
  const v = n >= 100 ? n.toFixed(0) : n >= 1 ? n.toFixed(2) : n.toFixed(3);
  return `${v} ${currency}`;
}

/** Duration in the largest unit that still reads honestly. */
export function duration(seconds: number): string {
  if (!Number.isFinite(seconds)) return "forever";
  if (seconds <= 0) return "none";
  const d = seconds / DAY;
  if (d < 1) {
    const h = Math.max(1, Math.round(seconds / 3600));
    return `${h} hour${h === 1 ? "" : "s"}`;
  }
  if (d < 45) {
    const days = Math.round(d);
    return `${days} day${days === 1 ? "" : "s"}`;
  }
  if (d < 365) return `${Math.round(d / 30)} months`;
  const y = d / 365;
  return `${y.toFixed(1)} years`;
}

/** A date, for the marker on the axis. */
export function dateAfter(nowMs: number, seconds: number): string {
  if (!Number.isFinite(seconds)) return "—";
  return new Date(nowMs + seconds * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// ── Health ───────────────────────────────────────────────────

export type Health = "safe" | "warning" | "critical" | "gone";

/**
 * How close the occupant is to losing the slot for free.
 *
 * Thresholds are the interface's judgement, not the contract's — on-chain there
 * is exactly one threshold, zero, and it arrives without warning. Naming a
 * warning band days ahead is the entire point of the page.
 */
export function healthOf(runway: number): Health {
  if (runway <= 0) return "gone";
  if (runway < 3 * DAY) return "critical";
  if (runway < 10 * DAY) return "warning";
  return "safe";
}

export const HEALTH_TONE: Record<
  Health,
  { bar: string; text: string; dot: string; label: string }
> = {
  safe: {
    bar: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-400",
    dot: "bg-emerald-500",
    label: "Funded",
  },
  warning: {
    bar: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-500",
    dot: "bg-amber-500",
    label: "Running low",
  },
  critical: {
    bar: "bg-red-500",
    text: "text-red-700 dark:text-red-500",
    dot: "bg-red-500",
    label: "Almost out",
  },
  gone: {
    bar: "bg-red-600",
    text: "text-red-700 dark:text-red-500",
    dot: "bg-red-600",
    label: "Out of funds",
  },
};
