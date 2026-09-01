"use client";

import { formatDuration } from "@/hooks/use-duration";

/**
 * Tenure, drawn instead of explained.
 *
 * How much protection is left is a position in time, which a reader takes in
 * from a picture far faster than from a paragraph.
 *
 * Deliberately not a chart library: one shape, and every number that matters is
 * also written as text beside it.
 *
 * An EpochTimeline used to sit alongside this, drawing the current epoch
 * filling and marking where a buy had been committed. Epoch scheduling was
 * removed in v4 — buys apply immediately — so there is no longer a window to
 * draw.
 *
 * Under the hook-based protocol the window comes from a MinimumTenureHook
 * rather than from an occupancy policy: `tenureSeconds()` on the hook, measured
 * from the slot's own `occupiedSince`. The drawing is unchanged, because the
 * fact being drawn is.
 */

/**
 * How much of the occupant's protected window is left.
 *
 * A meter rather than a countdown: "3d left" means something different on a
 * 7-day protection than on a 30-day one, and the bar carries that comparison
 * for free.
 */
export function TenureMeter({
  tenureSeconds,
  occupiedSince,
  now,
}: {
  tenureSeconds: number;
  occupiedSince: number;
  now: number;
}) {
  const elapsed = Math.max(now - occupiedSince, 0);
  const remaining = Math.max(tenureSeconds - elapsed, 0);
  const pct = Math.min((elapsed / tenureSeconds) * 100, 100);
  const over = remaining === 0;

  return (
    <div className="space-y-1.5">
      <div
        className="h-2.5 w-full rounded-full bg-muted overflow-hidden"
        role="img"
        aria-label={
          over
            ? "Protection has ended; the slot can be bought"
            : `Protected for another ${formatDuration(remaining)} of ${formatDuration(tenureSeconds)}`
        }
      >
        <div
          className={`h-full transition-[width] duration-1000 ease-linear ${
            over ? "bg-muted-foreground/40" : "bg-violet-500/70"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="text-muted-foreground">
          held {formatDuration(elapsed)}
        </span>
        <span className={over ? "text-muted-foreground" : "text-violet-600"}>
          {over ? (
            "can be bought"
          ) : (
            <>
              protected{" "}
              <span className="font-medium">{formatDuration(remaining)}</span>{" "}
              more
            </>
          )}
        </span>
      </div>
    </div>
  );
}
