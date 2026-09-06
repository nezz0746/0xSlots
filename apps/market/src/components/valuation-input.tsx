"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatUnits, parseUnits } from "viem";

/** Percentage steps, laid out as one continuous scale from cut to raise. */
const STEPS = [-20, -10, -5, 5, 10, 20] as const;
const DURATION = 520;
const HUNDRED = 100n;
const ZERO = 0n;

/** Ease-out cubic: fast off the mark, settling into the target. */
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/**
 * A valuation field that animates between values.
 *
 * Ported from the explorer, where the same control names the same number. The
 * percentage buttons COMPOUND off the current value rather than off the
 * starting one, so repeated taps behave like a market moving rather than a
 * slider with fixed stops. Each change counts the figure from the old value to
 * the new one, which is what makes a compounding step legible: +10% of a
 * moving number is not a constant.
 *
 * Beside the figure sits what the valuation COSTS at this work's rate. That is
 * the Harberger squeeze made visible — every tap of +20% is also a bigger
 * monthly bill, and the two numbers move together.
 *
 * ── The arithmetic is in integers ─────────────────────────────────────────
 *
 * Stepping in JavaScript numbers and rounding to two decimals is safe for a
 * work priced in whole USDC and catastrophic for one priced in ETH: 0.001
 * raised by 10% rounds to 0.00, and the field would then offer a self-assessed
 * price of zero behind a button that assesses at exactly that — which the core
 * refuses outright. Stepping raw units keeps every currency exact, so the
 * caller passes and receives `bigint` and no float ever touches the value.
 */
