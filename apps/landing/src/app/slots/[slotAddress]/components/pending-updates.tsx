"use client";

import { UpdateKind } from "@0xslots/sdk";
import type { SlotOnChain } from "@0xslots/sdk/react";
import { Clock, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBps } from "@/utils";

/**
 * Who is looking. The same queued change means three different things, and the
 * copy has to say which:
 *
 * - `buyer`   — buying NOW applies it. Their own purchase IS the next
 *               ownership transition, so these are the terms they will hold
 *               the slot under, not the ones on display above.
 * - `occupant`— it does NOT touch them. It lands when they leave.
 * - `manager` — they queued it, and can retract it.
 *
 * The page used to show one string, written manager-facing, to all three:
 * "applied on next ownership transition". To a buyer that reads as *later, to
 * someone else* — exactly backwards.
 */
export type PendingViewer = "buyer" | "occupant" | "manager";

export type PendingChange = {
  kind: UpdateKind;
  label: string;
  /** What the slot has today. */
  current: string;
  /** What it becomes when this applies. */
  next: string;
  /** Unix seconds, or 0 when the slot predates the contract recording it. */
  proposedAt: bigint;
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

/**
 * Collect the queued changes on a slot, resolved into before/after strings.
 *
 * Reads the three `has*` flags rather than testing the values for emptiness:
 * the zero address is a REAL proposed value for both address dimensions —
 * "remove the utility" and "drop the occupancy policy" are changes someone
 * deliberately queued, and treating them as "nothing pending" would hide the
 * most consequential update of the three.
 */
export function pendingChanges(
  slot: SlotOnChain,
  utilityName: (address: string | null) => string,
  policyName: (address: string | null) => string,
): PendingChange[] {
  const changes: PendingChange[] = [];

  if (slot.hasPendingTax) {
    changes.push({
      kind: UpdateKind.Tax,
      label: "Tax rate",
      current: `${formatBps(slot.taxPercentage.toString())}/mo`,
      next: `${formatBps(slot.pendingTaxPercentage.toString())}/mo`,
      proposedAt: slot.taxProposedAt,
    });
  }
  if (slot.hasPendingUtility) {
    changes.push({
      kind: UpdateKind.Utility,
      label: "Utility",
      current: utilityName(slot.utility),
      next: utilityName(slot.pendingUtility),
      proposedAt: slot.utilityProposedAt,
    });
  }
  if (slot.hasPendingPolicy) {
    changes.push({
      kind: UpdateKind.Policy,
      label: "Occupancy terms",
      current: policyName(slot.occupancyPolicy),
      next: policyName(slot.pendingPolicy),
      proposedAt: slot.policyProposedAt,
    });
  }

  return changes;
}

const HEADLINE: Record<PendingViewer, string> = {
  buyer: "Buying now applies these changes to you",
  occupant: "Queued for the next occupant",
  manager: "Queued changes",
};

const SUBTEXT: Record<PendingViewer, string> = {
  buyer:
    "These take effect in the same transaction as your purchase. You will hold this slot on the new terms, not the ones shown above.",
  occupant:
    "Your terms are unchanged while you hold the slot. These apply when you release it or are bought out.",
  manager:
    "Applied on the next ownership transition — including a purchase, which lands them on the incoming occupant.",
};

export function PendingUpdatesNotice({
  changes,
  viewer,
  nowSeconds,
  onCancel,
  busy,
  activeAction,
  className,
}: {
  changes: PendingChange[];
  viewer: PendingViewer;
  nowSeconds: number;
  /** Manager only. Omit to render read-only. */
  onCancel?: (kind: UpdateKind) => void;
  busy?: boolean;
  activeAction?: string | null;
  className?: string;
}) {
  if (changes.length === 0) return null;

  // A buyer is the one who can be surprised by these, so they get the loud
  // treatment. Everyone else gets an informational note.
  const tone =
    viewer === "buyer"
      ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
      : "border-border bg-muted/40 text-muted-foreground";

  return (
    <div
      className={`rounded-lg border p-3 space-y-2.5 ${tone} ${className ?? ""}`}
    >
      <div className="space-y-1">
        <p className="text-sm font-medium leading-tight">{HEADLINE[viewer]}</p>
        <p className="text-xs leading-snug opacity-80">{SUBTEXT[viewer]}</p>
      </div>

      <ul className="space-y-1.5">
        {changes.map((change) => {
          const ago = queuedAgo(change.proposedAt, nowSeconds);
          const cancelLabel = CANCEL_LABEL[change.kind];
          return (
            <li
              key={change.kind}
              className="flex items-start justify-between gap-3 text-xs"
            >
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-medium">{change.label}</span>
                  <span className="opacity-60 line-through">
                    {change.current}
                  </span>
                  <span aria-hidden="true">→</span>
                  <span className="font-semibold">{change.next}</span>
                </div>
                {ago && (
                  <span className="flex items-center gap-1 opacity-60">
                    <Clock className="size-3" aria-hidden="true" />
                    queued {ago}
                  </span>
                )}
              </div>

              {onCancel && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 shrink-0 text-destructive hover:text-destructive"
                  disabled={busy}
                  onClick={() => onCancel(change.kind)}
                  aria-label={cancelLabel}
                >
                  {busy && activeAction === cancelLabel ? (
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
    </div>
  );
}

/**
 * Must match the labels `useSlotAction` reports through `activeAction`, so the
 * spinner lands on the row whose cancel is actually in flight rather than on
 * all three at once.
 */
const CANCEL_LABEL: Record<UpdateKind, string> = {
  [UpdateKind.Tax]: "Cancel tax update",
  [UpdateKind.Utility]: "Cancel utility update",
  [UpdateKind.Policy]: "Cancel policy update",
};
