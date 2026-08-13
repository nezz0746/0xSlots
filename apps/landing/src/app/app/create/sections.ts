import {
  Coins,
  HandCoins,
  KeyRound,
  type LucideIcon,
  Puzzle,
  ShieldCheck,
  Users,
} from "lucide-react";

export type SectionId =
  | "recipient"
  | "currency"
  | "economics"
  | "module"
  | "occupancy"
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
    description: "The ERC-20 this slot is priced and taxed in.",
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
    id: "module",
    title: "Module",
    description: "Optional contract giving the slot its behaviour.",
    icon: Puzzle,
    tint: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  {
    id: "occupancy",
    title: "Occupancy",
    description: "When the slot can be taken from whoever holds it.",
    icon: ShieldCheck,
    tint: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  {
    id: "permissions",
    title: "Permissions & bounty",
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
  moduleMode: "module",
  module: "module",
  occupancyPolicyMode: "occupancy",
  occupancyPolicy: "occupancy",
  tenureValue: "occupancy",
  tenureUnit: "occupancy",
  minPriceValue: "occupancy",
  mutableTax: "permissions",
  mutableModule: "permissions",
  mutablePolicy: "permissions",
  manager: "permissions",
  liquidationBountyPercent: "permissions",
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
