"use client";

import { cn } from "@/lib/utils";
import { formatBalance, formatBps, formatDuration } from "@/utils";

/**
 * What this slot is worth, what it costs, and how long it survives.
 *
 * Six derived figures, of which the chain stores two. The reader's question is
 * "what does holding this cost me", and answering it used to mean doing
 * arithmetic across six sections: find the price, find the rate, multiply, find
 * the deposit, subtract the accrued tax, divide. Every input was on the page and
 * the answer was on none of it.
 *
 * Read across, the rows are a sentence. Top: worth X, so it costs Y a month, so
 * it lasts Z. Bottom: the money behind it — posted, spent, left. `Escrow left`
 * divided by `Rent / month` IS the runway, so the grid shows its own working —
 * which is the whole reason "net balance" was unreadable as a lone row.
 *
 * Runway and escrow-left are the only cells allowed colour, and only when short.
 * A strip where everything is tinted has no way left to say "this one matters".
 */
export function HoldingCost({
  price,
  taxBps,
  decimals,
  symbol,
  deposit,
  taxOwed,
  escrowLeft,
  secondsUntilLiquidation,
  isVacant,
  isInsolvent,
  rising,
  minDepositSeconds,
  minDeposit,
  taxLock,
  className,
}: {
  price: bigint;
  /** The slot's monthly rate in basis points. */
  taxBps: bigint;
  decimals: number;
  symbol: string;
  /** Escrow posted by the occupant. */
  deposit: bigint;
  /** Tax accrued against it and not yet settled. */
  taxOwed: bigint;
  /** `deposit - taxOwed`, floored at zero. What the runway is computed from. */
  escrowLeft: bigint;
  /** `2^256 - 1` when the escrow can outlive the arithmetic. */
  secondsUntilLiquidation: bigint;
  isVacant: boolean;
  isInsolvent: boolean;
  /** Tints the accruing figure for a beat each time it moves. */
  rising?: boolean;
  /** The runway a buy must fund. Zero means the slot demands no minimum. */
  minDepositSeconds: bigint;
  /** That runway priced at the CURRENT valuation. */
  minDeposit: bigint;
  /**
   * The tax rate's lock chip. Passed in rather than derived, so this component
   * keeps knowing only about money and nothing about who may change it.
   */
  taxLock?: React.ReactNode;
  className?: string;
}) {
  // The contract's own formula: basis points of the declared price per 30 days.
  // Integer arithmetic, so this cannot drift from `SlotMath.taxFor`.
  const rentPerMonth = (price * taxBps) / 10_000n;
  const runway = describeRunway(secondsUntilLiquidation, isVacant, isInsolvent);
  const amount = (v: bigint) => `${formatBalance(v, decimals)} ${symbol}`;
  const dash = "—";

  return (
    <dl
      className={cn(
        "grid grid-cols-3 border-y",
        "divide-x divide-y divide-border [&>*:nth-child(-n+3)]:border-t-0",
        className,
      )}
    >
      <Figure label="Valuation" value={isVacant ? dash : amount(price)} />
      <Figure
        label="Rent / month"
        qualifier={formatBps(Number(taxBps))}
        badge={taxLock}
        value={isVacant ? dash : amount(rentPerMonth)}
      />
      {/* The two minimums footnote the cells they constrain rather than sitting
          in a list below. `minDepositSeconds` IS a floor on the runway, and the
          deposit it prices is a floor on the deposit — as their own rows they
          read as two more unrelated figures, and the reader had to work out
          which of the six they bounded. */}
      <Figure
        label="Runway"
        value={runway.value}
        tone={runway.tone}
        foot={
          minDepositSeconds > 0n
            ? `min ${formatDuration(Number(minDepositSeconds))}`
            : undefined
        }
      />

      <Figure
        label="Deposit"
        value={isVacant ? dash : amount(deposit)}
        // Hidden while vacant. `minDeposit` is the floor priced at the CURRENT
        // valuation, and a vacant slot has none — so it renders "min 0 ETH",
        // which reads as "free" when in fact the next buyer sets the price and
        // the floor follows it. The buy form computes it from their input.
        foot={
          !isVacant && minDepositSeconds > 0n
            ? `min ${amount(minDeposit)}`
            : undefined
        }
        small
      />
      <Figure
        label="Tax owed"
        value={isVacant ? dash : amount(taxOwed)}
        tone={rising ? "up" : "plain"}
        small
      />
      <Figure
        label="Escrow left"
        qualifier="deposit − tax"
        value={isVacant ? dash : amount(escrowLeft)}
        tone={isInsolvent ? "gone" : "plain"}
        small
      />
    </dl>
  );
}

