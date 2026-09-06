"use client";

import { depositFor } from "@0xslots/sdk/slots";

import { Figures } from "@/components/figures";
import { amount, duration } from "@/lib/format";

/**
 * What these terms mean for a minter, priced at a worked example.
 *
 * A rate and a window are two numbers nobody can feel. Run them against a
 * concrete valuation and they become a bill and a deadline — which is what the
 * person filling this form is deciding, and what their minters will read on
 * the collection page. Same three figures, same order, same units as the
 * panels there: a creator and a buyer should be looking at one vocabulary.
 */
const EXAMPLE = 10n ** 18n; // one unit of the currency

export function TermsPreview({
  taxBps,
  minDepositSeconds,
  symbol,
  decimals = 18,
}: {
  taxBps: bigint;
  minDepositSeconds: bigint;
  symbol: string;
  /** The currency's own scale. Not every collection prices in 18 places. */
  decimals?: number;
}) {
  const rent = (EXAMPLE * taxBps) / 10_000n;
  // The SDK's formula, not a third copy: it is pinned against the contract's
  // own output in tests, and a preview quoting a different escrow from the one
  // a minter is charged would be worse than no preview.
  const escrow = depositFor(EXAMPLE, taxBps, minDepositSeconds);
  const at = (v: bigint) => amount(v, decimals, symbol);
  const valid = taxBps > 0n && taxBps <= 10_000n;

  if (!valid)
    return (
      <p className="border-y border-line py-4 text-[12px] text-dim">
        Set a rent between 0 and 100% to see what it costs.
      </p>
    );

  return (
    <div>
      <p className="mb-2 text-[11px] text-dim">
        A mint valued at {at(EXAMPLE)}
      </p>
      <Figures
        items={[
          { label: "They send", value: at(EXAMPLE + escrow), tone: "standing" },
          {
            label: "Rent / mo",
            qualifier: `${Number(taxBps) / 100}%`,
            value: at(rent),
          },
          { label: "Runway", value: duration(Number(minDepositSeconds)) },
        ]}
      />
      <p className="mt-1.5 text-[10px] leading-snug text-dim">
        {at(EXAMPLE)} reaches your recipient, {at(escrow)} is the minter&apos;s
        escrow. Anyone may take the work at their price, any time.
      </p>
    </div>
  );
}
