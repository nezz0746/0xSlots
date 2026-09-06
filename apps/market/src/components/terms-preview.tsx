"use client";

import { depositFor } from "@0xslots/sdk/slots";

import { amount, duration } from "@/lib/format";

/**
 * What these terms mean for a minter, priced at a worked example.
 *
 * A tax rate and a window are two numbers nobody can feel. Run them against a
 * concrete valuation and they become a bill and a deadline — which is what the
 * person filling this form is actually deciding, and what their minters will
 * read on the collection page.
 *
 * Same grid, same order, same units as {@link HoldingCost} and
 * {@link WhatItCostsYou}: a creator and a buyer should be looking at one
 * vocabulary, not three.
 */
const EXAMPLE = 10n ** 18n; // one unit of the currency

export function TermsPreview({
  taxBps,
  minDepositSeconds,
  symbol,
}: {
  taxBps: bigint;
  minDepositSeconds: bigint;
  symbol: string;
}) {
  const rent = (EXAMPLE * taxBps) / 10_000n;
  // The SDK's, not a third copy: it is pinned against the contract's own output
  // in tests, and a preview that quoted a different escrow from the one a
  // minter is charged would be worse than no preview.
  const escrow = depositFor(EXAMPLE, taxBps, minDepositSeconds);

  const at = (v: bigint) => amount(v, 18, symbol);
  const valid = taxBps > 0n && taxBps <= 10_000n;

  return (
    <div>
      <p className="mb-2 text-xs text-dim">A mint valued at {at(EXAMPLE)}</p>

      {valid ? (
        <dl className="grid grid-cols-3 gap-px border border-line bg-line">
          <Cell label="Price" value={at(EXAMPLE)} foot="to you" />
          <Cell
            label="Rent / month"
            qualifier={`${Number(taxBps) / 100}%`}
            value={at(rent)}
          />
          <Cell label="Runway" value={duration(Number(minDepositSeconds))} />
          <Cell label="Escrow" value={at(escrow)} small foot="the minter's" />
          <Cell
            label="Total"
            value={at(EXAMPLE + escrow)}
            small
            foot="they send"
          />
          <Cell
            label="Buyout"
            value={at(EXAMPLE)}
            small
            foot="anyone, any time"
          />
        </dl>
      ) : (
        <p className="border border-line px-3 py-2 text-xs text-dim">
          Set a rent between 0 and 100% to see what it costs.
        </p>
      )}
    </div>
  );
}

function Cell({
  label,
  qualifier,
  value,
  foot,
  small,
}: {
  label: string;
  qualifier?: string;
  value: string;
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
        }`}
      >
        {value}
      </dd>
      {foot && (
        <dd className="mt-1 text-[10px] leading-none text-dim">{foot}</dd>
      )}
    </div>
  );
}
