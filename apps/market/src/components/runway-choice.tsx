"use client";

import { amount, duration } from "@/lib/format";

/**
 * Escrow as runway, not as an amount.
 *
 * Ported from the explorer. A free amount field asks the wrong question: what
 * matters is how long the work stays funded, and the answer is always a
 * multiple of the collection's own minimum window. So the choice is ×1/×2/×3
 * of that window, each labelled with the runway it buys and what it costs at
 * the valuation currently named. ×1 is exactly the contract's minimum, so the
 * cheapest option is never one the chain will reject.
 *
 * Only a buy offers this. A mint's escrow is whatever the collection's terms
 * make it — `_seat` asks the slot for `minDepositForBuy` and passes that — so
 * a minter has one runway and no choice about it.
 */
export function RunwayChoice({
  base,
  mult,
  onPick,
  amountFor,
  decimals,
  symbol,
  disabled,
}: {
  /** The work's `minDepositSeconds` — the unit every option multiplies. */
  base: bigint;
  mult: number;
  onPick: (m: number) => void;
  amountFor: (m: number) => bigint;
  decimals: number;
  symbol: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[10px] leading-none text-dim">Escrow</span>
        <span className="text-[10px] leading-none text-dim">
          min {duration(Number(base))}
        </span>
      </div>
      {/* One box divided by hairlines rather than three boxes with air between
          them: these are three settings of a single control, not three
          buttons, and the gaps were saying otherwise. */}
      <div className="flex border border-line">
        {[1, 2, 3].map((m, i) => {
          const on = m === mult;
          return (
            <button
              key={m}
              type="button"
              disabled={disabled}
              onClick={() => onPick(m)}
              className={`flex-1 px-1 py-1.5 text-center transition-colors disabled:opacity-40 ${
                i > 0 ? "border-l border-line" : ""
              } ${on ? "bg-standing text-paper" : "enabled:hover:bg-lift"}`}
            >
              <div
                className={`text-[10px] leading-none ${on ? "text-paper/70" : "text-dim"}`}
              >
                ×{m}
              </div>
              <div className="mt-1 text-[13px] font-medium leading-none">
                {duration(Number(base) * m)}
              </div>
              <div
                className={`mt-1 text-[10px] leading-none tabular ${on ? "text-paper/70" : "text-dim"}`}
              >
                {amount(amountFor(m), decimals, symbol)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
