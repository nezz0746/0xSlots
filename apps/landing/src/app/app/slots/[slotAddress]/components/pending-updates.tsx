"use client";

import { findKnownHook } from "@0xslots/contracts/slots";
import type { SlotState } from "@0xslots/sdk/slots";
import { Info, Loader2 } from "lucide-react";
import { type Address, zeroAddress } from "viem";
import { Button } from "@/components/ui/button";
import { useChain } from "@/context/chain";
import { useChainTimeSkew } from "@/hooks/slots/use-slots";
import type { useSlotsAction } from "@/hooks/slots/use-slots-action";
import { cn } from "@/lib/utils";
import { formatBps, truncateAddress } from "@/utils";

type Actions = ReturnType<typeof useSlotsAction>;

/**
 * Which of the two dimensions a queued change touches. `proposeTerms` takes a
 * flag per dimension and `cancelTerms` takes one per dimension, so a retraction
 * has to name which — the two may belong to different roles in a collective.
 */
export type PendingDimension = "tax" | "hook";

/**
 * This file owns one subject — terms queued but not yet in force — in the two
 * places it appears, and deliberately in two different registers:
 *
 * - {@link PendingTermsBanner} states the fact, in the info tab, read-only.
 * - {@link QueuedTermsControls} retracts it, in the manage tab, manager only.
 *
 * They share the row data, the direction colouring and the countdown, so the
 * two cannot drift into describing the same proposal differently. What they do
 * not share is the ability to act: an informational strip that also fires
 * transactions is how the retraction ended up behind a `×` — an icon that
 * everywhere else on the web means "dismiss this notice", offered for an
 * irreversible on-chain write.
 */

/** "7h" — how long until a queued change becomes eligible. */
export function eligibleIn(appliesAt: bigint, nowSeconds: number): string {
  const left = Math.max(0, Number(appliesAt) - nowSeconds);
  if (left < 60) return `${left}s`;
  if (left < 3600) return `${Math.floor(left / 60)}m`;
  if (left < 86400) return `${Math.ceil(left / 3600)}h`;
  return `${Math.ceil(left / 86400)}d`;
}

function hookLabel(chainId: number, hook: Address): string {
  if (hook === zeroAddress) return "none";
  return findKnownHook(chainId, hook)?.name ?? truncateAddress(hook);
}

export type PendingRow = {
  dimension: PendingDimension;
  label: string;
  current: string;
  next: string;
  /**
   * Only the tax rate has a direction a reader can price. Cheaper is better for
   * whoever holds the slot next, so down is the good one — the opposite of the
   * usual green-is-up reflex, which is why it is computed here rather than left
   * to a caller to get backwards.
   */
  direction?: "up" | "down";
};

/**
 * The queued changes, resolved into before/after strings.
 *
 * Reads the `has*` flags rather than testing values for emptiness: the zero
 * address is a REAL proposed value for the hook dimension — "detach the hook"
 * is something someone deliberately queued, and treating it as "nothing
 * pending" would hide the more consequential of the two.
 */
export function pendingChanges(
  state: SlotState,
  chainId: number,
): PendingRow[] {
  const rows: PendingRow[] = [];
  const { pending } = state;

  if (pending.hasTax) {
    rows.push({
      dimension: "tax",
      label: "Tax rate",
      current: `${formatBps(Number(state.taxBps))}`,
      next: `${formatBps(Number(pending.taxBps))} / mo`,
      direction: pending.taxBps > state.taxBps ? "up" : "down",
    });
  }
  if (pending.hasHook) {
    rows.push({
      dimension: "hook",
      label: "Hook",
      current: hookLabel(chainId, state.hook),
      next: hookLabel(chainId, pending.hook),
    });
  }

  return rows;
}

/** Must match the labels `useSlotAction` reports through `activeAction`, so a
 *  per-row spinner lands on the retraction actually in flight rather than on
 *  both at once. See `cancelTerms` in the SDK's react bindings. */
const CANCEL_LABEL: Record<PendingDimension, string> = {
  tax: "Cancel tax update",
  hook: "Cancel hook update",
};

const CANCEL_TEXT: Record<PendingDimension, string> = {
  tax: "Cancel tax change",
  hook: "Cancel hook change",
};

/** The changed value, tinted by direction. Shared so the two views cannot
 *  disagree about which way is the good way. */
function NextValue({ row }: { row: PendingRow }) {
  return (
    <span
      className={cn(
        "font-semibold tabular-nums",
        row.direction === "down" && "text-emerald-600 dark:text-emerald-400",
        row.direction === "up" && "text-amber-600 dark:text-amber-400",
      )}
    >
      {row.next}
    </span>
  );
}

/**
 * A queued change to this slot's terms, as one informational strip.
 *
 * ── Why this is not a warning ───────────────────────────────────────────────
 *
 * It used to be three amber panels' worth of copy, rendered twice — once in the
 * details tab and once above the buy form — with a headline and a subtext per
 * viewer, plus a paragraph explaining what an occupancy transition is. Nothing
 * queued here is dangerous: it is a fact about the slot with one consequence for
 * a buyer, and amber spent on it is amber unavailable for INSOLVENT, which
 * genuinely is urgent. So: info tint, one line of numbers, one line of
 * consequence, one place on the page.
 *
 * ── The one thing the copy must not fumble ──────────────────────────────────
 *
 * Eligibility and application are two conditions, not one. `TERMS_DELAY` makes a
 * proposal eligible; only a buy, release or liquidation applies it. "Applies in
 * 24h" implies a timer that does not exist, and "applies at the next buy" is
 * false during the delay. The strip says the ripe half as a countdown and the
 * trigger half as the consequence, which is both without the essay.
 */
