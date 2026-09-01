import {
  Coins,
  HandCoins,
  KeyRound,
  type LucideIcon,
  Plug,
  Users,
} from "lucide-react";

export type SectionId =
  | "recipient"
  | "currency"
  | "economics"
  | "hook"
  | "permissions";

export interface SectionMeta {
  id: SectionId;
  title: string;
  description: string;
  icon: LucideIcon;
  /** Tailwind classes for the icon tile — foreground colour plus a tint. */
  tint: string;
}

/**
 * The form's sections, in page order.
 *
 * One per field of `SlotInit`, and nothing else: the protocol takes eight
 * values at birth and the form's job is to collect exactly those. Policies,
 * modules and utility are gone with the protocol that had them.
 *
 * Single source of truth: the section headers, the summary card's jump links
 * and the validation error summary all read from here, so an id can never
 * drift between the anchor and the thing linking to it.
 */
export const SECTIONS: SectionMeta[] = [
  {
    id: "recipient",
    title: "Recipient",
    description: "Who collects the tax this slot charges its occupant.",
    icon: Users,
    tint: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  {
    id: "currency",
    title: "Currency",
    description: "What price, deposit and tax are denominated in.",
    icon: Coins,
    tint: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    id: "economics",
    title: "Tax & deposit",
    description: "What the occupant pays, and how far ahead they must fund it.",
    icon: HandCoins,
    tint: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  {
    id: "hook",
    title: "Hook",
    description:
      "The single extension point. It may refuse a buy, a sell or a reprice.",
    icon: Plug,
    tint: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  {
    id: "permissions",
    title: "Permissions",
    description: "What can change after creation, and who may change it.",
    icon: KeyRound,
    tint: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
];

export const SECTION = Object.fromEntries(
  SECTIONS.map((s) => [s.id, s]),
) as Record<SectionId, SectionMeta>;

/**
 * Every schema field, mapped to the section that renders it.
 *
 * Exhaustive over `createSlotSchema`. A field missing from here would make its
 * validation error invisible in the error summary — the one thing the removed
 * wizard used to guarantee by forcing you through every step.
 *
 * The `module*` and `occupancyPolicy*` rows are gone with the concepts: one
 * `hook` per slot is the whole extension surface now.
 */
const FIELD_SECTION: Record<string, SectionId> = {
  recipientMode: "recipient",
  recipient: "recipient",
  splitRecipients: "recipient",
  distributorFeePercent: "recipient",
  currencyMode: "currency",
  presetCurrency: "currency",
  customCurrency: "currency",
  taxPercentage: "economics",
  minDepositValue: "economics",
  minDepositUnit: "economics",
  hookMode: "hook",
  hook: "hook",
  mutableTax: "permissions",
  mutableHook: "permissions",
  manager: "permissions",
};

export function scrollToSection(id: SectionId) {
  document
    .getElementById(`section-${id}`)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** The distinct sections owning these schema field names, in page order. */
export function sectionsForFields(fields: readonly string[]): SectionMeta[] {
  const hit = new Set<SectionId>();
  for (const field of fields) {
    const id = FIELD_SECTION[field];
    if (id) hit.add(id);
  }
  return SECTIONS.filter((s) => hit.has(s.id));
}

export const timeUnits = [
  "seconds",
  "minutes",
  "hours",
  "days",
  "months",
] as const;
export type TimeUnit = (typeof timeUnits)[number];

export const TIME_MULTIPLIERS: Record<TimeUnit, number> = {
  seconds: 1,
  minutes: 60,
  hours: 3600,
  days: 86400,
  months: 2592000,
};

/** ("1", "days") → 86400n */
export function toSeconds(value: string, unit: TimeUnit): bigint {
  const n = Number(value.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return 0n;
  return BigInt(Math.round(n * TIME_MULTIPLIERS[unit]));
}

/**
 * "2.5" → 250n basis points.
 *
 * Basis points per 30 days, so 100% is 10000 and the smallest expressible rate
 * is 0.01%. Zero is not a rate the protocol accepts: a slot accruing nothing
 * could never liquidate anybody.
 */
export function percentToBps(percent: string): bigint {
  const n = Number(percent.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return 0n;
  return BigInt(Math.round(n * 100));
}
