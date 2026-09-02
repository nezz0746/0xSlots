"use client";

import { offerBookAbi } from "@0xslots/contracts/slots";
import type { SlotState } from "@0xslots/sdk/slots";
import { MONTH_SECONDS } from "@0xslots/sdk/slots";
import { Loader2, ShoppingCart } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { type Address, formatUnits, isAddress } from "viem";
import { useAccount, useWalletClient } from "wagmi";
import { Button } from "@/components/ui/button";
import { DepositChoice } from "@/components/ui/deposit-choice";
import { Input } from "@/components/ui/input";
import { PriceInput } from "@/components/ui/price-input";
import { useChain } from "@/context/chain";
import type { CurrencyMeta } from "@/hooks/slots/use-slots";
import {
  useArrears,
  useMinDepositForBuy,
  useTakeQuote,
} from "@/hooks/slots/use-slots";
import type { useSlotsAction } from "@/hooks/slots/use-slots-action";
import { useCurrencyBalance } from "@/hooks/use-currency-balance";
import { useSlotBounds } from "@/hooks/use-slot-bounds";
import { formatUsd, useUsdPrice } from "@/hooks/use-usd-price";
import { formatBalance, formatBps } from "@/utils";
import { useOrders } from "../hooks/use-orders";
import { Panel } from "./panel";

type Actions = ReturnType<typeof useSlotsAction>;

/** Fallback runway unit for a slot that sets no minimum. */
const WEEK = 604_800n;
const ZERO = 0n;

/**
 * Take the slot — by buying it, by claiming it vacant, or by evicting whoever
 * has run their deposit dry.
 *
 * ── Where the numbers come from ─────────────────────────────────────────
 *
 * Nothing on this panel is derived locally any more, and that is the whole
 * point of the port. The two figures that decide whether a transaction
 * succeeds are both asked of the slot:
 *
 * - The COST comes from `quoteBuy`, never from `price()`. An occupied slot
 *   charges the sitting occupant's asking price plus your deposit; a vacant one
 *   charges the deposit alone; and either way the seated account's arrears are
 *   folded in. A native slot checks `msg.value` for EQUALITY, not sufficiency,
 *   so a figure derived here rather than quoted reverts the moment the two
 *   disagree.
 *
 * - The MINIMUM DEPOSIT comes from `minDepositForBuy`, which reads the PENDING
 *   tax when one is queued. Entry is an occupancy transition, so `_applyPending`
 *   runs before the funding check and the buyer funds the terms they are buying
 *   into. This panel used to mirror `_minDepositFor` by hand and pick the
 *   effective rate itself; the hand-rolled version was right about the hazard
 *   and is now simply asking the party that decides.
 */
