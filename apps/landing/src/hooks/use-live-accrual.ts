"use client";

import type { SlotState } from "@0xslots/sdk/slots";
import { BASIS_POINTS, MONTH_SECONDS } from "@0xslots/sdk/slots";
import { useEffect, useRef, useState } from "react";
import { useChainTimeSkew } from "@/hooks/slots/use-slots";
import { useNow } from "@/hooks/use-duration";

/**
 * Tax owed, counted as it accrues rather than as it was last read.
 *
 * `slotState()` returns `taxOwed` as of the block it was read at, and the page
 * refetches on a five-second timer — so a slot quietly accruing all afternoon
 * showed the same four figures between polls, and the panel looked broken
 * rather than idle. The runway to liquidation was the worst of them: a
 * countdown that does not count down.
 *
 * ── Why this does not poll the chain ─────────────────────────────────────
 *
 * Because it does not have to. `taxOwed()` is a pure function of the block
 * timestamp:
 *
 *   price * taxBps * (now - lastSettled) / (MONTH * BASIS_POINTS)
 *
 * so the same arithmetic run in the browser reproduces it exactly, for free and
 * for any instant. The formula is UNCHANGED under the hook-based protocol —
 * `Slot.taxOwed()` is still `Math.mulDiv(price, taxBps * elapsed, MONTH *
 * BASIS_POINTS)` — so what needed porting here was the shape of the input, not
 * a line of the mathematics.
 *
 * What actually needs reading is the *anchor* — price, tax rate, deposit,
 * `lastSettled` — and that only changes when the slot settles, which happens on
 * a buy, a top-up, a reprice, a collect or a liquidation. A two-second network
 * poll would be a request every two seconds to be told the same four numbers,
 * and public RPCs start refusing at that rate.
 *
 * So the anchor is whatever `useSlotState` last read, and the figure is
 * interpolated locally from it. The only thing this needs the network for is
 * the chain's own clock — see {@link useChainTimeSkew} — because the anchor is
 * a `block.timestamp` and counting it against a browser clock measures the gap
 * between two clocks rather than elapsed time.
 *
 * ── The cap is not a detail ─────────────────────────────────────────────
 *
 * `taxOwed()` keeps counting past the deposit, but `_settle` only ever takes
 * `min(owed, deposit)` — past that the slot is insolvent and liquidatable, and
 * the extra was never owed to anybody. Uncapped, this would show a slot paying
 * rent it had already stopped being able to pay.
 */

const ZERO = 0n;

/**
 * "Cannot run dry", as the chain reports it.
 *
 * `Slot.secondsUntilLiquidation()` returns `type(uint256).max` for an occupant
 * whose deposit outlives the arithmetic, and callers already threshold on it —
 * so the interpolation uses the same sentinel rather than inventing a second
 * convention for the same fact.
 */
const NEVER = 2n ** 256n - 1n;

/**
 * How often the figure is recomputed. Local arithmetic, so the cost is a render
 * rather than a request.
 *
 * At a typical slot's terms one micro-unit accrues every few seconds, so two
 * seconds is comfortably finer than the smallest movement the currency can
 * express — the figure is never seen skipping a step.
 */
const TICK_MS = 2000;

export type LiveAccrual = {
  /** Accrued since `lastSettled`, capped at the deposit. */
  taxOwed: bigint;
  /** Deposit less what has accrued — what the occupant would get back. */
  remaining: bigint;
  /** How long the remaining deposit lasts at the current rate. */
  secondsUntilLiquidation: bigint;
  insolvent: boolean;
  /** True for a beat after the tax figure moves, for the flash. */
  rising: boolean;
  /**
   * Whether the figures above are being interpolated at all.
   *
   * False for a vacant slot and before the first tick, where they are the
   * chain's own numbers passed straight through. A caller showing a "live"
   * affordance reads this rather than assuming, so the label never claims to be
   * counting when it is not.
   */
  live: boolean;
};

/**
 * @param state The last on-chain read. Its own figures are returned untouched
 *   until the clock has ticked once, so the first paint matches the chain.
 * @param enabled Off for a vacant slot, which accrues nothing and should not
 *   re-render on a timer.
 */
