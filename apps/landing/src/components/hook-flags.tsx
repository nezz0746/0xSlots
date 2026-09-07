"use client";

import { FLAG_LABELS, FLAG_ORDER, type HookFlagSet } from "@/lib/hook-flags";
import { cn } from "@/lib/utils";

/**
 * A hook's declared flags, drawn rather than described.
 *
 * ALL of them, always, with the inactive ones greyed. A list of only what is on
 * cannot be read as a set — it leaves the reader to remember which five it did
 * not say, and a flag being OFF is the more reassuring fact of the two.
 *
 * No tooltips and no prose. Every phrasing of what a callback "can" or "cannot"
 * do turned out to cost more than it explained: these are new concepts, and a
 * sentence per flag is six sentences of load for a reader who mostly needs to
 * see the SHAPE. On or off, in a fixed order, is the whole thing.
 *
 * The same component in the create form and on the slot page, so a hook looks
 * identical while you are attaching it and after it is attached.
 *
 * `HookFlagRow`, not `HookFlags` — the SDK already exports that name for the
 * struct, and a component sharing it makes every importing file choose.
 */
export function HookFlagRow({
  flags,
  className,
}: {
  flags: Partial<HookFlagSet> | undefined | null;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {FLAG_ORDER.map((key) => {
        const on = !!flags?.[key];
        return (
          <span
            key={key}
            className={cn(
              "inline-flex items-center px-1.5 py-0.5 text-[10px] leading-none whitespace-nowrap",
              on
                ? // `strict` costs the SLOT something rather than telling the
                  // hook something, so it is the one that reads as a warning.
                  key === "strict"
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                  : "bg-green-500/15 text-green-700 dark:text-green-500"
                : "bg-muted text-muted-foreground/50",
            )}
          >
            {FLAG_LABELS[key] ?? key}
          </span>
        );
      })}
    </div>
  );
}