export function BuySection({
  slot,
  state,
  currency,
  actions,
  bare,
  trailing,
}: {
  slot: Address;
  state: SlotState;
  currency: CurrencyMeta;
  actions: Actions;
  /** Render without panel chrome, for the valuation card that already has a header. */
  bare?: boolean;
  /** Sits beside the submit — the "more actions" disclosure. See ActionsCard. */
  trailing?: React.ReactNode;
}) {
  const { address, isConnected } = useAccount();
  const { chainId } = useChain();
  const { data: walletClient } = useWalletClient({ chainId });
  const { book, refresh: refreshOrders } = useOrders(slot);
  const balance = useCurrencyBalance(state.currency);
  const { decimals, symbol } = currency;

  // Base only — see the hook. `toUsd` returns null everywhere else, and every
  // consumer renders nothing rather than a misleading zero.
  const { toUsd } = useUsdPrice(state.currency, chainId);

  /** A summary row's dollar equivalent, from raw units. */
  const usdOfRaw = (raw: bigint): string | null =>
    formatUsd(toUsd(Number(formatUnits(raw, decimals))));

  const isOccupant =
    !!address && state.occupant.toLowerCase() === address.toLowerCase();

  // Seed from the standing price, and from nothing when there is no standing
  // price. A vacant slot really is priced at zero, and inventing a friendlier
  // opening number would put a figure the user never chose behind a button
  // that self-assesses at exactly that figure.
  //
  // Raw units throughout. Carried as a JavaScript number this was a round trip
  // through a float on every keystroke and every percentage step — exact for
  // whole USDC and lossy for anything priced in ETH.
  const startingPrice = useMemo(
    () => (state.isVacant ? ZERO : state.price),
    [state.isVacant, state.price],
  );

  const [price, setPrice] = useState(startingPrice);
  const [mult, setMult] = useState(1);
  const [seat, setSeat] = useState("");
  const [showSeat, setShowSeat] = useState(false);

  /**
   * Follow the seed until the user takes over.
   *
   * `useState(startingPrice)` reads its argument on the FIRST render only. The
   * slot is an async on-chain read, so a page that paints before it resolves
   * seeds from `price === 0n` — the vacant fallback — and then never catches
   * up, leaving an occupied slot offering nothing instead of its real price.
   * Once the field has been touched it is the user's, and the seed stops
   * applying.
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
   * Below the asking price, this form is an OFFER rather than a purchase.
   *
   * The two are the same intent expressed at different numbers: "I value this
   * at X" either clears the occupant's asking price or it does not. Splitting
   * them into two forms made the second look like a different product, when it
   * is the same decision — and left a visitor who typed a lower number staring
   * at a Buy button that would have charged them the occupant's price anyway.
   *
   * The channel changed with the protocol — OfferBook is retired and a signed
   * sell order replaced it — but the interaction did not: type a lower number
   * and the primary becomes "Offer". Signing is free and off-chain; the
   * occupant is the only one who ever pays gas.
   *
   * ERC-20, occupied, and only where a book is deployed. Filling pulls the
   * buyer's funds on an allowance and native ETH has none; a vacant slot is
   * claimed outright rather than negotiated for; and with no book there is
   * nowhere to publish the bid.
   */
  // Also requires a book on this chain: without somewhere to publish it, an
  // "offer" would be a signature that never reaches the occupant.
  const canOffer = !state.isVacant && !currency.isNative && !!book;
  const isOffer = canOffer && price > ZERO && price < state.price;

  /**
   * The rate a buyer will actually pay, for DISPLAY only.
   *
   * The deposit itself is sized by the chain (below), but the price field shows
   * "costs X/mo" beside the figure and that caption has to agree with what the
   * buyer is about to be charged. A queued rise is in force by the time their buy
   * lands ONLY once it is ripe — `TERMS_DELAY` means a proposal is not binding
   * the moment it is made, and `_applyPending` refuses an unripe one. The
   * sitting occupant has transitioned nothing, so their own rate still governs
   * for them either way.
   */
  const effectiveTax =
    !isOccupant && state.pending.hasTax
      ? state.pending.taxPercentage
      : state.taxPercentage;

  /**
   * The contract's own minimum at this price — the unit every option is a
   * multiple of, so ×1 is never an amount the chain will reject.
   */
  const { data: chainMinimum } = useMinDepositForBuy(slot, price);

  /**
   * A deposit window for a slot that demands none.
   *
   * The contract accepts any deposit there — `minDepositForBuy` returns zero —
   * but offering 0 is the worst possible default: the buyer is liquidatable the
   * instant tax accrues. Falling back to a week keeps the three options real
   * amounts of runway rather than three zeroes.
   */
  const base = state.minDepositSeconds > ZERO ? state.minDepositSeconds : WEEK;
  const noMinimum = state.minDepositSeconds === ZERO;

  /**
   * What ×m costs.
   *
   * ×1 is the chain's figure verbatim wherever the slot sets a minimum, so the
   * cheapest option is exactly the contract's floor and never one wei under it
   * — the failure mode a locally floored division produces, which passes for
   * any generous multiple and fails only on ×1, the option someone picks when
   * funds are tight.
   */
  const depositFor = (m: number): bigint => {
    if (price === ZERO) return ZERO;
    if (!noMinimum && chainMinimum !== undefined)
      return chainMinimum * BigInt(m);
    // No minimum on the slot, or the read is still in flight: mirror
    // `_minDepositFor` including its `ceilDiv` against the week fallback.
    const seconds = base * BigInt(m);
    const num = price * effectiveTax * seconds;
    const den = MONTH_SECONDS * 10_000n;
    return num === ZERO ? ZERO : (num + den - 1n) / den;
  };

  const deposit = depositFor(mult);

  // The slot refuses a price above `MAX_PRICE`, so catch it here rather than
  // letting the user discover it as an `InvalidPrice` revert.
  const bounds = useSlotBounds(slot);
  const overMaxPrice = bounds ? price > bounds.maxPrice : false;

  // Declared before the quotes, because both are asked FOR this address: it is
  // the one being seated, it is the one carrying arrears, and it is not
  // necessarily the one paying.
  const seatAddress = (showSeat && seat.trim() ? seat.trim() : address) as
    | Address
    | undefined;
  const seatValid = !!seatAddress && isAddress(seatAddress);
  const quoteFor = seatValid ? seatAddress : undefined;

  /**
   * One entry point: `buy`.
   *
   * Evict-and-take used to be a second one, charging the deposit alone because
   * the eviction vacated the slot before the purchase read the price. It needed
   * a periphery contract on native slots, and that contract is gone — so taking
   * an insolvent occupant's slot cheaply is now Liquidate, then Buy, as two
   * transactions from the actions panel.
   */
  const { data: quote } = useTakeQuote(slot, quoteFor, deposit);

  /**
   * Tax the seated account still owes this slot from a previous occupancy.
   *
   * Inside both quotes already — this read is what lets it be shown as its own
   * line. Folding it silently into the total would present someone paying off a
   * default as someone paying a higher price, which is the one reading that
   * makes the charge look like a bug.
   */
  const { data: arrears } = useArrears(slot, quoteFor);
  const debt = arrears ?? ZERO;

  // Derived from the quote rather than from `price`, so it is right on all
  // paths without this panel having to know the rule: an eviction charges the
  // deposit alone and the purchase half is simply zero. The arrears come out
  // first — they are in the quote, and they are not part of what the occupant
  // is being paid.
  const quotedPurchase =
    quote === undefined
      ? ZERO
      : quote - deposit - debt < ZERO
        ? ZERO
        : quote - deposit - debt;
  // An offer pays what YOU named; a purchase pays what the occupant named.
  const purchase = isOffer ? price : quotedPurchase;
  const total = isOffer ? price + deposit + debt : (quote ?? ZERO);

  const usdPurchase = usdOfRaw(purchase);
  const usdDeposit = usdOfRaw(deposit);
  const usdArrears = usdOfRaw(debt);
  const usdTotal = usdOfRaw(total);

  const ready =
    isConnected &&
    seatValid &&
    price > ZERO &&
    deposit > ZERO &&
    !overMaxPrice &&
    // No ceiling without a quote. Sending the buy anyway would mean either no
    // `maxPayment` at all or a guessed one, and both are the bug this closes.
    (isOffer || quote !== undefined);

  /**
   * Simulate, then send.
   *
   * The simulation is not belt-and-braces: a hook's veto is a `view` revert
   * carrying the hook's own error, and that reason survives only in a
   * simulation. Sent blind, the same veto comes back as a mined, reverted
   * transaction whose receipt says nothing — so "Minimum tenure has not
   * elapsed" would degrade to "it failed", which is useless to the person who
   * has to decide what to do next.
   */
  /**
   * Post a standing bid to the slot's offer book.
   *
   * Two steps, and only the second costs gas on the bidder's side:
   *
   *   1. `makeSellOrder` grants the allowance if the standing one is short and
   *      signs the exact terms. The signature is what stops the occupant
   *      selling to you at a price you never agreed to — the slot re-verifies
   *      it, so neither this app nor the book can rewrite it.
   *   2. `offer` publishes those terms so the occupant can FIND them. Without
   *      this the order exists only in the bidder's browser, which is no use to
   *      the person who has to accept it.
   *
   * The funds stay in the bidder's wallet throughout. The book custodies
   * nothing and executes nothing; the occupant's own `sell` is the only
   * transaction that moves anything.
   */
  const submitOffer = async () => {
    if (!book || !walletClient) return;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60);
    const signed = await actions.makeSellOrder(slot, {
      price,
      deposit,
      deadline,
    });
    if (!signed) return;
    const hash = await actions.exec("Post offer", () =>
      walletClient.writeContract({
        address: book,
        abi: offerBookAbi,
        functionName: "offer",
        args: [
          slot,
          signed.order.price,
          signed.order.deposit,
          deadline,
          signed.order.nonce,
          signed.signature,
        ],
        account: walletClient.account,
        chain: walletClient.chain,
      }),
    );
    if (hash) refreshOrders();
  };

  const submit = async () => {
    if (!ready) return;
    if (isOffer) return submitOffer();
    const params = {
      slot,
      account: seatAddress as Address,
      depositAmount: deposit,
      selfAssessedPrice: price,
      /**
       * The ceiling, and it is the figure on screen rather than one the SDK
       * re-reads for itself.
       *
       * The sitting price is read at EXECUTION. An occupant who sees this
       * transaction coming can raise it and take the buyer's whole ERC-20
       * allowance — native slots are incidentally safe because `msg.value` is
       * checked for equality, ERC-20 slots were not protected at all. Sending
       * the total the user agreed to means the buy either costs that or
       * reverts `PaymentAboveMax`, which the toast renders as "the price
       * moved".
       */
      maxPayment: quote as bigint,
    };
    const label = state.isInsolvent ? "Liquidate and take" : "Buy slot";
    const ok = await actions.preflight(label, async () => {
      await actions.client.simulateBuy(params);
      return true;
    });
    if (!ok) return;
    actions.buy(params);
  };

  // ── Self-assess view (connected wallet is the current occupant) ──────────
  if (isOccupant) {
    const occupantBody = (
      <>
        <PriceInput
          label="Your valuation"
          value={price}
          onChange={updatePrice}
          decimals={decimals}
          taxBps={effectiveTax}
          symbol={symbol}
          disabled={actions.busy}
          hint={`Current: ${formatBalance(state.price, decimals)} ${symbol}`}
          toUsd={toUsd}
        />
        <Button
          disabled={actions.busy || price === state.price || price === ZERO}
          onClick={() => actions.selfAssess(slot, price)}
          className="w-full"
        >
          {actions.busy ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" /> Processing…
            </>
          ) : (
            "Update valuation"
          )}
        </Button>
        <p className="text-[10px] leading-snug text-muted-foreground">
          Restates what the slot is worth. Raises or lowers both your tax and
          the price anyone may take it at.
        </p>
      </>
    );
    return bare ? (
      <div className="space-y-3">{occupantBody}</div>
    ) : (
      <Panel
        icon={ShoppingCart}
        title="Your valuation"
        tint="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      >
        {occupantBody}
      </Panel>
    );
  }

  // ── Take view ────────────────────────────────────────────────────────────
  const body = (
    <>
      <PriceInput
        label="Your valuation"
        value={price}
        onChange={updatePrice}
        decimals={decimals}
        taxBps={effectiveTax}
        symbol={symbol}
        disabled={actions.busy}
        hint="What the next holder pays to take it from you"
        toUsd={toUsd}
      />

      {overMaxPrice && (
        <p className="border border-destructive/40 px-2.5 py-2 text-[11px] leading-snug text-destructive">
          That valuation is above the protocol maximum. The cap exists so the
          tax calculation cannot overflow — which would freeze the slot for
          everyone, liquidation included.
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
        disabled={actions.busy}
        note={
          state.pending.hasTax && state.pending.applies
            ? `Sized at the queued ${formatBps(
                Number(state.pending.taxPercentage),
              )}/mo, which takes effect on this buy`
            : state.pending.hasTax
              ? // Queued but not yet ripe. `_applyPending` refuses it, so this
                // buy is priced and funded at the CURRENT rate — saying
                // otherwise would size the deposit against a rate the
                // transition will not use.
                `Sized at the current ${formatBps(
                  Number(state.taxPercentage),
                )}/mo — the queued rate is not binding yet`
              : noMinimum
                ? "This slot demands no minimum. These are one, two and three weeks of runway — a zero deposit is liquidatable the instant tax accrues."
                : undefined
        }
      />

      <button
        type="button"
        className="text-[10px] text-muted-foreground underline underline-offset-2"
        onClick={() => setShowSeat((v) => !v)}
      >
        {showSeat ? "Seat myself" : "Seat a different address"}
      </button>
      {showSeat ? (
        <div className="space-y-1">
          <Input
            value={seat}
            placeholder={address ?? "0x…"}
            onChange={(e) => setSeat(e.target.value)}
            className="rounded-none font-mono text-xs"
          />
          <p className="text-[10px] leading-snug text-muted-foreground">
            You pay; this address occupies. The protocol connects the two with
            nothing — which is what lets a contract acquire a slot for someone
            else.
          </p>
        </div>
      ) : null}

      {/* Summary */}
      <div className="space-y-1 bg-muted/50 p-2.5">
        {!state.isVacant && (
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">
              {state.isInsolvent ? "Buy-out" : "Purchase"}
            </span>
            <span className="tabular-nums">
              {quote === undefined ? (
                "…"
              ) : (
                <>
                  {formatBalance(purchase, decimals)} {symbol}
                  {usdPurchase && (
                    <span className="text-muted-foreground/70">
                      {" "}
                      ≈ {usdPurchase}
                    </span>
                  )}
                </>
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

        {/* Its own line, never folded into the total. The seated account owes
            this from an occupancy whose deposit ran dry here; the protocol
            carries it rather than forgiving it, and charges it on re-entry. A
            total silently larger than price + deposit reads as a bug, and the
            person paying off their own default is entitled to know that is
            what they are doing. */}
        {debt > ZERO && (
          <div className="flex justify-between text-xs">
            <span className="text-amber-700 dark:text-amber-400">
              Arrears owed
            </span>
            <span className="tabular-nums text-amber-700 dark:text-amber-400">
              {formatBalance(debt, decimals)} {symbol}
              {usdArrears && (
                <span className="opacity-70"> ≈ {usdArrears}</span>
              )}
            </span>
          </div>
        )}
        <div className="mt-1 flex justify-between border-t pt-1 text-sm font-bold">
          <span>Total</span>
          <span className="tabular-nums">
            {deposit === ZERO ? (
              "—"
            ) : quote === undefined ? (
              "…"
            ) : (
              <>
                {formatBalance(total, decimals)} {symbol}
                {usdTotal && (
                  <span className="font-normal text-muted-foreground/70">
                    {" "}
                    ≈ {usdTotal}
                  </span>
                )}
              </>
            )}
          </span>
        </div>
        <p className="pt-0.5 text-[10px] leading-snug text-muted-foreground">
          {state.isInsolvent
            ? "The deposit alone — the eviction runs first, so there is nobody left to buy out."
            : state.isVacant
              ? "The deposit alone — the slot is vacant."
              : "Your deposit, plus buying the occupant out at their own price."}
          {debt > ZERO
            ? ` Plus ${formatBalance(debt, decimals)} ${symbol} of tax ${
                seatAddress?.toLowerCase() === address?.toLowerCase()
                  ? "you still owe"
                  : "that address still owes"
              } from a previous occupancy here, which the slot charges on
               re-entry.`
            : ""}
        </p>
        {quote !== undefined && !isOffer ? (
          <p className="text-[10px] leading-snug text-muted-foreground">
            This total is sent as a ceiling. If the occupant raises their price
            before the transaction lands, it reverts rather than charging you
            the new one.
          </p>
        ) : null}
        <div className="flex justify-between pt-1 text-[11px] text-muted-foreground">
          <span>Your balance</span>
          <span className="tabular-nums">
            {formatBalance(balance, decimals)} {symbol}
          </span>
        </div>
      </div>

      {isOffer ? (
        <p className="border border-dashed p-2 text-[11px] leading-snug text-muted-foreground">
          That is below the {formatBalance(state.price, decimals)} {symbol} the
          occupant is asking, so this becomes an{" "}
          <strong className="font-medium text-foreground">offer</strong> rather
          than a purchase. You sign your exact terms — free, no gas — and your
          funds stay in your wallet until the occupant chooses to take them.
          That signature is what stops them selling to you at a different price.
        </p>
      ) : null}

      {/* Primary and its disclosure, side by side.
          The primary is Buy or Offer and NOTHING else. It used to become
          "Evict and take" the moment the occupant went insolvent, which changes
          the identity of the main action under the user — the same regression
          the disclosure was built to avoid when this was a full-width bar.
          Liquidation lives behind the chevron now; see ActionsCard. */}
      <div className="flex items-center gap-2">
        <Button
          className="flex-1"
          variant={isOffer ? "outline" : "default"}
          disabled={!ready || actions.busy}
          onClick={submit}
        >
          {actions.busy ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" /> Processing…
            </>
          ) : isOffer ? (
            `Offer @ ${formatBalance(price, decimals)} ${symbol}`
          ) : state.isVacant ? (
            // "Buy slot", not "Claim slot". The call IS `buy`, and inventing a
            // second verb for the vacant case makes the primary look like a
            // different action depending on state — the thing this button was
            // just rewritten to stop doing.
            "Buy slot"
          ) : state.isInsolvent || quote === undefined ? (
            // Two cases, one label. When insolvent there is no buy-out price to
            // name — the eviction runs first, so `purchase` is genuinely zero.
            // While the quote is still in flight it is zero only because we
            // have not been told yet. Either way "Buy @ 0" reads as a broken
            // field rather than as a price, so the amount is simply omitted
            // until there is a real one.
            "Buy slot"
          ) : (
            `Buy @ ${formatBalance(purchase, decimals)} ${symbol}`
          )}
        </Button>
        {trailing}
      </div>

      {!isConnected ? (
        <p className="text-[10px] text-muted-foreground">
          Connect a wallet to take this slot.
        </p>
      ) : null}
    </>
  );

  if (bare) return <div className="space-y-3">{body}</div>;

  return (
    <Panel
      icon={ShoppingCart}
      title={state.isVacant ? "Buy this slot" : "Take this slot"}
      tint="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    >
      {body}
    </Panel>
  );
}
