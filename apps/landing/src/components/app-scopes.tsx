"use client";

import type { Address } from "viem";
import { PERMISSION_LABELS, PERMISSION_ORDER, type HookPermissionSet } from "@/lib/app-scopes";
import { cn } from "@/lib/utils";
import { formatBps, truncateAddress } from "@/utils";

/** The fee half of an app's offer. */
export interface HookFee {
  feeBps: number;
  feeRecipient: Address;
}

/**
 * An app's declared scopes, drawn rather than described.
 *
 * ALL of them, always, with the inactive ones greyed. A list of only what is on
 * cannot be read as a set — it leaves the reader to remember which five it did
 * not say, and a permission being OFF is the more reassuring fact of the two.
 *
 * No tooltips and no prose. Every phrasing of what a callback "can" or "cannot"
 * do turned out to cost more than it explained: these are new concepts, and a
 * sentence per permission is six sentences of load for a reader who mostly needs to
 * see the SHAPE. On or off, in a fixed order, is the whole thing.
 *
 * The fee sits at the end of the same row: it is the other half of what an app
 * asks for, and a reader weighing an app should see both in one place.
 *
 * The same component in the create form and on the slot page, so an app looks
 * identical while you are attaching it and after it is attached.
 *
 * `AppScopeRow`, not `Scopes` — the SDK already exports that name for the
 * struct, and a component sharing it makes every importing file choose.
 */
export function AppScopeRow({
  scopes,
  fee,
  className,
}: {
  scopes: Partial<HookPermissionSet> | undefined | null;
  /** Omit when the fee is not known yet; the chips are then left out. */
  fee?: HookFee | null;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {PERMISSION_ORDER.map((key) => {
        const on = !!scopes?.[key];
        return (
          <span
            key={key}
            className={cn(
              "inline-flex items-center px-1.5 py-0.5 text-[10px] leading-none whitespace-nowrap",
              on
                ? // `strict` costs the SLOT something rather than telling the
                  // app something, so it is the one that reads as a warning.
                  key === "strict"
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                  : "bg-green-500/15 text-green-700 dark:text-green-500"
                : "bg-muted text-muted-foreground/50",
            )}
          >
            {PERMISSION_LABELS[key] ?? key}
          </span>
        );
      })}
      {fee && (
        <>
          <span aria-hidden className="mx-0.5 h-3 w-px bg-border" />
          <span
            className={cn(
              "inline-flex items-center px-1.5 py-0.5 text-[10px] leading-none whitespace-nowrap tabular-nums",
              fee.feeBps > 0
                ? "bg-blue-500/10 text-blue-700 dark:text-blue-400"
                : "bg-muted text-muted-foreground/50",
            )}
          >
            {fee.feeBps > 0 ? `fee ${formatBps(fee.feeBps)}` : "no fee"}
          </span>
          {fee.feeBps > 0 && (
            <span
              title={fee.feeRecipient}
              className="inline-flex items-center bg-muted px-1.5 py-0.5 font-mono text-[10px] leading-none whitespace-nowrap text-muted-foreground"
            >
              to {truncateAddress(fee.feeRecipient)}
            </span>
          )}
        </>
      )}
    </div>
  );
}
