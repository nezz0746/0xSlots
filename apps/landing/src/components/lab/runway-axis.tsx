"use client";

import {
  DAY,
  dateAfter,
  duration,
  HEALTH_TONE,
  type Health,
} from "@/lib/lab-slot";
import { cn } from "@/lib/utils";

/**
 * The one thing this page is built around.
 *
 * A slot's real question is not "what does it cost" but "how long until doing
 * nothing costs me the slot". So the interface makes time the axis and lets
 * every control write to it: raise the price and the marker slides left, add
 * funds and it slides right. The mechanism is learned by moving it rather than
 * by reading a paragraph about self-assessment.
 *
 * Deliberately NOT a progress bar. A bar implies a task with an end you are
 * working toward; this is a fuse, and the filled part is what remains.
 */
export function RunwayAxis({
  runway,
  health,
  nowMs,
  horizonDays = 60,
  compact = false,
}: {
  /** Seconds of funding left. `Infinity` when the price is zero. */
  runway: number;
  health: Health;
  /** The lab's clock, so the date label moves when time is advanced. */
  nowMs: number;
  horizonDays?: number;
  compact?: boolean;
}) {
  const horizon = horizonDays * DAY;
  const infinite = !Number.isFinite(runway);
  // Beyond the horizon the marker pins to the end and the label says so, rather
  // than rescaling — a shifting scale would make two readings incomparable, and
  // comparing readings is the whole point.
  const clamped = infinite ? horizon : Math.min(runway, horizon);
  const pct = (clamped / horizon) * 100;
  const tone = HEALTH_TONE[health];
  const beyond = infinite || runway > horizon;

  // Week gridlines give the eye a unit. Without them a bar at 40% means nothing.
  const weeks = Math.floor(horizonDays / 7);

  return (
    <div className={cn("w-full", compact ? "space-y-1.5" : "space-y-2.5")}>
      {!compact && (
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Funded until
          </span>
          <span className={cn("text-sm font-semibold tabular-nums", tone.text)}>
            {infinite ? "no cost to hold" : duration(runway)}
          </span>
        </div>
      )}

      <div className="relative">
        {/* The track. Week ticks sit behind the fill so the fill reads as a
            quantity measured against them, not as a separate object. */}
        <div
          className={cn(
            "relative w-full overflow-hidden bg-muted",
            compact ? "h-1.5" : "h-3",
          )}
        >
          {/* Week ticks as a gradient rather than N divs: they are decoration
              measured in CSS, carry no data, and need no keys or nodes. */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "repeating-linear-gradient(to right, transparent 0, transparent calc(100%/" +
                `${weeks}` +
                " - 1px), var(--background) calc(100%/" +
                `${weeks}` +
                " - 1px), var(--background) calc(100%/" +
                `${weeks}` +
                "))",
            }}
          />

          <div
            className={cn(
              "relative h-full transition-[width] duration-500 ease-out motion-reduce:transition-none",
              tone.bar,
            )}
            style={{ width: `${Math.max(pct, runway > 0 ? 1.5 : 0)}%` }}
          />
        </div>

        {/* The marker. This is the number people came for, so it is labelled in
            place rather than in a legend. */}
        {!compact && runway > 0 && (
          <div
            className="absolute top-full -translate-x-1/2 pt-1 transition-[left] duration-500 ease-out motion-reduce:transition-none"
            style={{ left: `${Math.min(Math.max(pct, 4), 96)}%` }}
          >
            <div className="flex flex-col items-center">
              <div className={cn("h-2 w-px", tone.bar)} />
              <span className="whitespace-nowrap pt-0.5 text-[10px] tabular-nums text-muted-foreground">
                {beyond ? `beyond ${horizonDays}d` : dateAfter(nowMs, runway)}
              </span>
            </div>
          </div>
        )}
      </div>

      {!compact && (
        <div className="flex items-center justify-between pt-4 text-[10px] tabular-nums text-muted-foreground">
          <span>today</span>
          <span>{horizonDays} days</span>
        </div>
      )}
    </div>
  );
}
