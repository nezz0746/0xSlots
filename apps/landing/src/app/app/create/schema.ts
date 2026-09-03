import { isAddress } from "viem";
import { z } from "zod";
import { type TimeUnit, timeUnits } from "./sections";

/**
 * The create form's shape, as the form holds it — strings, modes and toggles.
 *
 * NOT the shape the protocol takes. `SlotInit` is eight resolved values, and
 * the translation happens once, at submit, in `page.tsx`. Two things follow:
 *
 *  - This schema is about *fillability*: is there enough here, and is it
 *    well-formed enough, to build an init at all. It must never contradict
 *    `assertSlotInit` in `@0xslots/sdk/slots`, which is the authority on what
 *    the chain will accept. Where they overlap — the tax bounds, the manager
 *    rule — the bounds here are copied from there rather than invented.
 *  - Fields with no counterpart in `SlotInit` still belong here. A recipient
 *    *group* becomes one split address before it ever reaches the protocol,
 *    and the split's own rules (at least two members, allocations summing to
 *    100%) are only checkable at this layer.
 */

function isValidAddressOrEns(val: string) {
  const v = val.trim();
  if (!v) return true;
  if (isAddress(v, { strict: false })) return true;
  if (/^[a-zA-Z0-9-]+\.(eth|xyz|id)$/.test(v)) return true;
  return false;
}

export const splitRecipientSchema = z.object({
  address: z.string(),
  percentAllocation: z.number(),
});

export type SplitRecipientInput = z.infer<typeof splitRecipientSchema>;

/**
 * How the hook field is being filled.
 *
 * The old form had this same trio for *modules*, and the shape survives the
 * protocol change unchanged because the question is the same one: none, one we
 * can name, or an address you brought yourself. What changed is that there is
 * now exactly one of them per slot, so "none" is a real and common answer
 * rather than a way of opting out of a list.
 *
 * `tenure` is the successor to the old occupancy-policy picker. The creator
 * names a duration, which becomes the slot's `hookData` — the hook itself is
 * one fixed address per chain serving every window. It is its own mode rather
 * than an entry in the known list because it asks a QUESTION: the known list is
 * addresses you attach as they are, and this one needs a number first.
 */
export const hookModes = ["none", "known", "tenure", "custom"] as const;
export type HookMode = (typeof hookModes)[number];

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
    // Both bounds mirror `assertSlotInit`: the rate is basis points per 30 days
    // and must land in 1..10000, so 0.01% is the floor and 100% the ceiling.
    // Without them the form happily submits a rate the contract rejects, and
    // the user meets a revert where a field error belongs.
    //
    // The FLOOR is the one worth stating out loud: a zero-tax slot accrues
    // nothing, so nobody could ever be liquidated off it — it would be a slot
    // that can be taken once and then held for free forever.
    taxPercentage: z
      .string()
      .min(1, "Required")
      .refine(
        (v) => !Number.isNaN(Number(v)) && Number(v) > 0,
        "Must be above zero — a slot taxing nothing could never liquidate anybody",
      )
      .refine((v) => Number(v) <= 100, "Must be at most 100% per 30 days")
      .refine(
        (v) => Math.round(Number(v) * 100) >= 1,
        "Smallest expressible rate is 0.01%",
      ),
    minDepositValue: z
      .string()
      .min(1, "Required")
      .refine(
        (v) => !Number.isNaN(Number(v)) && Number(v) >= 0,
        "Must be a non-negative number",
      ),
    minDepositUnit: z.enum(timeUnits),
    hookMode: z.enum(hookModes),
    /**
     * Minimum-tenure duration, when `hookMode` is "tenure". Becomes the slot's
     * `hookData`, not part of the hook's address.
     */
    tenureValue: z
      .string()
      .refine(
        (v) => !Number.isNaN(Number(v)) && Number(v) > 0,
        "Must be a positive number",
      ),
    tenureUnit: z.enum(timeUnits),
    hook: z.string().refine(isValidAddressOrEns, {
      message: "Enter a valid address (0x…) or ENS name",
    }),
    mutableTax: z.boolean(),
    mutableHook: z.boolean(),
    manager: z.string().refine(isValidAddressOrEns, {
      message: "Enter a valid address (0x…) or ENS name",
    }),
  })
  // The manager rule, in the only form a schema can express it.
  //
  // `assertSlotInit` enforces BOTH halves — a manager is required when
  // something is mutable and forbidden when nothing is. Only the first half
  // belongs here: the second is satisfied by construction, because the form
  // sends `zeroAddress` rather than whatever is sitting in a hidden field.
  .refine(
    (d) => {
      if (d.mutableTax || d.mutableHook) return d.manager.trim().length > 0;
      return true;
    },
    {
      message: "A manager is required when something is mutable",
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
  // A hook chosen by address must actually be one. The factory rejects an
  // address with no code, and a hook subscribing to no callbacks at all is
  // rejected outright — but neither is knowable from a string, so all this
  // layer can insist on is that something was entered.
  .refine(
    (d) => {
      if (d.hookMode === "none") return true;
      // In tenure mode `hook` is written by the section, not typed, so the
      // only thing this layer can insist on is the duration behind it. Zero is
      // not a short window — the hook refuses it — so the floor is real.
      if (d.hookMode === "tenure") return Number(d.tenureValue) > 0;
      return d.hook.trim().length > 0;
    },
    { message: "Choose a hook or switch to none", path: ["hook"] },
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
  recipientMode: "single",
  recipient: "",
  splitRecipients: [
    { address: "", percentAllocation: 50 },
    { address: "", percentAllocation: 50 },
  ],
  distributorFeePercent: 0,
  currencyMode: "preset",
  presetCurrency: "",
  customCurrency: "",
  // 1% per 30 days, funded a day ahead: a slot that plainly works, and every
  // number visible on first paint rather than a form of empty required fields.
  taxPercentage: "1",
  minDepositValue: "1",
  minDepositUnit: "days",
  // No hook — a plain instant-buy slot. An untouched form produces the
  // simplest thing the protocol can make, which is also the one whose rules a
  // reader can hold in their head.
  hookMode: "none",
  hook: "",
  tenureValue: "7",
  tenureUnit: "days",
  mutableTax: false,
  mutableHook: false,
  manager: "",
};

/**
 * ("1", "hours") → "1 hour". Echoes back what was typed rather than
 * normalising it, so "90 minutes" does not come back as "1h 30m" and leave the
 * reader checking whether the form understood them.
 */
export function formatValueUnit(value: string, unit: TimeUnit): string {
  const singular = Number(value) === 1 ? unit.replace(/s$/, "") : unit;
  return `${value} ${singular}`;
}