/**
 * A label and a figure. Two lines, never three.
 *
 * The qualifier rides IN the label — "Rent / month (3%)" — rather than sitting
 * under the number as a caption. As a third line it gave two of six cells an
 * extra row and left the grid ragged; in the label it reads as part of the name
 * of the thing, which is what it is.
 */
function Figure({
  label,
  qualifier,
  badge,
  value,
  tone = "plain",
  foot,
  small,
}: {
  label: string;
  qualifier?: string;
  /** Rides in the label, after the qualifier — a lock chip, typically. */
  badge?: React.ReactNode;
  value: string;
  tone?: "plain" | "warn" | "gone" | "up";
  /** A constraint on this figure, under it. Quiet by design: a floor is not a
   *  reading, and tinting or sizing it up would let it compete with one. */
  foot?: React.ReactNode;
  small?: boolean;
}) {
  return (
    <div className="px-3 py-2.5 sm:px-4">
      {/* No `truncate`: the label carries the rate — "Rent / month (5%)" — and
          with a lock chip beside it the percentage was the part that got cut,
          which is the one number in the label anybody needs. It wraps instead.
          Same fix rescues "Escrow left (deposit − tax)". */}
      <dt className="flex items-start gap-1 text-[10px] font-medium uppercase leading-tight tracking-[0.14em] text-muted-foreground">
        <span>
          {label}
          {qualifier ? (
            <span className="ml-1 normal-case tracking-normal opacity-60">
              ({qualifier})
            </span>
          ) : null}
        </span>
        {badge}
      </dt>
      <dd
        className={cn(
          "mt-1.5 font-semibold leading-none tabular-nums transition-colors duration-500",
          small ? "text-sm" : "text-xl sm:text-2xl",
          tone === "warn" && "text-amber-600 dark:text-amber-400",
          tone === "gone" && "text-destructive",
          tone === "up" && "text-emerald-600 dark:text-emerald-500",
        )}
      >
        {value}
      </dd>
      {foot ? (
        <dd className="mt-1 text-[10px] leading-none tabular-nums text-muted-foreground">
          {foot}
        </dd>
      ) : null}
    </div>
  );
}

/** Past two months, days stop being the unit anyone reads. */
const LONG = 60n * 24n * 60n * 60n;
/** A week. Below this the figure earns its colour. */
const SHORT = 7n * 24n * 60n * 60n;
const DAY = 24n * 60n * 60n;

/**
 * The runway in days, and how alarmed to be about it.
 *
 * Days rather than `formatDuration`'s "3d 4h": this cell exists to be compared,
 * against the rent beside it and against the same figure on another slot, and a
 * mixed-unit string can be neither scanned nor ranked.
 */
function describeRunway(
  seconds: bigint,
  isVacant: boolean,
  isInsolvent: boolean,
): { value: string; tone: "plain" | "warn" | "gone" } {
  if (isVacant) return { value: "—", tone: "plain" };
  if (isInsolvent) return { value: "none", tone: "gone" };

  // `secondsUntilLiquidation` is `2^256 - 1` when the deposit outlives the
  // arithmetic. Printing that in days would be absurd; printing 0 is worse.
  if (seconds > LONG * 12n) return { value: "∞", tone: "plain" };

  const days = Number(seconds / DAY);
  if (days < 1) {
    const hours = Number(seconds / 3600n);
    return {
      value: hours < 1 ? "< 1h" : `${hours}h`,
      tone: "gone",
    };
  }
  return { value: `${days}d`, tone: seconds < SHORT ? "warn" : "plain" };
}
