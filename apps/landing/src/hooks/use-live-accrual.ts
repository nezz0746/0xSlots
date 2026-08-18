"use client";

import { useEffect, useRef, useState } from "react";
import { MONTH_SECONDS } from "@/constants";
import { useNow } from "@/hooks/use-duration";
import type { SlotOnChain } from "@/hooks/use-slot-onchain";

/**
 * Tax owed, counted as it accrues rather than as it was last read.
 *
 * `getSlotInfo()` returns `taxOwed` as of the block it was read at, and this app
 * refetches only on demand — so a slot quietly accruing all afternoon showed the
 * same four figures all afternoon, and the panel looked broken rather than idle.
 * The runway to liquidation was the worst of them: a countdown that does not
 * count down.
 *
 * ── Why this does not poll the chain ─────────────────────────────────────
 *
 * Because it does not have to. `taxOwed()` is a pure function of the block
 * timestamp:
 *
 *   price * taxPercentage * (now - lastSettled) / (MONTH * BASIS_POINTS)
 *
 * so the same arithmetic run in the browser reproduces it exactly, for free and
 * for any instant. What actually needs reading is the *anchor* — price, tax
 * rate, deposit, `lastSettled` — and that only changes when the slot settles,
 * which happens on a buy, a top-up, a reprice, a collect or a liquidation. A
 * two-second network poll would be a request every two seconds to be told the
 * same four numbers, and public RPCs start refusing at that rate.
 *
 * So the anchor is whatever `useSlotOnChain` last read, and the figure is
 * interpolated locally from it. Nothing here touches the network.
 *
 * ── The cap is not a detail ─────────────────────────────────────────────
 *
 * `taxOwed()` keeps counting past the deposit, but `_settle` only ever takes
 * `min(owed, deposit)` — past that the slot is insolvent and liquidatable, and
 * the extra was never owed to anybody. Uncapped, this would show a slot paying
 * rent it had already stopped being able to pay.
 */

const BASIS_POINTS = 10_000n;
const ZERO = 0n;

/**
 * How often the figure is recomputed. Local arithmetic, so the cost is a render
 * rather than a request.
 *
 * At a typical slot's terms one micro-USDC accrues every few seconds, so two
 * seconds is comfortably finer than the smallest movement the token can
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
};

/**
 * @param slot The last on-chain read. Its own figures are returned untouched
 *   until the clock has ticked once, so the first paint matches the chain.
 * @param enabled Off for a vacant slot, which accrues nothing and should not
 *   re-render on a timer.
 */
export function useLiveAccrual(
  slot: SlotOnChain | null,
  enabled = true,
): LiveAccrual {
  const live = enabled && !!slot && slot.occupant !== null;
  const now = useNow(live, TICK_MS);

  const empty: LiveAccrual = {
    taxOwed: slot?.taxOwed ?? ZERO,
    remaining: slot ? max(slot.deposit - slot.taxOwed, ZERO) : ZERO,
    secondsUntilLiquidation: slot?.secondsUntilLiquidation ?? ZERO,
    insolvent: slot?.insolvent ?? false,
    rising: false,
  };

  const perMonth = slot ? slot.price * slot.taxPercentage : ZERO;
  const nowSec = BigInt(now);

  // Computed before the early return so the flash hook is called unconditionally.
  const elapsed =
    slot && nowSec > slot.lastSettled ? nowSec - slot.lastSettled : ZERO;
  const uncapped = slot
    ? (perMonth * elapsed) / (MONTH_SECONDS * BASIS_POINTS)
    : ZERO;
  const owed = slot ? min(uncapped, slot.deposit) : ZERO;

  const rising = useRise(live ? owed : null);

  if (!live || !slot) return empty;

  const remaining = slot.deposit - owed;

  // The inverse of the accrual: how many seconds of runway `remaining` buys at
  // the same rate. Zero rate means the slot never falls over, and dividing by it
  // would throw rather than say so.
  const secondsUntilLiquidation =
    perMonth > ZERO
      ? (remaining * MONTH_SECONDS * BASIS_POINTS) / perMonth
      : ZERO;

  return {
    taxOwed: owed,
    remaining,
    secondsUntilLiquidation,
    // Insolvency is reached exactly when the accrual has eaten the deposit. Read
    // from the interpolation rather than from the snapshot, so a slot that tips
    // over while the page is open says so without a refetch.
    insolvent: remaining <= ZERO,
    rising,
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
