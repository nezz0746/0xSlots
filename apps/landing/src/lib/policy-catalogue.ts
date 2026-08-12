import {
  BadgeCheck,
  CalendarClock,
  Coins,
  Fingerprint,
  Gauge,
  HandCoins,
  Layers,
  type LucideIcon,
  ShieldCheck,
  TrendingDown,
} from "lucide-react";

/**
 * The occupancy-policy catalogue.
 *
 * `summary` is ONE sentence, deliberately. A policy is a single rule — the
 * interface only lets it refuse — so anything longer is explaining the
 * mechanism rather than naming the rule, and the mechanism belongs in the docs.
 * If a rule cannot be said in a sentence it is probably two policies.
 *
 * `status` is honest: LIVE means deployed with a factory behind it, PLANNED
 * means designed but not written, NOT-A-POLICY means the interface forbids it.
 */

export type PolicyStatus = "live" | "planned" | "not-a-policy";

/** How far a policy moves the slot from plain Harberger. */
export type PolicyImpact = "near-pure" | "soft" | "n/a";

export interface PolicyEntry {
  id: string;
  name: string;
  /** One sentence. The rule, not the reasoning. */
  summary: string;
  /** Constructor terms, or null where there is nothing to configure. */
  terms: string | null;
  status: PolicyStatus;
  impact: PolicyImpact;
  icon: LucideIcon;
  tint: string;
  /** Only for `not-a-policy`: why the interface forbids it. */
  blocker?: string;
}

const TINT = {
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  sky: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  muted: "bg-muted text-muted-foreground",
} as const;

export const POLICIES: PolicyEntry[] = [
  // ── Live ────────────────────────────────────────────────────
  {
    id: "minimum-tenure",
    name: "Minimum tenure",
    summary: "Nobody can buy you out for a set period after you take the slot.",
    terms: "tenureSeconds",
    status: "live",
    impact: "soft",
    icon: ShieldCheck,
    tint: TINT.violet,
  },
  {
    id: "minimum-price",
    name: "Minimum price",
    summary: "Nobody may declare below a fixed floor.",
    terms: "currency, minPrice",
    status: "live",
    impact: "near-pure",
    icon: Coins,
    tint: TINT.emerald,
  },

  // ── Planned ─────────────────────────────────────────────────
  {
    id: "runway-on-reprice",
    name: "Runway on reprice",
    summary:
      "Blocks a price raise that would leave you under a minimum runway.",
    terms: "runwaySeconds",
    status: "planned",
    impact: "near-pure",
    icon: Gauge,
    tint: TINT.amber,
  },
  {
    id: "price-band",
    name: "Price band",
    summary: "A floor and a ceiling on the declared price.",
    terms: "currency, floor, cap",
    status: "planned",
    impact: "near-pure",
    icon: HandCoins,
    tint: TINT.emerald,
  },
  {
    id: "token-gate",
    name: "Token gate",
    summary: "Only holders of a token, NFT or attestation may occupy.",
    terms: "token, minBalance",
    status: "planned",
    impact: "near-pure",
    icon: Fingerprint,
    tint: TINT.blue,
  },
  {
    id: "trading-window",
    name: "Trading window",
    summary: "Buys are allowed only during recurring windows.",
    terms: "period, openSeconds, offset",
    status: "planned",
    impact: "soft",
    icon: CalendarClock,
    tint: TINT.violet,
  },
  {
    id: "decaying-reserve",
    name: "Decaying reserve",
    summary:
      "While vacant, the floor decays from a start price — first taker sets it.",
    terms: "startPrice, decaySeconds",
    status: "planned",
    impact: "near-pure",
    icon: TrendingDown,
    tint: TINT.emerald,
  },
  {
    id: "all-of",
    name: "All of",
    summary: "Combines several policies into one; every child must agree.",
    terms: "children[]",
    status: "planned",
    impact: "n/a",
    icon: Layers,
    tint: TINT.sky,
  },
];

/** Asked for often, and impossible here — each needs custody or memory. */
export const NOT_POLICIES: PolicyEntry[] = [
  {
    id: "queue-payout",
    name: "Paid exit",
    summary:
      "The leaver is paid by the next in line instead of getting nothing.",
    terms: null,
    status: "not-a-policy",
    impact: "n/a",
    icon: BadgeCheck,
    tint: TINT.muted,
    blocker:
      "Needs custody, and policies are never called on release. Lowering your price already does most of it.",
  },
  {
    id: "term-limit",
    name: "Term limits",
    summary: "Force an occupant out after a maximum period.",
    terms: null,
    status: "not-a-policy",
    impact: "n/a",
    icon: CalendarClock,
    tint: TINT.muted,
    blocker:
      "A policy can only refuse an incoming action, never end one already running.",
  },
  {
    id: "cooldown",
    name: "Cooldown",
    summary: "Stop an account retaking a slot right after being bought out.",
    terms: null,
    status: "not-a-policy",
    impact: "n/a",
    icon: ShieldCheck,
    tint: TINT.muted,
    blocker:
      "Needs occupancy history. Hooks are view-only and cannot record it.",
  },
];

export const STATUS_LABEL: Record<PolicyStatus, string> = {
  live: "Live",
  planned: "Planned",
  "not-a-policy": "Not possible",
};
