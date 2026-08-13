"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { type Address, formatUnits } from "viem";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { DepositChoice } from "@/components/ui/deposit-choice";
import { PriceInput } from "@/components/ui/price-input";
import { MONTH_SECONDS } from "@/constants";
import { useChain } from "@/context/chain";
import { useSlotAction } from "@/hooks/use-slot-action";
import type { SlotOnChain } from "@/hooks/use-slot-onchain";
import { formatUsd, useUsdPrice } from "@/hooks/use-usd-price";
import { formatBalance, formatBps, toRawUnits } from "@/utils";

/** Fallback runway unit for a slot that sets no minimum. */
const WEEK = 604_800n;

export function BuySection({
  slot,
  slotAddress,
  isOccupied,
}: {
  slot: SlotOnChain;
  slotAddress: string;
  isOccupied: boolean;
}) {
  const decimals = slot.currencyDecimals ?? 6;
  const symbol = slot.currencySymbol ?? "USDC";
  const { buy, selfAssess, busy } = useSlotAction();
  const { address } = useAccount();
  const { chainId } = useChain();

  // Base only — see the hook. `toUsd` returns null everywhere else, and every
  // consumer renders nothing rather than a misleading zero.
  const { toUsd } = useUsdPrice(slot.currency, chainId);

  /** A summary row's dollar equivalent, from raw units. */
  const usdOfRaw = (raw: bigint): string | null =>
    formatUsd(toUsd(Number(formatUnits(raw, decimals))));

  const isOccupant =
    !!address &&
    !!slot.occupant &&
    slot.occupant.toLowerCase() === address.toLowerCase();

  // Seed from the standing price, and from nothing when there is no standing
  // price. A vacant slot really is priced at zero, and inventing a friendlier
  // opening number would put a figure the user never chose behind a button
  // that self-assesses at exactly that figure.
  //
  // The cost is that the percentage steps have nothing to compound off — 0 x
  // 1.2 is 0 — so PriceInput disables them until a price exists.
  const startingPrice = useMemo(() => {
    if (!isOccupied) return 0;
    return Number(formatUnits(slot.price, decimals));
  }, [isOccupied, slot.price, decimals]);

  const [price, setPrice] = useState(startingPrice);
  const [mult, setMult] = useState(1);

  /**
   * Follow the seed until the user takes over.
   *
   * `useState(startingPrice)` reads its argument on the FIRST render only. The
   * slot is an async on-chain read, so a page that paints before it resolves
   * seeds from `price === 0n` — the vacant fallback — and then never catches
   * up, leaving an occupied slot offering 100 instead of its real price. Once
   * the field has been touched it is the user's, and the seed stops applying.
   */
  const touched = useRef(false);
  const seeded = useRef(startingPrice);
  useEffect(() => {
    if (touched.current || seeded.current === startingPrice) return;
    seeded.current = startingPrice;
    setPrice(startingPrice);
  }, [startingPrice]);

  const updatePrice = (next: number) => {
    touched.current = true;
    setPrice(next);
  };

  /**
   * The rate a buyer will actually pay.
   *
   * `buy` applies pending updates BEFORE checking the deposit, so a queued rise
   * is already in force by the time the floor is computed — sizing from the
   * current rate under-funds the slot and the buy reverts with
   * `InsufficientDeposit`. The sitting occupant has transitioned nothing, so
   * their own rate still governs.
   */
  const effectiveTax =
    !isOccupant && slot.hasPendingTax
      ? slot.pendingTaxPercentage
      : slot.taxPercentage;

  const base = slot.minDepositSeconds > 0n ? slot.minDepositSeconds : WEEK;
  const priceRaw = toRawUnits(String(price), decimals);

  /**
   * Mirrors `Slot._minDepositFor`, including its `ceilDiv`.
   *
   * Flooring instead under-funds by one wei whenever the division leaves a
   * remainder. It passes for any generous multiple and fails only on ×1 — the
   * exact-minimum option, and the one a user picks when funds are tight.
   */
  const depositFor = (m: number): bigint => {
    // No early return when the slot sets no minimum. The contract accepts any
    // deposit there, but offering 0 is the worst possible default — the buyer
    // is liquidatable the instant tax accrues. `base` already falls back to a
    // week, so the options stay real amounts of runway rather than three zeroes.
    const seconds = base * BigInt(m);
    const num = priceRaw * effectiveTax * seconds;
    const den = MONTH_SECONDS * 10_000n;
    return num === 0n ? 0n : (num + den - 1n) / den;
  };

  const deposit = depositFor(mult);
  const purchase = isOccupied ? slot.price : 0n;
  const total = purchase + deposit;

  // Computed once each rather than per JSX branch — the rows read them twice.
  const usdPurchase = usdOfRaw(purchase);
  const usdDeposit = usdOfRaw(deposit);
  const usdTotal = usdOfRaw(total);

  function handleBuy() {
    if (!address) return;
    buy({
      account: address,
      slot: slotAddress as Address,
      depositAmount: deposit,
      selfAssessedPrice: priceRaw,
    });
  }

  function handleSelfAssess() {
    if (!address) return;
    selfAssess(slotAddress as Address, priceRaw);
  }

  // ── Self-assess view (connected wallet is the current occupant) ──────────
  if (isOccupant) {
    return (
      <div className="space-y-3">
        <PriceInput
          label="New price"
          value={price}
          onChange={updatePrice}
          taxBps={effectiveTax}
          symbol={symbol}
          disabled={busy}
          hint={`Current: ${formatBalance(slot.price, decimals)} ${symbol}`}
          toUsd={toUsd}
        />
        <Button
          disabled={busy || priceRaw === slot.price || priceRaw === 0n}
          onClick={handleSelfAssess}
          className="w-full"
        >
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin mr-2" /> Processing...
            </>
          ) : (
            "Update Price"
          )}
        </Button>
      </div>
    );
  }

  // ── Buy view ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      <PriceInput
        label="Your price"
        value={price}
        onChange={updatePrice}
        taxBps={effectiveTax}
        symbol={symbol}
        disabled={busy}
        hint="Others can force-buy at this price"
        toUsd={toUsd}
      />

      <DepositChoice
        label="Deposit"
        base={base}
        mult={mult}
        onPick={setMult}
        amountFor={depositFor}
        decimals={decimals}
        symbol={symbol}
        disabled={busy}
        note={
          slot.hasPendingTax
            ? `Sized at the queued ${formatBps(Number(effectiveTax))}/mo, which takes effect on this buy`
            : undefined
        }
      />

      {/* Summary */}
      <div className="bg-muted/50 p-2.5 space-y-1">
        {isOccupied && (
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Purchase</span>
            <span className="tabular-nums">
              {formatBalance(purchase, decimals)} {symbol}
              {usdPurchase && (
                <span className="text-muted-foreground/70"> ≈ {usdPurchase}</span>
              )}
            </span>
          </div>
        )}
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Deposit</span>
          <span className="tabular-nums">
            {formatBalance(deposit, decimals)} {symbol}
            {usdDeposit && (
              <span className="text-muted-foreground/70"> ≈ {usdDeposit}</span>
            )}
          </span>
        </div>
        <div className="flex justify-between text-sm font-bold border-t pt-1 mt-1">
          <span>Total</span>
          <span className="tabular-nums">
            {formatBalance(total, decimals)} {symbol}
            {usdTotal && (
              <span className="font-normal text-muted-foreground/70"> ≈ {usdTotal}</span>
            )}
          </span>
        </div>
      </div>

      <Button
        disabled={busy || !address || priceRaw === 0n}
        onClick={handleBuy}
        className="w-full"
      >
        {busy ? (
          <>
            <Loader2 className="size-4 animate-spin mr-2" /> Processing...
          </>
        ) : isOccupied ? (
          `Buy @ ${formatBalance(purchase, decimals)} ${symbol}`
        ) : (
          "Buy Slot"
        )}
      </Button>
    </div>
  );
}
