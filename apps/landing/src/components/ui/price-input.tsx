"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatUsd } from "@/hooks/use-usd-price";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/utils";

/** Percentage steps, laid out as one continuous scale from cut to raise. */
const STEPS = [-20, -10, -5, 5, 10, 20] as const;
const DURATION = 520;

/** Ease-out cubic — fast off the mark, settling into the target. */
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/**
 * A price field that animates between values.
 *
 * The percentage buttons COMPOUND off the current value rather than off the
 * starting one, so repeated taps behave like a market moving, not like a slider
 * with fixed stops. Each change counts the figure from the old value to the new
 * one over a requestAnimationFrame ease-out, and flashes green up / red down —
 * the motion is what makes a compounding step legible, since +10% of a moving
 * number is not a constant.
 *
 * The field stays directly editable: while it has focus the raw string is shown
 * verbatim and animation is suppressed, so typing is never fought by a running
 * tween.
 *
 * Beside the figure sits what the price actually COSTS at this slot's rate.
 * That is the Harberger squeeze made visible: every tap of +20% is also a
 * bigger monthly bill, and the two numbers move together.
 */
export function PriceInput({
  value,
  onChange,
  label,
  taxBps,
  symbol,
  disabled,
  hint,
  toUsd,
}: {
  value: number;
  onChange: (next: number) => void;
  label: string;
  /** The slot's monthly rate in basis points — what this price will cost. */
  taxBps: bigint;
  symbol: string;
  disabled?: boolean;
  hint?: string;
  /**
   * Token amount → USD, or `null` where there is no price (any chain but Base,
   * or a token Alchemy does not quote). Renders nothing on `null` rather than
   * printing a zero beside a real figure.
   */
  toUsd?: (amount: number) => number | null;
}) {
  const [display, setDisplay] = useState(value);
  const [raw, setRaw] = useState<string | null>(null);
  const [flash, setFlash] = useState<"gain" | "loss" | null>(null);

  const displayRef = useRef(value);
  const prevValue = useRef(value);
  const skipAnim = useRef(false);
  const frame = useRef<number | null>(null);

  // Count from wherever the figure currently sits to the new value.
  useEffect(() => {
    const snap = () => {
      displayRef.current = value;
      setDisplay(value);
    };

    const from = displayRef.current;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    // Skip the count when typing, when there is nothing to count, when motion
    // is unwanted — and when the tab is hidden, because rAF is paused there and
    // a tween that never ticks would leave the figure stranded on a stale
    // number while the real value has moved on.
    if (
      skipAnim.current ||
      Math.abs(from - value) < 0.005 ||
      reduce ||
      document.hidden
    ) {
      skipAnim.current = false;
      snap();
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      const current = from + (value - from) * easeOut(t);
      displayRef.current = current;
      setDisplay(current);
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);

    // Backgrounding the tab mid-count freezes rAF; land on the target instead.
    const onHide = () => {
      if (document.hidden) {
        if (frame.current) cancelAnimationFrame(frame.current);
        snap();
      }
    };
    document.addEventListener("visibilitychange", onHide);

    return () => {
      document.removeEventListener("visibilitychange", onHide);
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [value]);

  // Transient direction colour.
  useEffect(() => {
    if (value > prevValue.current) setFlash("gain");
    else if (value < prevValue.current) setFlash("loss");
    prevValue.current = value;
    const t = setTimeout(() => setFlash(null), 700);
    return () => clearTimeout(t);
  }, [value]);

  const step = useCallback(
    (pct: number) => {
      const next = Math.max(0, value * (1 + pct / 100));
      onChange(Math.round(next * 100) / 100);
    },
    [value, onChange],
  );

  // `taxPercentage` is basis points PER MONTH, so this needs no time
  // conversion. Off `display` rather than `value`: the whole point is that the
  // bill counts up alongside the price.
  const perMonth = (display * Number(taxBps)) / 10_000;

  // Every step off zero is zero, so the strip would be a control that visibly
  // does nothing. Disabled until there is a price to move.
  const steppable = !disabled && value > 0;

  // Both track `display`, not `value`, so the dollar figure counts up with the
  // token figure instead of snapping ahead of the tween.
  const usdPrice = formatUsd(toUsd?.(display) ?? null);
  const usdPerMonth = formatUsd(toUsd?.(perMonth) ?? null);

  const gain = "text-emerald-600 dark:text-emerald-500";
  const loss = "text-red-600 dark:text-red-500";

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="tabular-nums text-[10px] text-muted-foreground">
          costs{" "}
          <span
            className={cn(
              "transition-colors duration-300",
              flash === "gain" && gain,
              flash === "loss" && loss,
            )}
          >
            {formatNumber(perMonth)}
          </span>{" "}
          {symbol}/mo
          {usdPerMonth && (
            <span className="text-muted-foreground/70"> ({usdPerMonth})</span>
          )}
        </span>
      </div>

      {/* The figure itself — editable in place. */}
      <div className="flex items-baseline gap-1.5">
        <input
          inputMode="decimal"
          disabled={disabled}
          value={raw ?? formatNumber(display)}
          onFocus={() => setRaw(String(value))}
          onBlur={() => setRaw(null)}
          onChange={(e) => {
            setRaw(e.target.value);
            const parsed = Number(normalize(e.target.value));
            if (Number.isFinite(parsed) && parsed >= 0) {
              skipAnim.current = true;
              onChange(parsed);
            }
          }}
          className={cn(
            "tabular-nums min-w-0 flex-1 bg-transparent text-2xl font-bold tracking-tight outline-none transition-colors duration-300 disabled:opacity-40",
            flash === "gain" && gain,
            flash === "loss" && loss,
          )}
        />
        <span className="shrink-0 text-xs font-medium text-muted-foreground">
          {symbol}
        </span>
      </div>

      {usdPrice && (
        <p className="mt-0.5 tabular-nums text-[11px] text-muted-foreground">
          ≈ {usdPrice}
        </p>
      )}

      {hint && (
        <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>
      )}

      {/* One unbroken strip, cuts on the left and raises on the right. Read as
          a single scale rather than two clusters of buttons, and the tint says
          which direction you are moving before you read the number. */}
      <div className="mt-2 flex overflow-hidden border">
        {STEPS.map((p, i) => (
          <StepButton
            key={p}
            disabled={!steppable}
            onClick={() => step(p)}
            tone={p < 0 ? "loss" : "gain"}
            // The turn from cut to raise gets the one real division.
            divider={
              i === 0 ? "none" : p > 0 && STEPS[i - 1] < 0 ? "strong" : "hair"
            }
          >
            {p > 0 ? `+${p}` : `−${Math.abs(p)}`}%
          </StepButton>
        ))}
      </div>
    </div>
  );
}

/** Accept comma decimals and stray separators, as the rest of the app does. */
function normalize(value: string): string {
  return value.replace(/,/g, ".").replace(/\s/g, "");
}

function StepButton({
  children,
  onClick,
  tone,
  divider,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone: "gain" | "loss";
  divider: "none" | "hair" | "strong";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "tabular-nums flex-1 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-40",
        divider === "strong" && "border-l",
        divider === "hair" && "border-l border-border/50",
        tone === "gain"
          ? "bg-emerald-500/[0.07] text-emerald-600 hover:bg-emerald-500/15 dark:text-emerald-500"
          : "bg-red-500/[0.07] text-red-600 hover:bg-red-500/15 dark:text-red-500",
      )}
    >
      {children}
    </button>
  );
}
