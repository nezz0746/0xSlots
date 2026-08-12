import { Lock, LockOpen, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * The slot page's detail sections, using the create form's vocabulary.
 *
 * The two pages describe the same six things, so a slot's terms should look
 * like the form that set them — same icon, same tint, same order. See
 * app/create/sections.ts, which owns that vocabulary for the form side.
 *
 * `weight` is what gives the page its hierarchy. The terms decide whether to
 * buy, so they lead and their values are set in the body size. The extensions —
 * occupancy policy and utility — are consequential but conditional, present on
 * a minority of slots and meaningless to most readers, so they sit last and
 * quiet rather than competing with the rate.
 */
export function DetailGroup({
  icon: Icon,
  title,
  tint,
  weight = "normal",
  children,
}: {
  icon: LucideIcon;
  title: string;
  /** Tailwind tile classes, matching the create form's section tints. */
  tint: string;
  weight?: "primary" | "normal" | "quiet";
  children: ReactNode;
}) {
  return (
    <section className={cn("space-y-1.5", weight === "quiet" && "opacity-80")}>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex items-center justify-center",
            weight === "quiet" ? "size-4" : "size-5",
            tint,
          )}
        >
          <Icon className={weight === "quiet" ? "size-2.5" : "size-3"} />
        </span>
        <h3
          className={cn(
            "uppercase tracking-wider text-muted-foreground",
            weight === "quiet" ? "text-[10px]" : "text-[11px] font-medium",
          )}
        >
          {title}
        </h3>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className={cn("space-y-1", weight === "quiet" ? "pl-6" : "pl-7")}>
        {children}
      </div>
    </section>
  );
}

export function DetailRow({
  label,
  value,
  badge,
  weight = "normal",
}: {
  label: ReactNode;
  value: ReactNode;
  /** Mutability chip and the like, sitting with the label. */
  badge?: ReactNode;
  weight?: "primary" | "normal" | "quiet";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span
        className={cn(
          "flex items-center gap-1.5 text-muted-foreground",
          weight === "quiet" ? "text-[11px]" : "text-xs",
        )}
      >
        {label}
        {badge}
      </span>
      <span
        className={cn(
          "text-right tabular-nums",
          weight === "primary"
            ? "text-sm font-semibold"
            : weight === "quiet"
              ? "text-[11px]"
              : "text-xs",
        )}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Whether a dimension can still be changed after creation.
 *
 * Repeated on tax, utility and occupancy, so it lives here rather than three
 * times inline. The lock is the whole point of a slot's terms: an immutable
 * rate is a promise, a mutable one is a manager's discretion.
 */
export function MutabilityChip({
  mutable,
  what,
}: {
  mutable: boolean;
  what: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center px-1 py-0.5 text-[10px] font-medium cursor-default",
            mutable
              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              : "bg-muted text-muted-foreground",
          )}
        >
          {mutable ? (
            <LockOpen className="size-2.5" />
          ) : (
            <Lock className="size-2.5" />
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        {mutable
          ? `Mutable — the manager can change the ${what}`
          : `Immutable — the ${what} is fixed forever`}
      </TooltipContent>
    </Tooltip>
  );
}
