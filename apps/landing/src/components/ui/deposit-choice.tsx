"use client";

import { cn } from "@/lib/utils";
import { formatBalance, formatDuration } from "@/utils";

/**
 * Deposit as runway, not as a number.
 *
 * A free amount field asks the wrong question: what matters is how long the
 * slot stays funded, and the answer is always a multiple of the slot's own
 * minimum deposit window. So the choice is ×1/×2/×3 of that window, each
 * labelled with the runway it buys and what it costs at the current price.
 * ×1 is exactly the contract's minimum, so the cheapest option is never one
 * the chain will reject.
 */
export function DepositChoice({
  label,
  base,
  mult,
  onPick,
  amountFor,
  decimals,
  symbol,
  disabled,
  note,
}: {
  label: string;
  /** The slot's `minDepositSeconds` — the unit every option is a multiple of. */
  base: bigint;
  mult: number;
  onPick: (m: number) => void;
  amountFor: (m: number) => bigint;
  decimals: number;
  symbol: string;
  disabled?: boolean;
  /** Why these numbers might not match the rate shown elsewhere on the slot. */
  note?: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="text-[10px] text-muted-foreground">
          min {formatDuration(Number(base))}
        </span>
      </div>
      {note && (
        <p className="-mt-1 mb-2 text-[10px] text-amber-600 dark:text-amber-500">
          {note}
        </p>
      )}
      {/* One box divided by hairlines rather than three boxes with air between
          them: these are three settings of a single control, not three
          buttons, and the gaps were saying otherwise. */}
      <div className="flex overflow-hidden border">
        {[1, 2, 3].map((m, i) => {
          const on = m === mult;
          return (
            <button
              key={m}
              type="button"
              disabled={disabled}
              onClick={() => onPick(m)}
              className={cn(
                "flex-1 px-1 py-1.5 text-center transition-colors disabled:opacity-40",
                i > 0 && "border-l",
                on ? "bg-primary/10" : "hover:bg-accent",
              )}
            >
              <div
                className={cn(
                  "text-[10px] uppercase tracking-wider",
                  on ? "text-primary" : "text-muted-foreground",
                )}
              >
                ×{m}
              </div>
              <div className="text-sm font-semibold">
                {formatDuration(Number(base) * m)}
              </div>
              <div className="tabular-nums text-[11px] text-muted-foreground">
                {formatBalance(amountFor(m), decimals)} {symbol}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
