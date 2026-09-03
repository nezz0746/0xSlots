"use client";

import { findKnownHook } from "@0xslots/contracts/slots";
import type { HookFlags, SlotState } from "@0xslots/sdk/slots";
import { AlertTriangle, Clock, ShieldCheck } from "lucide-react";
import { zeroAddress } from "viem";
import { MutabilityChip } from "@/components/detail-group";
import { EnsIdentity } from "@/components/ens-identity";
import { TenureMeter } from "@/components/occupancy-timeline";
import { Badge } from "@/components/ui/badge";
import { useChain } from "@/context/chain";
import type { CurrencyMeta } from "@/hooks/slots/use-slots";
import { useChainTimeSkew } from "@/hooks/slots/use-slots";
import { useNow } from "@/hooks/use-duration";
import type { LiveAccrual } from "@/hooks/use-live-accrual";
import { useTenureWindow } from "@/hooks/use-tenure-window";
import { cn } from "@/lib/utils";
import { HoldingCost } from "./holding-cost";
import { AddressText } from "./panel";

// `formatRunway` lived here, formatting the escrow's remaining seconds for the
// actions card. That card no longer shows a runway — `HoldingCost` does, in
// days, because a cell meant to be compared cannot use a mixed-unit string.

/**
 * "bought 3d ago" — one coarse unit.
 *
 * A single unit on purpose: this sits in a header row beside six figures, and
 * `formatDuration`'s "3d 4h" spends a second unit on precision nobody reads at
 * a glance. The exact instant stays available in the element's `title`.
 */
