"use client";

import { offerBookAbi, offerBookAddress } from "@0xslots/contracts";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { type Address, formatUnits, zeroAddress } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { Button } from "@/components/ui/button";
import { DepositChoice } from "@/components/ui/deposit-choice";
import { PriceInput } from "@/components/ui/price-input";
import { MONTH_SECONDS } from "@/constants";
import { useChain } from "@/context/chain";
import { useSlotAction } from "@/hooks/use-slot-action";
import type { SlotOnChain } from "@/hooks/use-slot-onchain";
import { formatUsd, useUsdPrice } from "@/hooks/use-usd-price";
import { formatBalance, formatBps } from "@/utils";

/** Fallback runway unit for a slot that sets no minimum. */
const WEEK = 604_800n;

export function BuySection({
  slot,
  slotAddress,
  isOccupied,
  trailing,
  onOffered,
}: {
  slot: SlotOnChain;
  slotAddress: string;
  isOccupied: boolean;
  /** Sits beside the submit. */
  trailing?: React.ReactNode;
  /** Called after a standing offer is posted, so the board can refresh. */
  onOffered?: () => void;
}) {
  const decimals = slot.currencyDecimals ?? 6;
  const symbol = slot.currencySymbol ?? "USDC";
  const { buy, offer, retireOffer, selfAssess, busy } = useSlotAction();
  const { address } = useAccount();
  const { chainId } = useChain();
  const publicClient = usePublicClient({ chainId });

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
  //
  // Raw units throughout. This was carried as a JavaScript number and converted
  // back with `toRawUnits(String(price))`, which is a round trip through a float
  // for every keystroke and every percentage step — exact for whole USDC and
  // lossy for anything priced in ETH.
  const startingPrice = useMemo(() => {
    if (!isOccupied) return 0n;
    return slot.price;
  }, [isOccupied, slot.price]);

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

  const updatePrice = (next: bigint) => {
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
  const priceRaw = price;

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

  /**
   * Below the standing price, this form is an offer rather than a purchase.
   *
   * The two are the same intent expressed at different numbers: "I value this
   * at X" either clears the current asking price or it does not. Splitting them
   * into two forms made the second one look like a different product, when it
   * is the same decision — and left a visitor who typed a lower number staring
   * at a Buy button that would have charged them the occupant's price anyway.
   *
   * Only for an occupied, ERC-20 slot: a vacant one is bought at your own price
   * outright, and a native slot cannot be sold into at all — `Slot.sell` pulls
   * on an allowance and native ETH has none.
   */
  const book = offerBookAddress[chainId as keyof typeof offerBookAddress] as
    | Address
    | undefined;
  const canOffer =
    isOccupied && !!book && slot.currency.toLowerCase() !== zeroAddress;
  const isOffer = canOffer && priceRaw > 0n && priceRaw < slot.price;

  /**
   * The bidder's own standing offer, if they have one.
   *
   * The book allows exactly one offer per account per slot, so posting again
   * REPLACES what is there. Naming that on the button is the whole point of
   * reading this: silently overwriting an offer the visitor forgot about is
   * the kind of surprise that reads as a lost bid.
   *
   * Deliberately a plain `useQuery` under the board's own `offer-book` root
   * rather than `useReadContract`: wagmi nests `scopeKey` INSIDE a
   * `["readContract", …]` key, so the board's
   * `invalidateQueries(["offer-book"])` would sail straight past it and this
   * button would keep saying "Offer" after the offer landed.
   */
  const { data: standing } = useQuery({
    queryKey: ["offer-book", chainId, slotAddress, "mine", address],
    enabled: canOffer && !!address && !!book && !!publicClient,
    queryFn: async () => {
      if (!publicClient || !book || !address) return undefined;
      return await publicClient.readContract({
        address: book,
        abi: offerBookAbi,
        functionName: "offerOf",
        args: [slotAddress as Address, address],
      });
    },
  });
  const hasStanding = standing?.[0] === true;
  const standingPrice = hasStanding ? standing[2].price : 0n;

  // An offer pays what you named; a purchase pays what the occupant named.
  const purchase = isOffer ? priceRaw : isOccupied ? slot.price : 0n;
  const total = purchase + deposit;

  // Computed once each rather than per JSX branch — the rows read them twice.
  const usdPurchase = usdOfRaw(purchase);
  const usdDeposit = usdOfRaw(deposit);
  const usdTotal = usdOfRaw(total);

  /**
   * Post a standing bid instead of buying.
   *
   * Goes through `useSlotAction` exactly like `handleBuy` does, and that is the
   * fix rather than an incidental tidy-up. Written by hand against
   * `writeContractAsync` this path had none of what every other button gets:
   * no toast, so a confirmed offer looked identical to nothing happening; no
   * shared `busy`, so the button never showed it was working; and — worst — a
   * rejected or reverted transaction rejected a promise that `void` threw
   * away, so clicking did nothing at all and said nothing about why.
   *
   * The SDK also skips the approval when the existing allowance already covers
   * the amount, so raising a bid inside an allowance you already granted is one
   * wallet prompt, not two.
   */
  async function handleOffer() {
    if (!address) return;
    const hash = await offer(
      slotAddress as Address,
      priceRaw,
      deposit,
      BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60),
    );
    // `exec` returns undefined when it already reported a failure.
    if (hash) onOffered?.();
  }

  async function handleBuy() {
    if (!address) return;

    // Captured BEFORE the buy: once it lands the read below is refetched and
    // this component may already be showing the new occupancy.
    const standingId = hasStanding ? standing?.[1] : undefined;

    const hash = await buy({
      account: address,
      slot: slotAddress as Address,
      depositAmount: deposit,
      selfAssessedPrice: priceRaw,
    });
    if (!hash) return;

    /**
     * Buying out from under your own standing offer retires it.
     *
     * Offering 70 and then deciding to just buy at 80 leaves the 70 sitting in
     * the book. It stops being fillable immediately — you are the occupant now,
     * and `Slot.sell` refuses `CannotBuyFromYourself` — so it drops off the
     * board and out of `best`. But dropping off is not the same as being gone:
     * the day someone buys YOU out, that 70 becomes live again against an
     * allowance you probably still have standing, and the new occupant can sell
     * the slot back to you at a price you named in a different market.
     *
     * Best-effort, like the retire after a sell: the purchase already
     * succeeded, and failing here must not report it as failed.
     */
    if (standingId === undefined) return;
    await publicClient?.waitForTransactionReceipt({ hash });
    await retireOffer(slotAddress as Address, standingId);
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
          label="Your valuation"
          value={price}
          onChange={updatePrice}
          decimals={decimals}
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
            "Update valuation"
          )}
        </Button>
      </div>
    );
  }

  // ── Buy view ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      <PriceInput
        label="Your valuation"
        value={price}
        onChange={updatePrice}
        decimals={decimals}
        taxBps={effectiveTax}
        symbol={symbol}
        disabled={busy}
        hint="What the next holder pays to take it from you"
        toUsd={toUsd}
      />

      {isOffer && (
        <p className="rounded border border-dashed px-2.5 py-2 text-[11px] leading-snug text-muted-foreground">
          That is below the {formatBalance(slot.price, decimals)} {symbol} the
          occupant is asking, so this becomes a standing offer rather than a
          purchase. Your funds stay in your wallet — it costs nothing until they
          choose to take it.
          {hasStanding && (
            <>
              {" "}
              This{" "}
              <strong className="font-medium text-foreground">replaces</strong>{" "}
              your current offer of {formatBalance(standingPrice, decimals)}{" "}
              {symbol} — one offer per slot, since both would draw on the same
              allowance and only one could ever be filled.
            </>
          )}
        </p>
      )}

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
            <span className="text-muted-foreground">
              {isOffer ? "You would pay" : "Purchase"}
            </span>
            <span className="tabular-nums">
              {formatBalance(purchase, decimals)} {symbol}
              {usdPurchase && (
                <span className="text-muted-foreground/70">
                  {" "}
                  ≈ {usdPurchase}
                </span>
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
              <span className="font-normal text-muted-foreground/70">
                {" "}
                ≈ {usdTotal}
              </span>
            )}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          disabled={busy || !address || priceRaw === 0n}
          onClick={() => void (isOffer ? handleOffer() : handleBuy())}
          variant={isOffer ? "outline" : "default"}
          className="flex-1"
        >
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin mr-2" /> Processing...
            </>
          ) : isOffer ? (
            `${hasStanding ? "Replace offer" : "Offer"} @ ${formatBalance(
              priceRaw,
              decimals,
            )} ${symbol}`
          ) : isOccupied ? (
            `Buy @ ${formatBalance(purchase, decimals)} ${symbol}`
          ) : (
            "Buy Slot"
          )}
        </Button>
        {trailing}
      </div>
    </div>
  );
}
