"use client";

import { Loader2, RotateCcw } from "lucide-react";
import { useCallback, useState } from "react";
import { type Address, formatUnits, zeroAddress } from "viem";
import { Button } from "@/components/ui/button";
import { PriceInput } from "@/components/ui/price-input";
import { MONTH_SECONDS } from "@/constants";
import { useChain } from "@/context/chain";
import type { LiveAccrual } from "@/hooks/use-live-accrual";
import { useSlotAction } from "@/hooks/use-slot-action";
import type { SlotOnChain } from "@/hooks/use-slot-onchain";
import { formatUsd, useUsdPrice } from "@/hooks/use-usd-price";
import { cn } from "@/lib/utils";
import { formatBalance, formatDuration } from "@/utils";

/**
 * Everything the occupant can do to their own position, without selling it.
 *
 * ── Why one button and not three ─────────────────────────────────────────
 *
 * Because the contract does not treat them as independent. `selfAssess` ends
 * with `_enforceMinDepositExisting(newPrice)`, so the deposit still standing
 * after settlement has to cover the minimum at the NEW price. Raising your
 * valuation — the most ordinary thing an occupant wants to do — therefore
 * reverts with `InsufficientDeposit` unless the deposit was already large
 * enough. That was the panel's sharpest edge: the field let you type the price,
 * the button let you submit it, and the chain refused with an error naming a
 * deposit nobody had mentioned.
 *
 * Withdrawal is the same coupling from the other side. `withdraw` refuses to
 * leave the deposit under the minimum at the current price, so how much you may
 * take back is a function of the valuation — and LOWERING the valuation is
 * precisely what frees deposit to take. Sitting in its own panel, that control
 * could only ever quote a ceiling for the price you had not changed yet.
 *
 * So price and deposit are one form and one submit, batched through the slot's
 * own `multicall`. What was two traps becomes two lines of copy: what the new
 * valuation costs to hold, and how long it stays funded afterwards.
 */

const BASIS_POINTS = 10_000n;
const DAY = 86_400n;
const ZERO = 0n;

/** Headroom over the minimum, so a slow confirmation cannot undershoot it. */
const SETTLE_MARGIN_SECONDS = 600n;

/**
 * Runway, as one continuous scale from taking back to adding.
 *
 * The same three intervals in both directions, laid out like the percentage
 * steps above them — cuts on the left, additions on the right, one real division
 * at the turn. Deposit and withdrawal were a tab strip and a separate panel
 * speaking different vocabularies (multiples of the minimum window against
 * percentages of a balance); as a signed scale they are one question, "how much
 * runway do you want", asked once.
 */
const RUNWAY_STEPS = [
  { label: "−1mo", seconds: -MONTH_SECONDS },
  { label: "−1w", seconds: -(DAY * 7n) },
  { label: "−1d", seconds: -DAY },
  { label: "+1d", seconds: DAY },
  { label: "+1w", seconds: DAY * 7n },
  { label: "+1mo", seconds: MONTH_SECONDS },
] as const;

/**
 * What `seconds` of runway costs at `price`.
 *
 * ceilDiv, mirroring `Slot._minDepositFor`. Flooring under-funds by a wei
 * whenever the division leaves a remainder, which passes for a generous
 * multiple and fails on exactly the minimum — the option chosen when funds are
 * tight.
 */
export function depositForSeconds(
  price: bigint,
  taxBps: bigint,
  seconds: bigint,
): bigint {
  const numerator = price * taxBps * seconds;
  if (numerator <= ZERO) return ZERO;
  const denominator = MONTH_SECONDS * BASIS_POINTS;
  return (numerator + denominator - 1n) / denominator;
}

/** How long `deposit` keeps a slot at `price` solvent, in seconds. */
function runwaySeconds(deposit: bigint, price: bigint, taxBps: bigint): bigint {
  const perMonth = price * taxBps;
  if (perMonth === ZERO || deposit <= ZERO) return ZERO;
  return (deposit * MONTH_SECONDS * BASIS_POINTS) / perMonth;
}

