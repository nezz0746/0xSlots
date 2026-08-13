import { isAddress } from "viem";
import { z } from "zod";

function isValidAddressOrEns(val: string) {
  const v = val.trim();
  if (!v) return true;
  if (isAddress(v, { strict: false })) return true;
  if (/^[a-zA-Z0-9-]+\.(eth|xyz|id)$/.test(v)) return true;
  return false;
}

export const timeDenominations = [
  "seconds",
  "minutes",
  "hours",
  "days",
  "months",
] as const;
export type TimeDenomination = (typeof timeDenominations)[number];

export const TIME_MULTIPLIERS: Record<TimeDenomination, number> = {
  seconds: 1,
  minutes: 60,
  hours: 3600,
  days: 86400,
  months: 2592000, // 30 days
};

export const splitRecipientSchema = z.object({
  address: z.string(),
  percentAllocation: z.number(),
});

export type SplitRecipientInput = z.infer<typeof splitRecipientSchema>;

export const moduleModes = ["none", "verified", "custom"] as const;
export type ModuleMode = (typeof moduleModes)[number];

export const occupancyPolicyModes = [
  "none",
  "tenure",
  "price",
  "known",
  "custom",
] as const;
export type OccupancyPolicyMode = (typeof occupancyPolicyModes)[number];

export const createSlotSchema = z
  .object({
    recipientMode: z.enum(["single", "group"]),
    recipient: z.string().refine(isValidAddressOrEns, {
      message: "Enter a valid address (0x…) or ENS name",
    }),
    splitRecipients: z.array(splitRecipientSchema),
    distributorFeePercent: z.number().min(0).max(10),
    currencyMode: z.enum(["preset", "custom"]),
    presetCurrency: z.string(),
    customCurrency: z.string().refine(isValidAddressOrEns, {
      message: "Enter a valid address (0x…) or ENS name",
    }),
    moduleMode: z.enum(moduleModes),
    taxPercentage: z
      .string()
      .min(1, "Required")
      .refine(
        (v) => !isNaN(Number(v)) && Number(v) >= 0,
        "Must be a non-negative number",
      ),
    liquidationBountyPercent: z
      .string()
      .min(1, "Required")
      .refine(
        (v) => !isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= 100,
        "Must be 0–100",
      ),
    minDepositValue: z
      .string()
      .min(1, "Required")
      .refine(
        (v) => !isNaN(Number(v)) && Number(v) >= 0,
        "Must be a non-negative number",
      ),
    minDepositUnit: z.enum(timeDenominations),
    module: z.string().refine(isValidAddressOrEns, {
      message: "Enter a valid address (0x…) or ENS name",
    }),
    // ── Occupancy layer ──
    // Timing is expressed entirely by policy vetoes; there is no scheduling
    // dial. "none" means instant buy, which is what every pre-v3 slot does.
    occupancyPolicyMode: z.enum(occupancyPolicyModes),
    // Only read when occupancyPolicyMode === "tenure". The policy contract for
    // this duration is deployed on demand at a CREATE2 address derived from it.
    tenureValue: z
      .string()
      .refine(
        (v) => !isNaN(Number(v)) && Number(v) > 0,
        "Must be greater than zero",
      ),
    tenureUnit: z.enum(timeDenominations),
    // Only read when occupancyPolicyMode === "price". Denominated in the slot's
    // own currency; the policy contract is deployed on demand at a CREATE2
    // address derived from (currency, minPrice).
    minPriceValue: z
      .string()
      .refine(
        (v) => !Number.isNaN(Number(v)) && Number(v) > 0,
        "Must be greater than zero",
      ),
    occupancyPolicy: z.string().refine(isValidAddressOrEns, {
      message: "Enter a valid address (0x…) or ENS name",
    }),
    mutableTax: z.boolean(),
    mutableModule: z.boolean(),
    mutablePolicy: z.boolean(),
    manager: z.string().refine(isValidAddressOrEns, {
      message: "Enter a valid address (0x…) or ENS name",
    }),
  })
  .refine(
    (d) => {
      if (d.mutableTax || d.mutableModule || d.mutablePolicy)
        return d.manager.length > 0;
      return true;
    },
    {
      message: "Manager is required when mutability is enabled",
      path: ["manager"],
    },
  )
  .refine(
    (d) => {
      if (d.currencyMode === "preset") return d.presetCurrency.length > 0;
      if (d.currencyMode === "custom") return d.customCurrency.length > 0;
      return true;
    },
    { message: "Currency is required", path: ["presetCurrency"] },
  )
  .refine(
    (d) => {
      if (d.recipientMode === "group") return d.splitRecipients.length >= 2;
      return true;
    },
    {
      message: "A split requires at least 2 recipients",
      path: ["splitRecipients"],
    },
  )
  .refine(
    (d) => {
      if (d.recipientMode === "group") {
        return d.splitRecipients.every(
          (r) => r.address.trim().length > 0 && isValidAddressOrEns(r.address),
        );
      }
      return true;
    },
    {
      message: "All recipients must have a valid address",
      path: ["splitRecipients"],
    },
  )
  .refine(
    (d) => {
      if (d.recipientMode === "group") {
        return d.splitRecipients.every(
          (r) => r.percentAllocation > 0 && r.percentAllocation <= 100,
        );
      }
      return true;
    },
    {
      message: "All allocations must be between 0 and 100",
      path: ["splitRecipients"],
    },
  )
  .refine(
    (d) => {
      if (d.recipientMode === "group") {
        const total = d.splitRecipients.reduce(
          (sum, r) => sum + r.percentAllocation,
          0,
        );
        return Math.abs(total - 100) < 0.01;
      }
      return true;
    },
    {
      message: "Allocations must sum to 100%",
      path: ["splitRecipients"],
    },
  );

export type CreateSlotFormValues = z.input<typeof createSlotSchema>;

export const defaultValues: CreateSlotFormValues = {
  recipientMode: "single" as const,
  recipient: "",
  splitRecipients: [
    { address: "", percentAllocation: 50 },
    { address: "", percentAllocation: 50 },
  ],
  distributorFeePercent: 0,
  currencyMode: "preset",
  presetCurrency: "",
  customCurrency: "",
  moduleMode: "none",
  taxPercentage: "1",
  liquidationBountyPercent: "5",
  minDepositValue: "1",
  minDepositUnit: "days",
  module: "",
  // Default to instant buy — the pre-v3 behaviour. A policy is opt-in, so an
  // unchanged form produces exactly the slot it always did.
  occupancyPolicyMode: "none",
  tenureValue: "7",
  tenureUnit: "days",
  minPriceValue: "1",
  occupancyPolicy: "",
  mutableTax: false,
  mutableModule: false,
  mutablePolicy: false,
  manager: "",
};

/** "5" → 500n */
export function percentToBps(percent: string): bigint {
  return BigInt(Math.round(Number(percent) * 100));
}

/** ("1", "days") → 86400n */
export function toSeconds(value: string, unit: TimeDenomination): bigint {
  return BigInt(Math.round(Number(value) * TIME_MULTIPLIERS[unit]));
}

/**
 * ("1", "hours") → "1 hour". Echoes back what was typed rather than
 * normalising it, so "90 minutes" does not come back as "1h 30m" and leave the
 * reader checking whether the form understood them.
 */
export function formatValueUnit(value: string, unit: TimeDenomination): string {
  const singular = Number(value) === 1 ? unit.replace(/s$/, "") : unit;
  return `${value} ${singular}`;
}
