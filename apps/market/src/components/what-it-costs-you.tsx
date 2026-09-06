"use client";

import { amount, duration } from "@/lib/format";

/**
 * The same grid, for a valuation that does not exist yet.
 *
 * {@link HoldingCost} answers "what is this costing its holder". This answers
 * "what would it cost ME", from the number being typed — and it is the same
 * three figures in the same order, because the reader is comparing them.
 *
 * Every value is derived from one input rather than read back: a quote per
 * keystroke would be an RPC round trip per keystroke, and the arithmetic is the
 * contract's own. What IS read is the deposit, which the slot computes and this
 * only displays.
 */
export function WhatItCostsYou({
  valuation,
  taxBps,
  deposit,
  minDepositSeconds,
  symbol,
  /** The premium a mid-window buyout demands, when a tenure hook is attached. */
  buyoutPremium,
}: {
  valuation: bigint;
  taxBps: bigint;
  deposit: bigint;
  minDepositSeconds: bigint;
  symbol: string;
  buyoutPremium?: bigint;
}) {
  const rentPerMonth = (valuation * taxBps) / 10_000n;
  const at = (v: bigint) => amount(v, 18, symbol);

  return (
    <dl className="grid grid-cols-3 gap-px border border-line bg-line">
      <Cell label="Your valuation" value={at(valuation)} />
      <Cell
        label="Rent / month"
        qualifier={`${Number(taxBps) / 100}%`}
        value={at(rentPerMonth)}
      />
      {/* The escrow buys exactly the window it is the minimum for — so this is
          `minDepositSeconds`, not a division. Stated rather than computed,
          because computing it would invite the two to disagree. */}
      <Cell label="Runway" value={duration(Number(minDepositSeconds))} />

      <Cell label="Escrow" value={at(deposit)} small foot="yours, refundable" />
      <Cell label="Price" value={at(valuation)} small foot="paid out" />
      <Cell label="Total" value={at(valuation + deposit)} small emphasis />

      {buyoutPremium !== undefined && buyoutPremium > 0n && (
        <div className="col-span-3 bg-lift px-3 py-2.5 text-[11px] leading-snug text-waning">
          Inside its window, taking this slot early costs a buyer at least{" "}
          <span className="tabular font-medium">{at(buyoutPremium)}</span> — ten
          times the holder&apos;s own price.
        </div>
      )}
    </dl>
  );
}

function Cell({
  label,
  qualifier,
  value,
  foot,
  small,
  emphasis,
}: {
  label: string;
  qualifier?: string;
  value: string;
  foot?: string;
  small?: boolean;
  emphasis?: boolean;
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
        } ${emphasis ? "underline decoration-2 underline-offset-4" : ""}`}
      >
        {value}
      </dd>
      {foot ? (
        <dd className="mt-1 text-[10px] leading-none text-dim">{foot}</dd>
      ) : null}
    </div>
  );
}
