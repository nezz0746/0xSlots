"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A bar that folds something away until it is asked for.
 *
 * The same gesture as the price field's "Adjust", and deliberately the same bar:
 * a hairline strip with a chevron, opening onto whatever it holds. It exists for
 * controls that must be reachable but should not be the first thing read —
 * releasing a slot, flushing settled tax — which as full-width buttons sat with
 * the same weight as the form above them and made the panel read as a list of
 * five equally likely things to do.
 *
 * Uncontrolled on purpose. Nothing outside needs to know, and a caller that
 * cared would have to hold state for a disclosure it does not otherwise touch.
 */
export function Reveal({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("border", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-center gap-1 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <ChevronDown
          aria-hidden
          className={cn("size-3 transition-transform", open && "rotate-180")}
        />
        {label}
      </button>

      {open && <div className="space-y-2 border-t p-2.5">{children}</div>}
    </div>
  );
}
