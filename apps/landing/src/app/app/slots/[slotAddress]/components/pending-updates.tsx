"use client";

import { findKnownHook } from "@0xslots/contracts/slots";
import type { SlotState } from "@0xslots/sdk/slots";
import { Clock, Hourglass, Loader2, X } from "lucide-react";
import { type Address, zeroAddress } from "viem";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useChain } from "@/context/chain";
import { useChainTimeSkew } from "@/hooks/slots/use-slots";
import type { useSlotsAction } from "@/hooks/slots/use-slots-action";
import { formatBps, truncateAddress } from "@/utils";
import { Panel } from "./panel";

type Actions = ReturnType<typeof useSlotsAction>;

/**
 * Which of the two dimensions a queued change touches.
 *
 * The previous protocol had three — tax, utility, occupancy policy. Utilities
 * and policies both collapsed into the single `hook` address, so there are two,
 * and they are still independent: `proposeTerms` takes a flag per dimension and
 * `cancelTerms` takes one per dimension too.
 */
export type PendingDimension = "tax" | "hook";

/**
 * Who is looking. The same queued change means three different things, and the
 * copy has to say which:
 *
 * - `buyer`   — buying NOW applies it. Their own purchase IS the next
 *               occupancy transition, so these are the terms they will hold
 *               the slot under, not the ones on display above.
 * - `occupant`— it does NOT touch them. It lands when they leave.
 * - `manager` — they queued it, and can retract it.
 *
 * The page used to show one string, written manager-facing, to all three:
 * "applied on next occupancy transition". To a buyer that reads as *later, to
 * someone else* — exactly backwards, and it is the buyer who pays for the
 * misreading.
 */
export type PendingViewer = "buyer" | "occupant" | "manager";

export type PendingChange = {
  dimension: PendingDimension;
  label: string;
  /** What the slot has today. */
  current: string;
  /** What it becomes when this applies. */
  next: string;
};

/** Human "3 days ago" for a unix timestamp, or null if we were never told. */
function queuedAgo(proposedAt: bigint, nowSeconds: number): string | null {
  if (proposedAt === 0n) return null;
  const elapsed = Math.max(0, nowSeconds - Number(proposedAt));
  if (elapsed < 60) return `${elapsed}s ago`;
  if (elapsed < 3600) return `${Math.floor(elapsed / 60)}m ago`;
  if (elapsed < 86400) return `${Math.floor(elapsed / 3600)}h ago`;
  return `${Math.floor(elapsed / 86400)}d ago`;
}

/** "in 7h" — how long until an unripe proposal may be applied. */
function ripensIn(appliesAt: bigint, nowSeconds: number): string {
  const left = Math.max(0, Number(appliesAt) - nowSeconds);
  if (left < 60) return `in ${left}s`;
  if (left < 3600) return `in ${Math.floor(left / 60)}m`;
  if (left < 86400) return `in ${Math.ceil(left / 3600)}h`;
  return `in ${Math.ceil(left / 86400)}d`;
}