export function PendingTermsBanner({
  state,
  nowSeconds,
  className,
}: {
  state: SlotState;
  nowSeconds: number;
  className?: string;
}) {
  const { chainId } = useChain();
  /**
   * Both timestamps here are the CHAIN'S, so both must be measured against the
   * chain's clock. `appliesAt` is derived from a `block.timestamp`, and on a
   * warped local chain the browser's own clock reads days out. Measured from a
   * block header rather than assumed — see `useChainTimeSkew`. Read before the
   * early return below, because it is a hook and the return is conditional.
   */
  const skew = useChainTimeSkew();

  const rows = pendingChanges(state, chainId);
  if (rows.length === 0) return null;

  const chainNow = nowSeconds + skew;
  /**
   * Straight from `hasRipeTerms()`, not inferred from `proposedAt` and this
   * browser's clock. The contract decides against ITS clock.
   */
  const ripe = state.pending.applies;
  const { appliesAt } = state.pending;
  const tax = rows.find((r) => r.dimension === "tax");

  // One consequence line, and it turns on ripeness. Ripe: the reader's own buy
  // is the transition that lands this. Unripe: it cannot be, whatever they do.
  const consequence = ripe
    ? tax
      ? `Applies at the next buy — including yours, at ${tax.next}.`
      : "Applies at the next buy — including yours."
    : tax
      ? `Buying after that holds this slot at ${tax.next}.`
      : "Buying after that takes the new terms.";

  return (
    <div
      className={cn(
        "border-b bg-sky-500/[0.06] px-3 py-2.5 sm:px-4",
        "text-sky-900 dark:text-sky-100",
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        <Info
          className="mt-0.5 size-3.5 shrink-0 text-sky-600 dark:text-sky-400"
          aria-hidden="true"
        />

        <div className="min-w-0 flex-1 space-y-1">
          {rows.map((row) => (
            <div
              key={row.dimension}
              className="flex items-center gap-x-2 gap-y-1 text-xs"
            >
              <span className="font-medium">{row.label}</span>
              <span className="text-muted-foreground line-through">
                {row.current}
              </span>
              <span aria-hidden="true" className="text-muted-foreground">
                →
              </span>
              <NextValue row={row} />
              <span className="ml-auto shrink-0 font-medium tabular-nums text-sky-700 dark:text-sky-300">
                {ripe
                  ? "eligible now"
                  : `in ${eligibleIn(appliesAt, chainNow)}`}
              </span>
            </div>
          ))}

          <p className="text-[11px] leading-snug text-muted-foreground">
            {consequence}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * The manager's retraction controls, for the manage tab.
 *
 * Separate from the banner on purpose. This is the only place on the page that
 * can undo a proposal, and it lives beside `Propose` — the control that made
 * one — rather than inside a notice in the info tab. Two reasons, and the
 * second is the load-bearing one:
 *
 *  1. Reading and writing are different tabs here already. The info tab is
 *     where a prospective buyer looks; nothing there should send a transaction.
 *
 *  2. The affordance has to be a labelled button. It was a `×`, which reads as
 *     "close this" everywhere else — so the single control for retracting a
 *     queued change looked like a way to hide the message about it. An
 *     irreversible write should never wear a dismiss icon.
 */
export function QueuedTermsControls({
  slot,
  state,
  actions,
}: {
  slot: Address;
  state: SlotState;
  actions: Actions;
}) {
  const { chainId } = useChain();
  const skew = useChainTimeSkew();

  const rows = pendingChanges(state, chainId);
  if (rows.length === 0) return null;

  const chainNow = nowSecondsOf(skew);
  const ripe = state.pending.applies;
  const { appliesAt } = state.pending;

  return (
    <div className="space-y-2 border border-sky-500/30 bg-sky-500/[0.06] p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-700 dark:text-sky-300">
          Queued
        </h4>
        <span className="text-[10px] font-medium tabular-nums text-sky-700 dark:text-sky-300">
          {ripe
            ? "eligible now"
            : `eligible in ${eligibleIn(appliesAt, chainNow)}`}
        </span>
      </div>

      <ul className="space-y-2">
        {rows.map((row) => {
          const label = CANCEL_LABEL[row.dimension];
          const working = actions.busy && actions.activeAction === label;
          return (
            <li
              key={row.dimension}
              className="flex flex-wrap items-center justify-between gap-2 text-xs"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="font-medium">{row.label}</span>
                <span className="text-muted-foreground line-through">
                  {row.current}
                </span>
                <span aria-hidden="true" className="text-muted-foreground">
                  →
                </span>
                <NextValue row={row} />
              </span>

              <Button
                variant="outline"
                size="sm"
                className="h-7 shrink-0 gap-1.5 px-2 text-[11px] text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={actions.busy}
                onClick={() =>
                  // Per-dimension, mirroring the contract. The two may belong
                  // to different roles, so an all-or-nothing cancel would let
                  // one retraction silently destroy the other's queued change.
                  actions.cancelTerms(
                    slot,
                    row.dimension === "tax",
                    row.dimension === "hook",
                  )
                }
              >
                {working && (
                  <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                )}
                {CANCEL_TEXT[row.dimension]}
              </Button>
            </li>
          );
        })}
      </ul>

      <p className="text-[10px] leading-snug text-muted-foreground">
        Retracting is itself a transaction, and only possible until a buy,
        release or liquidation applies these.
      </p>
    </div>
  );
}

/**
 * The chain's "now" in seconds.
 *
 * The banner is handed `nowSeconds` by the page, which already ticks one clock
 * for every live figure on it. This panel has no such prop and does not need a
 * second ticker: a countdown measured in hours does not have to be re-rendered
 * every second, and the panel re-renders on every poll anyway.
 */
function nowSecondsOf(skew: number): number {
  return Math.floor(Date.now() / 1000) + skew;
}