function boughtAgo(occupiedSince: bigint, chainNow: number): string {
  if (occupiedSince === 0n) return "";
  const secs = Math.max(0, chainNow - Number(occupiedSince));
  if (secs < 60) return "bought just now";
  if (secs < 3600) return `bought ${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `bought ${Math.floor(secs / 3600)}h ago`;
  return `bought ${Math.floor(secs / 86400)}d ago`;
}

/**
 * @param insolvent Overrides the snapshot's own flag with the interpolated one,
 *   so a slot that tips over while the page is open says so on the same tick
 *   the runway hits zero rather than at the next poll. Omit to trust the read.
 */
export function SlotStatus({
  state,
  insolvent,
}: {
  state: SlotState;
  insolvent?: boolean;
}) {
  if (state.isVacant)
    return (
      <Badge variant="outline" className="gap-1">
        <Clock className="size-3" /> Vacant
      </Badge>
    );
  if (insolvent ?? state.isInsolvent)
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="size-3" /> Insolvent
      </Badge>
    );
  return (
    <Badge className="gap-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
      <ShieldCheck className="size-3" /> Occupied
    </Badge>
  );
}

const _DECIDES: [keyof HookFlags, string][] = [
  ["beforeBuy", "beforeBuy"],
  ["beforeSelfAssess", "beforeSelfAssess"],
];
const _RECORDS: [keyof HookFlags, string][] = [
  ["afterBuy", "afterBuy"],
  ["afterRelease", "afterRelease"],
  ["afterLiquidate", "afterLiquidate"],
  ["afterSettle", "afterSettle"],
];

/**
 * A hook's declared subscriptions, struck through where it did not subscribe.
 *
 * Both halves are always drawn, present and absent alike. A list of only what a
 * hook DOES leaves the reader unable to tell "this hook cannot refuse a buy"
 * from "this app did not check" — and the first is a guarantee worth having.
 */
function _FlagList({
  flags,
  entries,
}: {
  flags: HookFlags;
  entries: [keyof HookFlags, string][];
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {entries.map(([key, label]) => (
        <span
          key={key}
          className={cn(
            "px-1.5 py-0.5 text-[10px]",
            flags[key]
              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
              : "bg-muted/60 text-muted-foreground/50 line-through",
          )}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

/**
 * The slot as reference, in the create form's own vocabulary.
 *
 * Same icons, same tints, same order as the sections that SET these values —
 * see `app/create/sections.ts`, which owns that vocabulary. A slot's terms
 * should look like the form that produced them, so a reader who has filled the
 * form once can find any value here without hunting.
 *
 * Hierarchy is carried by `weight` rather than by position alone. The terms
 * decide whether to buy, so they lead at body size; the hook is consequential
 * but conditional — absent from most slots and meaningless to most readers —
 * so it sits last and quiet rather than competing with the rate.
 *
 * The live figures are deliberately NOT here. Deposit, tax owed and the runway
 * belong beside the form that acts on them, in the valuation rail; repeating
 * them here would give the page two counting copies of the same number, drifting
 * a tick apart from each other.
 */
/**
 * Everything the slot IS, cut by who can change it.
 *
 * This was six sections — Terms, Currency, Recipient, Occupancy, Permissions,
 * Hook — each an icon tile over a list of rows, every one looking identical. The
 * shape of the page carried no information, and the one distinction that decides
 * whether to buy was a padlock chip on two rows.
 *
 * That distinction is the structure now. A slot's terms divide cleanly into the
 * ones frozen at creation and the ones a manager can move under a holder, and
 * which side a term falls on changes what you do about it. Grouping by authority
 * puts it in the layout instead of in a tooltip.
 *
 * The figures lead, then what is promised, then what can move, then what is true
 * right now. No prose: this is an explorer, and the grouping is the explanation.
 */
export function SlotDetails({
  state,
  currency,
  accrual,
  minDeposit,
  isManager,
  isOccupant,
  banner,
}: {
  state: SlotState;
  currency: CurrencyMeta;
  /** Interpolated between polls, so the accruing figures move. */
  accrual: LiveAccrual;
  /** The deposit `minDepositSeconds` demands at the CURRENT price. */
  minDeposit: bigint;
  isManager: boolean;
  isOccupant: boolean;
  /**
   * Rendered directly under the figures. A queued change to the terms belongs
   * against the numbers it changes, not in a panel further down — but this
   * component stays presentational, so the caller owns the wiring and this is
   * only the slot it lands in.
   */
  banner?: React.ReactNode;
}) {
  const { chainId } = useChain();
  const attached = state.hook !== zeroAddress;
  const known = findKnownHook(chainId, attached ? state.hook : undefined);
  const tenureSeconds = useTenureWindow(
    attached ? state.hook : undefined,
    attached ? state.hookData : undefined,
  );
  const now = useNow(!!tenureSeconds && !state.isVacant, 1000);
  /**
   * `occupiedSince` is a `block.timestamp`, so the elapsed time has to be
   * measured against the CHAIN's clock. On a warped local chain the browser's
   * own `Date.now()` reads days out, and "bought 8d ago" for a slot taken a
   * minute earlier is not a rounding error. See `useChainTimeSkew`.
   */
  const skew = useChainTimeSkew();
  const chainNow = Math.floor(Date.now() / 1000) + skew;

  const mutableTerms = state.mutableTax || state.mutableHook;

  return (
    /**
     * ONE block, not a block over three lists.
     *
     * Everything here used to be a summary strip followed by "Fixed forever",
     * "Can change under you" and "Right now" — three headings over rows of
     * label/value pairs. The grouping was by AUTHORITY, which is a real
     * distinction but a weak one to spend the page's whole structure on: it put
     * the recipient (who receives every payment) four rows below the fold,
     * separated the tax rate from the rent it produces, and gave the two
     * deposit minimums their own rows where they read as further figures rather
     * than as floors under the two cells they bound.
     *
     * Authority is now carried by the lock chips, which is what they are for —
     * one glance per term instead of one section per class of term.
     */
    <div className="text-sm">
      {/* The two counterparties, facing each other. A slot is a standing deal
          between whoever holds it and whoever is paid for it, and putting them
          on one line at opposite ends is the shortest way to say so. The
          recipient's avatar is mirrored to the outside edge so the pair reads
          inward. */}
      <div className="flex items-start justify-between gap-4 border-t px-3 py-2.5 sm:px-4">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Held by
          </p>
          {state.isVacant ? (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Vacant — anyone may take it
            </p>
          ) : (
            <>
              <div className="mt-1.5 flex items-center gap-1.5">
                <EnsIdentity
                  address={state.occupant}
                  size={20}
                  nameClassName="text-xs font-medium"
                />
                {isOccupant && (
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    you
                  </span>
                )}
              </div>
              {state.occupiedSince > 0n && (
                <p
                  className="mt-1 text-[10px] text-muted-foreground"
                  title={new Date(
                    Number(state.occupiedSince) * 1000,
                  ).toLocaleString()}
                >
                  {boughtAgo(state.occupiedSince, chainNow)}
                </p>
              )}
            </>
          )}
        </div>

        <div className="min-w-0 text-right">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Tax to
          </p>
          <div className="mt-1.5 flex items-center justify-end">
            <EnsIdentity
              address={state.recipient}
              size={20}
              className="flex-row-reverse"
              nameClassName="text-xs font-medium"
            />
          </div>
          {/* The one promise worth stating in words: this address is welded in
              at creation. Every other term here carries a lock chip; this one
              has no chip because it has no mutable counterpart. */}
          <p className="mt-1 text-[10px] text-muted-foreground">
            fixed at creation
          </p>
        </div>
      </div>

      <HoldingCost
        price={state.price}
        taxBps={state.taxBps}
        decimals={currency.decimals}
        symbol={currency.symbol}
        deposit={state.deposit}
        taxOwed={accrual.taxOwed}
        escrowLeft={accrual.remaining}
        secondsUntilLiquidation={accrual.secondsUntilLiquidation}
        isVacant={state.isVacant}
        isInsolvent={accrual.insolvent}
        rising={accrual.rising}
        minDepositSeconds={state.minDepositSeconds}
        minDeposit={minDeposit}
        taxLock={<MutabilityChip mutable={state.mutableTax} what="tax rate" />}
        className="border-b-0"
      />

      {banner}

      {/* What can move, and who may move it. Both locks are shown in BOTH
          states: a closed lock is a guarantee, and a reader who only ever sees
          the open one cannot tell "this is fixed" from "this app did not
          check". */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-y px-3 py-2.5 sm:px-4">
        <Term
          label="Hook"
          lock={<MutabilityChip mutable={state.mutableHook} what="hook" />}
        >
          {attached ? (
            <span className="inline-flex items-center gap-1.5">
              {known?.name ?? "unrecognised"}
              <AddressText address={state.hook} />
            </span>
          ) : (
            <span className="text-muted-foreground">none</span>
          )}
        </Term>

        <Term label="Manager">
          {mutableTerms ? (
            <span className="inline-flex items-center gap-1.5">
              <AddressText
                address={state.manager}
                className="text-foreground"
              />
              <span className="text-[10px] text-muted-foreground">
                {isManager ? "you" : "not you"}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">none</span>
          )}
        </Term>

        {/* A hook this app cannot name is the only case where what it may do to
            a buy is not already visible from its name. */}
        {attached && !known && (
          <p className="w-full text-[11px] leading-snug text-amber-600 dark:text-amber-400">
            Unrecognised hook — read its code before buying.
          </p>
        )}

        {tenureSeconds && !state.isVacant ? (
          <div className="w-full pt-0.5">
            <TenureMeter
              tenureSeconds={Number(tenureSeconds)}
              occupiedSince={Number(state.occupiedSince)}
              now={now}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * One term, its value, and how firmly it is held.
 *
 * Inline rather than a label/value row: these are two short facts, and a
 * two-column list of two entries is a table pretending to be a structure.
 */
function Term({
  label,
  lock,
  children,
}: {
  label: string;
  lock?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      {lock}
      <span className="min-w-0 truncate">{children}</span>
    </div>
  );
}
