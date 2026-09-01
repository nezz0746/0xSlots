"use client";

import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { formatUsd } from "@/hooks/use-usd-price";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/utils";

/** Percentage steps, laid out as one continuous scale from cut to raise. */
const STEPS = [-20, -10, -5, 5, 10, 20] as const;
const DURATION = 520;
const HUNDRED = 100n;
const ZERO = 0n;

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
 * Beside the figure sits what the price actually COSTS at this slot's rate.
 * That is the Harberger squeeze made visible: every tap of +20% is also a
 * bigger monthly bill, and the two numbers move together.
 *
 * ── The arithmetic is in integers ────────────────────────────────────────
 *
 * This stepped in JavaScript numbers and rounded each result to two decimals,
 * which is safe for a slot priced in whole USDC and catastrophic for one priced
 * in ETH: 0.001 raised by 10% rounds to 0.00, and the field would then offer a
 * self-assessed price of zero behind a button that assesses at exactly that.
 * Stepping the slot's own raw units keeps every currency exact, so the caller
 * passes and receives `bigint` and no float ever touches the value.
 *
 * ── The steps are folded away ────────────────────────────────────────────
 *
 * A row of six buttons under every field says the typing was the afterthought.
 * Someone who knows what they want to charge types it; the steps are for
 * someone deciding by feel, so they live behind "Adjust" and the control reads
 * as one thing rather than as a caption, a box, a dollar line and a keypad.
 */
export function PriceInput({
  value,
  onChange,
  decimals,
  label,
  taxBps,
  symbol,
  disabled,
  hint,
  toUsd,
}: {
  /** Raw units — the slot's own denomination, never a float. */
  value: bigint;
  onChange: (next: bigint) => void;
  decimals: number;
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
  const asNumber = Number(formatUnits(value, decimals));

  const [display, setDisplay] = useState(asNumber);
  const [raw, setRaw] = useState<string | null>(null);
  const [flash, setFlash] = useState<"gain" | "loss" | null>(null);
  const [open, setOpen] = useState(false);

  const displayRef = useRef(asNumber);
  const prevValue = useRef(value);
  const skipAnim = useRef(false);
  const frame = useRef<number | null>(null);

  /**
   * A draft that no longer describes the value is not a draft, it is a lie.
   *
   * `raw` is the string being typed, and it used to be cleared only on blur —
   * which assumed that anything moving the value from outside would also take
   * focus away from the field. Neither of the two things that do this
   * qualifies: the percentage buttons do not blur it in Safari, where clicking
   * a button leaves focus where it was, and nor does a caller resetting the
   * field to the slot's standing price. In both cases the value moved, the
   * field went on showing the typed one, and the figure on screen was not the
   * figure that would be signed.
   *
   * So the draft is dropped the moment the value stops matching it, during
   * render rather than in an effect, so there is no frame showing the stale
   * one. A draft that cannot be parsed at all is kept: that is mid-typing
   * ("0.", "1e"), where the value legitimately still reflects the last good
   * keystroke.
   */
  if (raw !== null) {
    const drafted = tryParse(raw, decimals);
    if (drafted !== null && drafted !== value) setRaw(null);
  }

  // Count from wherever the figure currently sits to the new value.
  useEffect(() => {
    const snap = () => {
      displayRef.current = asNumber;
      setDisplay(asNumber);
    };

    const from = displayRef.current;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    // Skip the count when typing, when there is nothing to count, when motion
    // is unwanted — and when the tab is hidden, because rAF is paused there and
    // a tween that never ticks would leave the figure stranded on a stale
    // number while the real value has moved on.
    if (skipAnim.current || from === asNumber || reduce || document.hidden) {
      skipAnim.current = false;
      snap();
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      const current = from + (asNumber - from) * easeOut(t);
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
  }, [asNumber]);

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
      // Integer maths on raw units: exact at any decimals, and a step can never
      // round a live price down to nothing.
      onChange((value * BigInt(100 + pct)) / HUNDRED);
    },
    [value, onChange],
  );

  // `taxPercentage` is basis points PER MONTH, so this needs no time
  // conversion. Off `display` rather than `value`: the whole point is that the
  // bill counts up alongside the price.
  const perMonth = (display * Number(taxBps)) / 10_000;

  // Only the monthly cost is shown in dollars. The valuation's own dollar
  // figure sat directly under the field AND again in the buy summary's Purchase
  // row — the same number twice, on a panel that has few lines to spare.
  const usdPerMonth = formatUsd(toUsd?.(perMonth) ?? null);

  // Every step off zero is zero, so the strip would be a control that visibly
  // does nothing. Disabled until there is a price to move.
  const steppable = !disabled && value > ZERO;

  const gain = "text-emerald-600 dark:text-emerald-500";
  const loss = "text-red-600 dark:text-red-500";

  return (
    <div>
      {/* One control, not three stacked ones. The field, what it costs, and the
          ways to move it were a caption, a box, a dollar line, a hint and a row
          of buttons — five bands for one decision. */}
      <div className="border bg-muted/40 transition-colors focus-within:border-primary/50 focus-within:bg-background">
        <div className="flex items-baseline justify-between gap-2 px-2.5 pt-2">
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
        <div className="flex items-baseline gap-1.5 px-2.5 pb-1.5">
          <input
            inputMode="decimal"
            disabled={disabled}
            value={raw ?? formatNumber(display)}
            onFocus={() => setRaw(formatUnits(value, decimals))}
            onBlur={() => setRaw(null)}
            onChange={(e) => {
              setRaw(e.target.value);
              const parsed = tryParse(e.target.value, decimals);
              // Mid-typing garbage ("0.", "1e") parses to nothing; keep the
              // last good value rather than fighting the keystroke.
              if (parsed === null) return;
              skipAnim.current = true;
              onChange(parsed);
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

        {/* One unbroken strip, cuts on the left and raises on the right. Read as
            a single scale rather than two clusters of buttons, and the tint says
            which direction you are moving before you read the number. */}
        {open ? (
          <div className="flex border-t">
            {STEPS.map((p, i) => (
              <StepButton
                key={p}
                disabled={!steppable}
                onClick={() => step(p)}
                tone={p < 0 ? "loss" : "gain"}
                // The turn from cut to raise gets the one real division.
                divider={
                  i === 0
                    ? "none"
                    : p > 0 && STEPS[i - 1] < 0
                      ? "strong"
                      : "hair"
                }
              >
                {p > 0 ? `+${p}` : `−${Math.abs(p)}`}%
              </StepButton>
            ))}
          </div>
        ) : (
          <button
            type="button"
            disabled={!steppable}
            onClick={() => setOpen(true)}
            className="flex w-full items-center justify-center gap-1 border-t py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground transition-colors enabled:hover:bg-muted enabled:hover:text-foreground disabled:opacity-40"
          >
            <ChevronDown className="size-3" aria-hidden />
            Adjust
          </button>
        )}
      </div>

      {/* Under the whole control rather than between the field and its steps,
          where it split one thing into two. */}
      {hint && <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * What a typed string means in raw units, or null where it means nothing yet.
 *
 * One definition because two callers must agree exactly: the keystroke handler,
 * which decides what to send up, and the staleness check, which decides whether
 * what came back down is still the same number. A comma is a decimal point in
 * most of the world and `parseUnits` does not know that.
 */
function tryParse(text: string, decimals: number): bigint | null {
  const cleaned = text.replace(/,/g, ".").replace(/\s/g, "");
  if (!cleaned) return ZERO;
  try {
    const parsed = parseUnits(cleaned, decimals);
    return parsed < ZERO ? null : parsed;
  } catch {
    return null;
  }
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
