/**
 * What a module's declared scopes MEAN, in one place.
 *
 * The create form and the slot detail were describing the same six booleans in
 * two vocabularies — one probed a pasted address, the other read a slot's
 * snapshot — so a module could be called one thing while you were attaching it
 * and another once it was attached. The scopes are the same scopes; the sentence
 * about them belongs somewhere both can read.
 */

/** The declared callback set, exactly as `Scopes` orders it. */
export interface ScopeSet {
  beforeBuy: boolean;
  beforeSelfAssess: boolean;
  afterBuy: boolean;
  afterRelease: boolean;
  afterLiquidate: boolean;
  afterSettle: boolean;
  strict: boolean;
}

/**
 * Every scope, in the order `Scopes` declares them, with `strict` last.
 *
 * A fixed order so the row is a shape the eye learns rather than a list that
 * reshuffles per app.
 */
export const SCOPE_ORDER = [
  "beforeBuy",
  "beforeSelfAssess",
  "afterBuy",
  "afterRelease",
  "afterLiquidate",
  "afterSettle",
  "strict",
] as const satisfies readonly (keyof ScopeSet)[];

/** Scope name → what it is, for a list of those granted. */
export const SCOPE_LABELS: Record<string, string> = {
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
 * A module's scopes, said in words.
 *
 * `mayRefuse` is the half that matters before you commit money — a `before`
 * module can veto, an `after` module cannot — so it is returned separately rather
 * than left for the reader to work out from the callback names.
 */
export function describeScopes(scopes: Partial<ScopeSet> | undefined | null): {
  /// The raw set, normalised — what {Scopes} draws.
  scopes: ScopeSet;
  granted: string[];
  mayRefuse: string[];
  notifiedOn: string[];
  strict: boolean;
} {
  const on = Object.keys(SCOPE_LABELS).filter(
    (k) => (scopes as Record<string, boolean> | undefined)?.[k],
  );
  return {
    scopes: Object.fromEntries(
      SCOPE_ORDER.map((k) => [k, !!scopes?.[k]]),
    ) as unknown as ScopeSet,
    granted: on.map((k) => SCOPE_LABELS[k] as string),
    mayRefuse: on
      .filter((k) => k.startsWith("before"))
      .map((k) => VERB_LABELS[k] as string),
    notifiedOn: on
      .filter((k) => k.startsWith("after"))
      .map((k) => VERB_LABELS[k] as string),
    strict: !!scopes?.strict,
  };
}