export function ValuationInput({
  value,
  onChange,
  decimals,
  label,
  taxBps,
  symbol,
  disabled,
  id,
  below,
}: {
  /** Raw units — the currency's own denomination, never a float. */
  value: bigint;
  onChange: (next: bigint) => void;
  decimals: number;
  label: string;
  /** The monthly rate in basis points — what this valuation will cost. */
  taxBps: bigint;
  symbol: string;
  disabled?: boolean;
  id?: string;
  /**
   * Rendered directly beneath the field.
   *
   * For the one fact this input raises and cannot answer: what you actually
   * hold. A balance in a header is a statistic; the same line under the field
   * you are typing a number into is the answer to "can I afford that", at the
   * moment the question occurs.
   *
   * It goes BELOW rather than in the corner, because the corner is taken by
   * what the valuation costs per month — and that figure is the Harberger
   * squeeze made visible. Every tap of +20% is also a bigger monthly bill, and
   * covering it with a balance removed the only place a bidder could see their
   * own rent move.
   */
  below?: React.ReactNode;
}) {
  const asNumber = Number(formatUnits(value, decimals));

  const [display, setDisplay] = useState(asNumber);
  const [raw, setRaw] = useState<string | null>(null);
  const [flash, setFlash] = useState<"gain" | "loss" | null>(null);
  /**
   * Focus, tracked in React rather than left to `focus-within`.
   *
   * The wrapper is what shows focus here — the field inside it suppresses its
   * own ring, so if the wrapper does not light up there is no indicator at
   * all. Both class names are written as literals below so the compiler emits
   * them; a conditional built from fragments is a class Tailwind never sees.
   */
  const [focused, setFocused] = useState(false);

  const displayRef = useRef(asNumber);
  const prevValue = useRef(value);
  /**
   * The value the NEXT step compounds from.
   *
   * `step` closes over `value`, which React only refreshes on re-render — so
   * two taps inside one frame both computed from the same base and the second
   * silently did nothing. Someone tapping +10% quickly to chase a price got
   * one raise for three taps, which is the exact case these buttons exist for.
   */
  const latest = useRef(value);
  const skipAnim = useRef(false);
  const frame = useRef<number | null>(null);

  /**
   * A draft that no longer describes the value is not a draft, it is a lie.
   *
   * `raw` is the string being typed, and clearing it only on blur assumes that
   * anything moving the value from outside also takes focus away. The
   * percentage buttons do not blur the field in Safari, and nor does a caller
   * resetting it. In both cases the value moved, the field went on showing the
   * typed one, and the figure on screen was not the figure that would be
   * signed. So the draft is dropped during render, with no frame showing the
   * stale one. A draft that cannot be parsed at all is kept: that is
   * mid-typing, where the value legitimately reflects the last good keystroke.
   */
  if (raw !== null) {
    const drafted = tryParse(raw, decimals);
    if (drafted !== null && drafted !== value) setRaw(null);
  }

  useEffect(() => {
    const snap = () => {
      displayRef.current = asNumber;
      setDisplay(asNumber);
    };
    const from = displayRef.current;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    // Skip the count while typing, when there is nothing to count, when motion
    // is unwanted, and when the tab is hidden — rAF is paused there, and a
    // tween that never ticks strands the figure on a stale number.
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

  // Outside changes — a poll, a caller reset — rebase the stepper too.
  if (latest.current !== value && raw === null) latest.current = value;

  useEffect(() => {
    if (value > prevValue.current) setFlash("gain");
    else if (value < prevValue.current) setFlash("loss");
    prevValue.current = value;
    const t = setTimeout(() => setFlash(null), 700);
    return () => clearTimeout(t);
  }, [value]);

  const step = useCallback(
    (pct: number) => {
      // Integer maths on raw units: exact at any scale, and a step can never
      // round a live valuation down to nothing.
      const next = (latest.current * BigInt(100 + pct)) / HUNDRED;
      latest.current = next;
      onChange(next);
    },
    [onChange],
  );

  // `taxBps` is basis points PER MONTH, so this needs no time conversion. Off
  // `display` rather than `value`: the point is that the bill counts up
  // alongside the valuation.
  const perMonth = (display * Number(taxBps)) / 10_000;

  // Every step off zero is zero, so the strip would visibly do nothing.
  const steppable = !disabled && value > ZERO;
  const gain = "text-standing";
  const loss = "text-ebbing";

  return (
    <div>
      <div
        className={`border bg-paper transition-colors ${
          focused ? "border-ink" : "border-line"
        }`}
      >
        <div className="flex items-baseline justify-between gap-2 px-2.5 pt-2">
          <label htmlFor={id} className="text-[10px] leading-none text-dim">
            {label}
          </label>
          <span className="text-[10px] leading-none tabular text-dim">
            costs{" "}
            <span
              className={`transition-colors duration-300 ${
                flash === "gain" ? gain : flash === "loss" ? loss : ""
              }`}
            >
              {format(perMonth)}
            </span>{" "}
            {symbol}/mo
          </span>
        </div>

        <div className="flex items-baseline gap-1.5 px-2.5 pb-2">
          <input
            id={id}
            // The box around this whole control takes the focus ring, so the
            // field inside it must not take a second one.
            data-focus-ring="wrapper"
            inputMode="decimal"
            disabled={disabled}
            value={raw ?? format(display)}
            onFocus={() => {
              setFocused(true);
              setRaw(formatUnits(value, decimals));
            }}
            onBlur={() => {
              setFocused(false);
              setRaw(null);
            }}
            onChange={(e) => {
              setRaw(e.target.value);
              const parsed = tryParse(e.target.value, decimals);
              // Mid-typing garbage ("0.", "1e") parses to nothing; keep the last
              // good value rather than fighting the keystroke.
              if (parsed === null) return;
              skipAnim.current = true;
              onChange(parsed);
            }}
            className={`min-w-0 flex-1 bg-transparent text-2xl font-semibold tracking-tight tabular outline-none transition-colors duration-300 disabled:opacity-40 ${
              flash === "gain" ? gain : flash === "loss" ? loss : ""
            }`}
          />
          <span className="shrink-0 text-[11px] text-dim">{symbol}</span>
        </div>

        {/* One unbroken strip, cuts on the left and raises on the right. Read as
          a single scale rather than two clusters of buttons; the one real
          division is the turn from cut to raise. */}
        <div className="flex border-t border-line">
          {STEPS.map((p, i) => (
            <button
              key={p}
              type="button"
              disabled={!steppable}
              onClick={() => step(p)}
              className={`flex-1 py-1.5 text-[11px] tabular transition-colors disabled:opacity-40 ${
                i > 0
                  ? p > 0 && STEPS[i - 1] < 0
                    ? "border-l border-line"
                    : "border-l border-line/50"
                  : ""
              } ${
                p < 0
                  ? "text-ebbing enabled:hover:bg-ebbing/10"
                  : "text-standing enabled:hover:bg-standing/10"
              }`}
            >
              {p > 0 ? `+${p}` : `−${Math.abs(p)}`}%
            </button>
          ))}
        </div>
      </div>
      {below}
    </div>
  );
}

/** Enough precision to be useful, not enough to be noise. */
function format(n: number): string {
  if (n === 0) return "0";
  if (n < 0.0001) return "<0.0001";
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

/**
 * What a typed string means in raw units, or null where it means nothing yet.
 *
 * One definition, because two callers must agree exactly: the keystroke
 * handler, which decides what to send up, and the staleness check, which
 * decides whether what came back down is still the same number. A comma is a
 * decimal point in most of the world and `parseUnits` does not know that.
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
