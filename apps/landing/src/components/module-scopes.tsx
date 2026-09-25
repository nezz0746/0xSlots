"use client";

import type { ModuleFee } from "@0xslots/sdk/slots";
import { SCOPE_LABELS, SCOPE_ORDER, type ScopeSet } from "@/lib/module-scopes";
import { cn } from "@/lib/utils";
import { formatBps, truncateAddress } from "@/utils";

export type { ModuleFee };

/**
 * A module's declared scopes, drawn rather than described.
 *
 * ALL of them, always, with the inactive ones greyed. A list of only what is on
 * cannot be read as a set — it leaves the reader to remember which five it did
 * not say, and a scope being OFF is the more reassuring fact of the two.
 *
 * No tooltips and no prose. Every phrasing of what a callback "can" or "cannot"
 * do turned out to cost more than it explained: these are new concepts, and a
 * sentence per scope is six sentences of load for a reader who mostly needs to
 * see the SHAPE. On or off, in a fixed order, is the whole thing.
 *
 * The fee sits at the end of the same row: it is the other half of what a module
 * asks for, and a reader weighing a module should see both in one place.
 *
 * The same component in the create form and on the slot page, so a module looks
 * identical while you are attaching it and after it is attached.
 *
 * `ModuleScopeRow`, not `Scopes` — the SDK already exports that name for the
 * struct, and a component sharing it makes every importing file choose.
 */
export function ModuleScopeRow({
  scopes,
  fee,
  className,
}: {
  scopes: Partial<ScopeSet> | undefined | null;
  /** Omit when the fee is not known yet; the chips are then left out. */
  fee?: ModuleFee | null;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {SCOPE_ORDER.map((key) => {
        const on = !!scopes?.[key];
        return (
          <span
            key={key}
            className={cn(
              "inline-flex items-center px-1.5 py-0.5 text-[10px] leading-none whitespace-nowrap",
              on
                ? // `afterCallbacksMustSucceed` costs the SLOT something rather
                  // than telling the module something, so it reads as a warning.
                  key === "afterCallbacksMustSucceed"
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                  : "bg-green-500/15 text-green-700 dark:text-green-500"
                : "bg-muted text-muted-foreground/50",
            )}
          >
            {SCOPE_LABELS[key] ?? key}
          </span>
        );
      })}
      {fee && (
        <>
          <span aria-hidden className="mx-0.5 h-3 w-px bg-border" />
          <span
            className={cn(
              "inline-flex items-center px-1.5 py-0.5 text-[10px] leading-none whitespace-nowrap tabular-nums",
              fee.bps > 0
                ? "bg-blue-500/10 text-blue-700 dark:text-blue-400"
                : "bg-muted text-muted-foreground/50",
            )}
          >
            {fee.bps > 0 ? `fee ${formatBps(fee.bps)}` : "no fee"}
          </span>
          {fee.bps > 0 && (
            <span
              title={fee.recipient}
              className="inline-flex items-center bg-muted px-1.5 py-0.5 font-mono text-[10px] leading-none whitespace-nowrap text-muted-foreground"
            >
              to {truncateAddress(fee.recipient)}
            </span>
          )}
        </>
      )}
    </div>
  );
}