export function ManageTerms({
  slot,
  slotAddress,
  accrual,
  walletBalance,
  onDone,
}: {
  slot: SlotOnChain;
  slotAddress: string;
  /** The interpolated accrual, so the figures agree with the panel above. */
  accrual: LiveAccrual;
  walletBalance: bigint;
  onDone?: () => void;
}) {
  const decimals = slot.currencyDecimals ?? 6;
  const symbol = slot.currencySymbol ?? "USDC";
  const taxBps = slot.taxPercentage;
  const { chainId } = useChain();
  const { toUsd } = useUsdPrice(slot.currency, chainId);
  const { manageTerms, busy, activeAction } = useSlotAction();

  const [priceWei, setPriceWei] = useState<bigint | null>(null);
  /** Signed: positive adds runway, negative takes it back. */
  const [deltaSeconds, setDeltaSeconds] = useState<bigint>(ZERO);

  // The field starts at whatever the slot currently says and only diverges once
  // touched, so opening the panel and leaving it changes nothing.
  const newPrice = priceWei ?? slot.price;

  // What settlement will take before any of this runs. `selfAssess`, `topUp` and
  // `withdraw` all call `_settle()` first, so the deposit these figures must
  // satisfy is the one left AFTER the tax owed so far is deducted — not the one
  // on screen.
  const settledDeposit = accrual.remaining > ZERO ? accrual.remaining : ZERO;

  const priceChanged = newPrice !== slot.price && newPrice > ZERO;

  /**
   * The floor the deposit has to clear, by the same ceilDiv the contract uses.
   * A slot with no minimum has no floor and nothing below is forced.
   *
   * Computed at the NEW price, for both directions, because that is the price
   * both checks run against: `selfAssess` enforces it as its last act, and
   * `withdraw` — which goes second, after the reprice — enforces it against
   * whatever the price is by then.
   *
   * Aimed a little above the floor rather than exactly at it. These figures are
   * quoted now and spent whenever the wallet is confirmed, and tax keeps
   * accruing in between — a top-up sized to the exact shortfall is already short
   * by the time it lands, and a withdrawal sized to the exact ceiling is already
   * over it.
   */
  const floor =
    slot.minDepositSeconds > ZERO
      ? depositForSeconds(
          newPrice,
          taxBps,
          slot.minDepositSeconds + SETTLE_MARGIN_SECONDS,
        )
      : ZERO;

  /**
   * The shortfall a reprice creates, and only a reprice.
   *
   * `_enforceMinDepositExisting` runs inside `selfAssess` and nowhere else, so
   * an occupant whose deposit has decayed below the minimum is not in trouble —
   * they are simply closer to the end of their runway, and the slot stays theirs
   * until it reaches zero. Charging them to open a panel they only opened to
   * look at would invent an obligation the contract does not impose.
   */
  const shortfall =
    priceChanged && floor > settledDeposit ? floor - settledDeposit : ZERO;

  /** What may actually leave, at the price this submit will set. */
  const withdrawable = settledDeposit > floor ? settledDeposit - floor : ZERO;

  // Taking money out while the new valuation demands more of it is not a
  // trade-off, it is a contradiction — the same transaction would have to fund
  // and defund the slot. The reduce half of the scale goes dead and says why.
  const canReduce = shortfall === ZERO && withdrawable > ZERO;
  const delta = deltaSeconds < ZERO && !canReduce ? ZERO : deltaSeconds;

  const wanted = depositForSeconds(
    newPrice,
    taxBps,
    delta < ZERO ? -delta : delta,
  );

  // Whichever is larger — asking for a day of runway cannot be allowed to send
  // less than the reprice itself demands.
  const topUpAmount =
    delta >= ZERO ? (wanted > shortfall ? wanted : shortfall) : shortfall;
  // Capped at the ceiling rather than offered and refused on chain.
  const withdrawAmount =
    delta < ZERO ? (wanted < withdrawable ? wanted : withdrawable) : ZERO;
  const capped = delta < ZERO && wanted > withdrawable;

  const nothingToDo =
    !priceChanged && topUpAmount === ZERO && withdrawAmount === ZERO;
  const exceedsWallet = topUpAmount > walletBalance;

  /**
   * Whether anything has been touched — which is NOT `!nothingToDo`.
   *
   * `nothingToDo` asks whether there is a transaction to send; this asks whether
   * the panel still shows what the slot says. They come apart in the cases that
   * matter for a reset: typing the current price back in, or typing a zero. Both
   * leave nothing to submit and both leave a field the occupant changed, and a
   * reset offered only when a transaction is possible would be unavailable in
   * exactly the states somebody wants it.
   */
  const dirty = priceWei !== null || deltaSeconds !== ZERO;

  const reset = useCallback(() => {
    setPriceWei(null);
    setDeltaSeconds(ZERO);
  }, []);

  const runwayAfter = runwaySeconds(
    settledDeposit + topUpAmount - withdrawAmount,
    newPrice,
    taxBps,
  );

  const moved = topUpAmount > ZERO ? topUpAmount : withdrawAmount;
  // Off `formatUnits`, not `formatBalance` — the latter abbreviates ("1.23K")
  // and `Number` of that is NaN.
  const movedUsd = formatUsd(toUsd(Number(formatUnits(moved, decimals))));

  /*
   * `Multicall.multicall` is not payable, so a native TOP-UP cannot ride through
   * it and the two stay separate — see `client.manageTerms`. Withdrawal is not
   * payable either way, so that direction is always one transaction. Said out
   * loud, because a wallet asking twice for one button is alarming when you were
   * not told to expect it.
   */
  const native = slot.currency === zeroAddress;
  const steps = native && topUpAmount > ZERO ? 1 + (priceChanged ? 1 : 0) : 1;

  const working = busy && activeAction === "Update terms";

  async function submit() {
    const hash = await manageTerms(slotAddress as Address, {
      newPrice: priceChanged ? newPrice : undefined,
      topUpAmount,
      withdrawAmount,
    });
    if (!hash) return;
    reset();
    onDone?.();
  }

  const gain = "bg-emerald-500/[0.07] text-emerald-600 dark:text-emerald-500";
  const loss = "bg-red-500/[0.07] text-red-600 dark:text-red-500";

  return (
    <div className="space-y-2.5">
      <PriceInput
        label="Your valuation"
        value={newPrice}
        onChange={setPriceWei}
        decimals={decimals}
        taxBps={taxBps}
        symbol={symbol}
        disabled={working}
        hint="What the next holder pays to take it from you"
        toUsd={toUsd}
      />

      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Runway
          </span>
          <span className="text-[10px] text-muted-foreground">
            {canReduce
              ? `${formatBalance(withdrawable, decimals)} ${symbol} may leave`
              : shortfall > ZERO
                ? "the new valuation needs funding"
                : "nothing may leave yet"}
          </span>
        </div>

        <div className="flex overflow-hidden border">
          {RUNWAY_STEPS.map(({ label, seconds }, i) => {
            const reducing = seconds < ZERO;
            const on = delta === seconds;
            return (
              <button
                key={label}
                type="button"
                disabled={working || (reducing && !canReduce)}
                onClick={() =>
                  setDeltaSeconds((v) => (v === seconds ? ZERO : seconds))
                }
                className={cn(
                  "tabular-nums min-w-0 flex-1 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-40",
                  // The turn from taking back to adding gets the one real
                  // division, as on the percentage scale above.
                  i === 3 ? "border-l" : i > 0 && "border-l border-border/50",
                  reducing ? loss : gain,
                  on && "ring-1 ring-inset ring-current brightness-95",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* The two things that are easy to get wrong, said plainly: what this
          costs now, and how long it keeps the slot solvent afterwards. */}
      <dl className="space-y-1 bg-muted/50 p-2.5 text-[11px]">
        {moved > ZERO && (
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">
              {topUpAmount > ZERO ? "You add" : "You take back"}
              {topUpAmount > ZERO && wanted <= shortfall
                ? " — the new valuation requires it"
                : ""}
              {capped ? " — all the slot may release" : ""}
            </dt>
            <dd className="tabular-nums">
              {formatBalance(moved, decimals)} {symbol}
              {movedUsd ? ` · ${movedUsd}` : ""}
            </dd>
          </div>
        )}
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Funded for</dt>
          <dd className="tabular-nums">
            {runwayAfter > ZERO ? formatDuration(Number(runwayAfter)) : "—"}
          </dd>
        </div>
        {!nothingToDo && (
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">To confirm</dt>
            <dd className="tabular-nums">
              {steps} transaction{steps > 1 ? "s" : ""}
            </dd>
          </div>
        )}
      </dl>

      {exceedsWallet && (
        <p className="text-[11px] text-destructive">
          That needs {formatBalance(topUpAmount, decimals)} {symbol} and your
          wallet holds {formatBalance(walletBalance, decimals)}.
        </p>
      )}

      {/* Reset to the left, submit taking the rest. The destructive-ish one is
          the small one and the one that does the work is the wide one, so the
          pair reads in the order it should be used. */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={reset}
          disabled={!dirty || working}
          title="Discard changes and show the slot's current terms"
          className="shrink-0 px-3"
        >
          <RotateCcw className="size-3.5" aria-hidden />
          Reset
        </Button>
        <Button
          type="button"
          onClick={() => void submit()}
          disabled={nothingToDo || exceedsWallet || working}
          className="flex-1"
        >
          {working ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            "Update terms"
          )}
        </Button>
      </div>
    </div>
  );
}
