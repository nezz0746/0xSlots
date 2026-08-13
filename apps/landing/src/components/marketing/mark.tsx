import { cn } from "@/lib/utils";

/**
 * The 0xSlots mark: a parcel rotated onto its corner, subdivided
 * into nine cells. Four are vacant, five are occupied. Every other
 * shape on this page is a descendant of it.
 */
export function Mark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={cn("size-6", className)}
      role="img"
      aria-label="0xSlots"
    >
      <g transform="rotate(45 50 50)">
        <rect x="20" y="20" width="60" height="60" fill="currentColor" />
        <rect x="22" y="22" width="16" height="16" className="fill-background" />
        <rect x="42" y="22" width="16" height="16" className="fill-background" />
        <rect x="22" y="42" width="16" height="16" className="fill-background" />
        <rect x="42" y="42" width="16" height="16" className="fill-background" />
      </g>
    </svg>
  );
}

/**
 * A single parcel cell, used as a list marker. Occupied cells are
 * solid; vacant cells are hollow — the same grammar as the mark.
 */
export function Cell({
  occupied = false,
  className,
}: {
  occupied?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 12 12"
      className={cn("size-2.5 shrink-0", className)}
      aria-hidden="true"
    >
      <rect
        x="1.5"
        y="1.5"
        width="9"
        height="9"
        transform="rotate(45 6 6)"
        fill={occupied ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

/** Mixed case on purpose — the brand is 0xSlots, never 0XSLOTS. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <Mark className="size-5" />
      <span className="text-[17px] font-extrabold tracking-[-0.02em]">
        0xSlots
      </span>
    </span>
  );
}