export function useLiveAccrual(
  state: SlotState | null | undefined,
  enabled = true,
): LiveAccrual {
  const slot = state ?? null;
  const live = enabled && !!slot && !slot.isVacant;
  const wallNow = useNow(live, TICK_MS);
  // Count in the CHAIN's clock, not this machine's. `lastSettled` is a
  // `block.timestamp`, so subtracting a wall-clock reading from it measures the
  // gap between two different clocks rather than elapsed time — which on a
  // time-warped dev chain, or a user whose system clock is off, is wrong by
  // exactly that skew.
  const skew = useChainTimeSkew();
  const now = wallNow + skew;

  const empty: LiveAccrual = {
    taxOwed: slot?.taxOwed ?? ZERO,
    remaining: slot ? max(slot.deposit - slot.taxOwed, ZERO) : ZERO,
    secondsUntilLiquidation: slot?.secondsUntilLiquidation ?? ZERO,
    insolvent: slot?.isInsolvent ?? false,
    rising: false,
    live: false,
  };

  const perMonth = slot ? slot.price * slot.taxBps : ZERO;
  const nowSec = BigInt(now);

  // Computed before the early return so the flash hook is called unconditionally.
  const elapsed =
    slot && nowSec > slot.lastSettled ? nowSec - slot.lastSettled : ZERO;
  const interpolated = slot
    ? (perMonth * elapsed) / (MONTH_SECONDS * BASIS_POINTS)
    : ZERO;

  /**
   * Never behind the chain's own last answer.
   *
   * The skew correction above handles the clocks; this handles everything
   * else — a stale skew reading, a settlement landing between polls, integer
   * truncation at the boundary.
   *
   * The residual error is only dangerous in one direction, and this is it:
   * under-report the tax and the runway is overstated, so a slot the chain will
   * already let anyone evict is drawn as comfortably solvent. `taxOwed` only
   * ever rises between settlements, so taking the larger of the two is both
   * safe and correct — the read is a floor, and the interpolation may only move
   * forward from it.
   */
  const owed = slot ? min(max(interpolated, slot.taxOwed), slot.deposit) : ZERO;

  const rising = useRise(live ? owed : null);

  if (!live || !slot) return empty;

  const remaining = slot.deposit - owed;

  // The inverse of the accrual: how many seconds of runway `remaining` buys at
  // the same rate. Zero rate means the slot never falls over, and dividing by it
  // would throw rather than say so.
  //
  // NEVER rather than zero in that case, matching what the chain's own
  // `secondsUntilLiquidation` returns. Zero is the sentinel for "liquidatable
  // right now" — the exact opposite reading — so a slot that can never fall over
  // would announce itself as already fallen.
  const localRunway =
    perMonth > ZERO
      ? (remaining * MONTH_SECONDS * BASIS_POINTS) / perMonth
      : NEVER;

  // Clamped to the chain's own answer for the same reason the tax is: the
  // runway only ever shrinks between settlements, so a local figure LONGER than
  // the one that was read is clock skew, not news.
  const secondsUntilLiquidation = min(
    localRunway,
    slot.secondsUntilLiquidation,
  );

  return {
    taxOwed: owed,
    remaining,
    secondsUntilLiquidation,
    // Insolvency is reached exactly when the accrual has eaten the deposit, so
    // it is read from the interpolation — that is what lets a slot tipping over
    // while the page is open say so without a refetch. The chain's own flag is
    // OR-ed in rather than replaced: it is authoritative as of the read, and a
    // page must never draw as solvent something the chain will already evict.
    insolvent: remaining <= ZERO || slot.isInsolvent,
    rising,
    live: true,
  };
}

const min = (a: bigint, b: bigint) => (a < b ? a : b);
const max = (a: bigint, b: bigint) => (a > b ? a : b);

/**
 * True for a beat after the value goes up.
 *
 * Only upward: this figure drops to zero when the slot settles, and flashing the
 * same colour for tax accruing and tax being collected would say nothing.
 */
function useRise(value: bigint | null): boolean {
  const previous = useRef<bigint | null>(null);
  const [rising, setRising] = useState(false);

  useEffect(() => {
    if (value == null) return;

    const rose = previous.current != null && value > previous.current;
    previous.current = value;
    if (!rose) return;

    setRising(true);
    const id = setTimeout(() => setRising(false), 800);
    return () => clearTimeout(id);
  }, [value]);

  return rising;
}
