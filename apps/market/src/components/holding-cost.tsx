"use client";

import { amount, duration } from "@/lib/format";

/**
 * What a slot is worth, what it costs, and how long it survives.
 *
 * The same six derived figures the explorer shows, in the same order and for
 * the same reason: the reader's question is "what does holding this cost me",
 * and answering it from raw fields means doing arithmetic across the page.
 *
 * Read across, the rows are a sentence. Top: worth X, so it costs Y a month, so
 * it lasts Z. Bottom: the money behind it — posted, spent, left. `Escrow left`
 * divided by `Rent / month` IS the runway, so the grid shows its own working.
 *
 * Ported rather than imported: the two apps do not share a component library,
 * and a marketplace that computed rent differently from the explorer would be
 * quoting a different number for the same slot.
 */
export function HoldingCost({
  price,
  taxBps,
  symbol,
  deposit,
  taxOwed,
  escrowLeft,
  secondsUntilLiquidation,
  isVacant,
  isInsolvent,
  minDepositSeconds,
}: {
  price: bigint;
  taxBps: bigint;
  symbol: string;
  deposit: bigint;
  taxOwed: bigint;
  escrowLeft: bigint;
  secondsUntilLiquidation: bigint;
  isVacant: boolean;
  isInsolvent: boolean;
  minDepositSeconds?: bigint;
}) {
  // The contract's own formula: basis points of the declared price per 30 days.
  // Integer arithmetic, so this cannot drift from `SlotMath.taxFor`.
  const rentPerMonth = (price * taxBps) / 10_000n;
  const runway = describeRunway(secondsUntilLiquidation, isVacant, isInsolvent);
  const dash = "—";
  const at = (v: bigint) => amount(v, 18, symbol);

  return (
    <dl className="grid grid-cols-3 gap-px border border-line bg-line">
      <Figure label="Valuation" value={isVacant ? dash : at(price)} />
      <Figure
        label="Rent / month"
        qualifier={`${Number(taxBps) / 100}%`}
        value={isVacant ? dash : at(rentPerMonth)}
      />
      <Figure
        label="Runway"
        value={runway.value}
        tone={runway.tone}
        foot={
          minDepositSeconds && minDepositSeconds > 0n
            ? `min ${duration(Number(minDepositSeconds))}`
            : undefined
        }
      />
      <Figure label="Deposit" value={isVacant ? dash : at(deposit)} small />
      <Figure label="Tax owed" value={isVacant ? dash : at(taxOwed)} small />
      <Figure
        label="Escrow left"
        qualifier="deposit − tax"
        value={isVacant ? dash : at(escrowLeft)}
        tone={isInsolvent ? "gone" : "plain"}
        small
      />
    </dl>
  );
}

/** A label and a figure. Two lines, never three. */
function Figure({
  label,
  qualifier,
  value,
  tone = "plain",
  foot,
  small,
}: {
  label: string;
  qualifier?: string;
  value: string;
  tone?: "plain" | "warn" | "gone";
  foot?: string;
  small?: boolean;
}) {
  return (
    <div className="bg-lift px-3 py-3">
      <dt className="text-[11px] leading-tight text-dim">
        {label}
        {qualifier ? (
          <span className="ml-1 normal-case tracking-normal opacity-60">
            ({qualifier})
          </span>
        ) : null}
      </dt>
      <dd
        className={`mt-1.5 font-semibold leading-none tabular ${
          small ? "text-[13px]" : "text-base"
        } ${
          tone === "warn" ? "text-waning" : tone === "gone" ? "text-ebbing" : ""
        }`}
      >
        {value}
      </dd>
      {foot ? (
        <dd className="mt-1 text-[10px] leading-none tabular text-dim">
          {foot}
        </dd>
      ) : null}
    </div>
  );
}

/** Past two months, days stop being the unit anyone reads. */
const LONG = 60n * 24n * 60n * 60n;
const SHORT = 7n * 24n * 60n * 60n;
const DAY = 24n * 60n * 60n;

function describeRunway(
  seconds: bigint,
  isVacant: boolean,
  isInsolvent: boolean,
): { value: string; tone: "plain" | "warn" | "gone" } {
  if (isVacant) return { value: "—", tone: "plain" };
  if (isInsolvent) return { value: "none", tone: "gone" };
  // `2^256 - 1` when the deposit outlives the arithmetic. Printing that in days
  // would be absurd; printing 0 is worse.
  if (seconds > LONG * 12n) return { value: "∞", tone: "plain" };

  const days = Number(seconds / DAY);
  if (days < 1) {
    const hours = Number(seconds / 3600n);
    return { value: hours < 1 ? "< 1h" : `${hours}h`, tone: "gone" };
  }
  return { value: `${days}d`, tone: seconds < SHORT ? "warn" : "plain" };
}