/** The wall-clock instant a queued change becomes applicable. */
function ripeAt(appliesAt: bigint): string {
  return new Date(Number(appliesAt) * 1000).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function hookLabel(chainId: number, hook: Address): string {
  if (hook === zeroAddress) return "none — detached";
  return findKnownHook(chainId, hook)?.name ?? truncateAddress(hook);
}

/**
 * Collect the queued changes on a slot, resolved into before/after strings.
 *
 * Reads the `has*` flags rather than testing the values for emptiness: the zero
 * address is a REAL proposed value for the hook dimension — "detach the hook"
 * is a change someone deliberately queued, and treating it as "nothing pending"
 * would hide the more consequential of the two.
 */
export function pendingChanges(
  state: SlotState,
  chainId: number,
): PendingChange[] {
  const changes: PendingChange[] = [];
  const { pending } = state;

  if (pending.hasTax) {
    changes.push({
      dimension: "tax",
      label: "Tax rate",
      current: `${formatBps(Number(state.taxBps))}/mo`,
      next: `${formatBps(Number(pending.taxBps))}/mo`,
    });
  }
  if (pending.hasHook) {
    changes.push({
      dimension: "hook",
      label: "Hook",
      current: hookLabel(chainId, state.hook),
      next: hookLabel(chainId, pending.hook),
    });
  }

  return changes;
}

/**
 * The copy, and it turns on RIPENESS as much as on who is looking.
 *
 * `TERMS_DELAY` is new and it broke the sentence this panel used to say. A
 * proposal is not binding the moment it is made: `_applyPending` asks
 * `hasRipeTerms()` first, and refuses anything younger than a day. So "buying
 * now applies these to you" — which was true, and was the whole reason the
 * buyer-facing copy existed — is now FALSE for the first day of every proposal,
 * and false in the direction that costs the buyer: they brace for terms that
 * will not land, or size a deposit against a rate the transition will not use.
 *
 * Ripe: the old copy, which is still correct.
 * Unripe: queued, applies after a date, at the next occupancy change — a
 * conjunction of both conditions, because it really is both.
 */
const HEADLINE: Record<PendingViewer, string> = {
  buyer: "Buying now applies these changes to you",
  occupant: "Queued for the next occupant",
  manager: "Queued changes",
};

const UNRIPE_HEADLINE: Record<PendingViewer, string> = {
  buyer: "Queued, but not binding yet",
  occupant: "Queued, but not binding yet",
  manager: "Queued — waiting out the delay",
};

const SUBTEXT: Record<PendingViewer, string> = {
  buyer:
    "These take effect in the same transaction as your purchase. You will hold this slot on the new terms, not the ones shown above — and your deposit is sized against them.",
  occupant:
    "Your terms are unchanged while you hold the slot. These apply when you release it or are bought out.",
  manager:
    "Applied on the next occupancy transition — including a purchase, which lands them on the incoming occupant.",
};

const UNRIPE_SUBTEXT: Record<PendingViewer, string> = {
  buyer:
    "Buying before then leaves you on the terms shown above, and your deposit is sized against those. The delay exists so terms cannot land on a buyer already in flight.",
  occupant:
    "Your terms are unchanged while you hold the slot, and these cannot land on anyone until the delay has run.",
  manager:
    "A transition before then applies nothing. The delay is what stops terms landing on a buyer whose transaction is already in flight.",
};

/**
 * Must match the labels `useSlotAction` reports through `activeAction`, so the
 * spinner lands on the row whose cancel is actually in flight rather than on
 * both at once.
 */
const CANCEL_LABEL: Record<PendingDimension, string> = {
  tax: "Cancel tax update",
  hook: "Cancel hook update",
};

export function PendingUpdatesPanel({
  slot,
  state,
  viewer,
  nowSeconds,
  actions,
  bare,
}: {
  slot: Address;
  state: SlotState;
  viewer: PendingViewer;
  nowSeconds: number;
  /** Manager only. Omit to render read-only. */
  actions?: Actions;
  /**
   * Render without the panel chrome, for use inside a card that already has a
   * header. The card it sits in is a single object — a border and a title of
   * its own would make one card look like two.
   */
  bare?: boolean;
}) {
  const { chainId } = useChain();
  /**
   * Both timestamps here are the CHAIN'S, so both must be measured against the
   * chain's clock.
   *
   * `proposedAt` is a `block.timestamp` and `TERMS_DELAY` is counted in chain
   * seconds. Subtracting the browser's `Date.now()` from either answers a
   * different question, and on a warped local chain — eight days ahead in the
   * local runbook — "applies in 9d" is nine times the real wait. The skew is
   * measured from a block header rather than assumed; see `useChainTimeSkew`.
   *
   * Read BEFORE the early return below, because it is a hook and the return is
   * conditional.
   */
  const skew = useChainTimeSkew();

  const changes = pendingChanges(state, chainId);
  if (changes.length === 0) return null;

  const chainNow = nowSeconds + skew;
  const ago = queuedAgo(state.pending.proposedAt, chainNow);
  const canCancel = viewer === "manager" && !!actions;
  /**
   * Straight from `hasRipeTerms()`, not inferred from `proposedAt` and this
   * browser's clock. The contract decides against ITS clock, and the two are
   * not the same clock — a warped local chain is hours or days out.
   */
  const ripe = state.pending.applies;
  const { appliesAt } = state.pending;

  const body = (
    <>
      <div className="space-y-1">
        <p
          className={
            // A buyer is the one who can be surprised by these, so they get the
            // loud treatment. Everyone else gets an informational note.
            viewer === "buyer"
              ? "text-sm font-medium leading-tight text-amber-700 dark:text-amber-400"
              : "text-sm font-medium leading-tight"
          }
        >
          {ripe ? HEADLINE[viewer] : UNRIPE_HEADLINE[viewer]}
        </p>
        {!ripe && appliesAt > 0n && (
          // The honest phrasing, and it is a conjunction: a date AND a
          // transition. Either half alone is the old bug — "applies after
          // Tuesday" implies a timer, "applies at the next occupancy change"
          // implies the next buyer gets it.
          <p className="text-[11px] font-medium leading-snug">
            Applies after {ripeAt(appliesAt)} ({ripensIn(appliesAt, chainNow)}
            ), at the next occupancy change.
          </p>
        )}
        <p className="text-[11px] leading-snug text-muted-foreground">
          {ripe ? SUBTEXT[viewer] : UNRIPE_SUBTEXT[viewer]} A transition is a{" "}
          <strong className="font-medium text-foreground">
            buy, a sell, a release or a liquidation
          </strong>{" "}
          — nothing else applies them, and they never apply on a timer.
        </p>
      </div>

      <ul className="space-y-1.5 border-t pt-2">
        {changes.map((change) => {
          const label = CANCEL_LABEL[change.dimension];
          const working = actions?.busy && actions.activeAction === label;
          return (
            <li
              key={change.dimension}
              className="flex items-start justify-between gap-3 text-xs"
            >
              <div className="min-w-0 space-y-0.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium">{change.label}</span>
                  <span className="text-muted-foreground line-through">
                    {change.current}
                  </span>
                  <span aria-hidden="true">→</span>
                  <span className="font-semibold">{change.next}</span>
                </div>
              </div>

              {canCancel && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 shrink-0 px-2 text-destructive hover:text-destructive"
                  disabled={actions.busy}
                  onClick={() =>
                    // Per-dimension, mirroring the contract. The two may belong
                    // to different people — a collective splits tax and hook
                    // across separate roles — so an all-or-nothing cancel would
                    // let one retraction destroy the other's queued change with
                    // nothing to signal it happened.
                    actions.cancelTerms(
                      slot,
                      change.dimension === "tax",
                      change.dimension === "hook",
                    )
                  }
                  aria-label={label}
                  title={label}
                >
                  {working ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <X className="size-3" aria-hidden="true" />
                  )}
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      {ago && (
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="size-3" aria-hidden="true" />
          queued {ago}
        </span>
      )}
    </>
  );

  if (bare)
    return (
      <div className="space-y-2 border-b bg-amber-500/[0.06] p-4">{body}</div>
    );

  return (
    <Panel
      icon={Hourglass}
      title="Pending terms"
      tint="bg-amber-500/15 text-amber-600 dark:text-amber-400"
      actions={
        <Badge className="gap-1 bg-amber-500/15 text-amber-700 dark:text-amber-400">
          {ripe ? "not yet in force" : "not yet binding"}
        </Badge>
      }
    >
      {body}
    </Panel>
  );
}
