/**
 * What a hook's declared flags MEAN, in one place.
 *
 * The create form and the slot detail were describing the same six booleans in
 * two vocabularies — one probed a pasted address, the other read a slot's
 * snapshot — so a hook could be called one thing while you were attaching it
 * and another once it was attached. The flags are the same flags; the sentence
 * about them belongs somewhere both can read.
 */

/** The declared callback set, exactly as `HookFlags` orders it. */
export interface HookFlagSet {
  beforeBuy: boolean;
  beforeSelfAssess: boolean;
  afterBuy: boolean;
  afterRelease: boolean;
  afterLiquidate: boolean;
  afterSettle: boolean;
  strict: boolean;
}

/**
 * Every flag, in the order `HookFlags` declares them, with `strict` last.
 *
 * A fixed order so the row is a shape the eye learns rather than a list that
 * reshuffles per hook.
 */
export const FLAG_ORDER = [
  "beforeBuy",
  "beforeSelfAssess",
  "afterBuy",
  "afterRelease",
  "afterLiquidate",
  "afterSettle",
  "strict",
] as const satisfies readonly (keyof HookFlagSet)[];

/** Callback name → what it is, for a list of subscriptions. */
export const FLAG_LABELS: Record<string, string> = {
  beforeBuy: "before buy",
  beforeSelfAssess: "before reprice",
  afterBuy: "after buy",
  afterRelease: "after release",
  afterLiquidate: "after liquidate",
  afterSettle: "after settle",
  strict: "strict",
};

/** Callback name → the ACTION it sees, for "may refuse" / "notified on". */
export const VERB_LABELS: Record<string, string> = {
  beforeBuy: "buy",
  beforeSelfAssess: "reprice",
  afterBuy: "buy",
  afterRelease: "release",
  afterLiquidate: "liquidate",
  afterSettle: "settle",
};

/**
 * A hook's flags, said in words.
 *
 * `mayRefuse` is the half that matters before you commit money — a `before`
 * hook can veto, an `after` hook cannot — so it is returned separately rather
 * than left for the reader to work out from the callback names.
 */
export function describeFlags(flags: Partial<HookFlagSet> | undefined | null): {
  /// The raw set, normalised — what {HookFlags} draws.
  flags: HookFlagSet;
  subscriptions: string[];
  mayRefuse: string[];
  notifiedOn: string[];
  strict: boolean;
} {
  const on = Object.keys(FLAG_LABELS).filter(
    (k) => (flags as Record<string, boolean> | undefined)?.[k],
  );
  return {
    flags: Object.fromEntries(
      FLAG_ORDER.map((k) => [k, !!flags?.[k]]),
    ) as unknown as HookFlagSet,
    subscriptions: on.map((k) => FLAG_LABELS[k] as string),
    mayRefuse: on
      .filter((k) => k.startsWith("before"))
      .map((k) => VERB_LABELS[k] as string),
    notifiedOn: on
      .filter((k) => k.startsWith("after"))
      .map((k) => VERB_LABELS[k] as string),
    strict: !!flags?.strict,
  };
}
