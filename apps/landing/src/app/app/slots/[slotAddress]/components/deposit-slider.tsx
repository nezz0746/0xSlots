"use client";

import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { type Address, formatUnits } from "viem";
import { Button } from "@/components/ui/button";
import { DepositChoice } from "@/components/ui/deposit-choice";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MONTH_SECONDS } from "@/constants";
import { useSlotAction } from "@/hooks/use-slot-action";
import type { SlotOnChain } from "@/hooks/use-slot-onchain";
import { cn } from "@/lib/utils";
import { formatBalance, formatDuration, toRawUnits } from "@/utils";

/** Fallback runway unit for a slot that sets no minimum. */
const WEEK = 604_800n;

const WITHDRAW_PCTS = [25, 50, 100] as const;

/**
 * How much accruing tax the withdrawal ceiling holds back.
 *
 * `withdraw` settles BEFORE it checks the floor, so the true ceiling decays
 * every second. Offering the exact boundary computed from a snapshot means the
 * tax accrued between reading it and the transaction being mined pushes the
 * result under the minimum, and the call reverts — reliably, not occasionally.
 *
 * Five minutes of tax covers a stale panel plus confirmation, and costs
 * fractions of a cent at any sane price.
 */
const WITHDRAW_BUFFER_SECONDS = 300n;

interface DepositSliderProps {
  slot: SlotOnChain;
  slotAddress: string;
  walletBalance: bigint;
}

/**
 * The occupant's escrow controls.
 *
 * Deposit and withdrawal are separate tabs rather than one "target balance"
 * field. They are different intentions — extending runway versus taking money
 * back — and a single target made the cheapest runway preset silently mean
 * "withdraw", which reads backwards.
 *
 * Each side gets the presets that suit it: runway multiples for adding, since
 * what a deposit buys is time; percentages for taking back, since what you are
 * withdrawing is a share of a balance you already hold. Both accept a typed
 * amount, because presets can only ever be a shortcut.
 */
export function DepositSlider({
  slot,
  slotAddress,
  walletBalance,
}: DepositSliderProps) {
  const decimals = slot.currencyDecimals ?? 6;
  const symbol = slot.currencySymbol ?? "USDC";
  const { topUp, withdraw, busy, isSuccess } = useSlotAction();

  // What is actually still funding the slot. `withdraw` settles before it
  // checks anything, so sizing against the raw deposit would offer money the
  // next settlement is about to take.
  const funded = slot.deposit > slot.taxOwed ? slot.deposit - slot.taxOwed : 0n;

  const runwayUnit = slot.minDepositSeconds > 0n ? slot.minDepositSeconds : WEEK;

  /** Cost of `seconds` of runway at the current price. Mirrors `_minDepositFor`. */
  const costOf = (seconds: bigint): bigint => {
    const num = slot.price * slot.taxPercentage * seconds;
    const den = MONTH_SECONDS * 10_000n;
    return num === 0n ? 0n : (num + den - 1n) / den;
  };

  /**
   * The floor the contract will not let the balance drop below.
   *
   * Distinct from `runwayUnit`: a slot with no minimum has a floor of zero, and
   * the week fallback above is only a sensible unit to OFFER, never a rule.
   */
  const contractMin =
    slot.minDepositSeconds === 0n ? 0n : costOf(slot.minDepositSeconds);

  // The floor the UI offers, held above the contract's by a few minutes of
  // accrual so the ceiling survives the trip to the chain.
  const taxPerSecond =
    (slot.price * slot.taxPercentage) / (MONTH_SECONDS * 10_000n);
  const safeFloor = contractMin + taxPerSecond * WITHDRAW_BUFFER_SECONDS;
  const withdrawable = funded > safeFloor ? funded - safeFloor : 0n;

  const [addMult, setAddMult] = useState(1);
  const [addRaw, setAddRaw] = useState<string | null>(null);
  const [wdRaw, setWdRaw] = useState<string | null>(null);

  const addAmount =
    addRaw !== null ? toRawUnits(addRaw, decimals) : costOf(runwayUnit * BigInt(addMult));
  const wdAmount = wdRaw !== null ? toRawUnits(wdRaw, decimals) : 0n;

  const exceedsWallet = addAmount > walletBalance;
  const exceedsWithdrawable = wdAmount > withdrawable;

  const addCoverage =
    slot.price > 0n && slot.taxPercentage > 0n
      ? Number(
          ((funded + addAmount) * MONTH_SECONDS * 10_000n) /
            (slot.price * slot.taxPercentage),
        )
      : Number.POSITIVE_INFINITY;

  return (
    <Tabs defaultValue="deposit" className="w-full">
      <TabsList className="w-full">
        <TabsTrigger value="deposit" className="flex-1">
          Deposit
        </TabsTrigger>
        <TabsTrigger value="withdraw" className="flex-1">
          Withdraw
        </TabsTrigger>
      </TabsList>

      {/* ── Add runway ─────────────────────────────────────────────────────── */}
      <TabsContent value="deposit" className="space-y-2.5 pt-2.5">
        <DepositChoice
          label="Add · runway"
          base={runwayUnit}
          mult={addMult}
          onPick={(m) => {
            setAddRaw(null); // a preset takes over from any typed amount
            setAddMult(m);
          }}
          amountFor={(m) => costOf(runwayUnit * BigInt(m))}
          decimals={decimals}
          symbol={symbol}
          disabled={busy}
        />

        <Input
          type="text"
          inputMode="decimal"
          placeholder={`or type an amount (${symbol})`}
          value={addRaw ?? ""}
          onChange={(e) => setAddRaw(e.target.value)}
          className="text-xs"
        />

        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>
            Funded: {formatBalance(funded, decimals)} {symbol}
          </span>
          <span>
            Wallet: {formatBalance(walletBalance, decimals)} {symbol}
          </span>
        </div>

        {exceedsWallet && (
          <Alert>Insufficient wallet balance</Alert>
        )}

        {addAmount > 0n && !exceedsWallet && (
          <Summary
            leftLabel="Adding"
            leftValue={`+${formatBalance(addAmount, decimals)} ${symbol}`}
            tone="gain"
            rightLabel="Runway after"
            rightValue={
              addCoverage === Number.POSITIVE_INFINITY
                ? "No tax"
                : `~${formatDuration(addCoverage)}`
            }
          />
        )}

        <Button
          className="w-full"
          disabled={busy || addAmount === 0n || exceedsWallet}
          onClick={() => topUp(slotAddress as Address, addAmount)}
        >
          {busy
            ? "Processing..."
            : addAmount === 0n
              ? "Choose an amount"
              : `Add ${formatBalance(addAmount, decimals)} ${symbol}`}
        </Button>
      </TabsContent>

      {/* ── Take it back ───────────────────────────────────────────────────── */}
      <TabsContent value="withdraw" className="space-y-2.5 pt-2.5">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Withdraw · share
          </span>
          <span className="text-[10px] text-muted-foreground">
            max {formatBalance(withdrawable, decimals)} {symbol}
          </span>
        </div>

        {/* Percentages of what may actually leave — not of the balance. The
            contract settles then refuses to drop below the minimum deposit, so
            a "100%" of the full balance would simply revert. */}
        <div className="flex overflow-hidden border">
          {WITHDRAW_PCTS.map((pct, i) => {
            const amount = (withdrawable * BigInt(pct)) / 100n;
            return (
              <button
                key={pct}
                type="button"
                disabled={busy || withdrawable === 0n}
                onClick={() =>
                  setWdRaw(formatUnits(amount, decimals))
                }
                className={cn(
                  "flex-1 px-1 py-1.5 text-center transition-colors disabled:opacity-40",
                  i > 0 && "border-l",
                  "hover:bg-accent",
                )}
              >
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {pct === 100 ? "max" : `${pct}%`}
                </div>
                <div className="tabular-nums text-sm font-semibold">
                  {formatBalance(amount, decimals)}
                </div>
              </button>
            );
          })}
        </div>

        <Input
          type="text"
          inputMode="decimal"
          placeholder={`or type an amount (${symbol})`}
          value={wdRaw ?? ""}
          onChange={(e) => setWdRaw(e.target.value)}
          className="text-xs"
        />

        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>
            Funded: {formatBalance(funded, decimals)} {symbol}
          </span>
          <span>
            Locked: {formatBalance(contractMin, decimals)} {symbol}
          </span>
        </div>

        {exceedsWithdrawable && (
          <Alert>
            Only {formatBalance(withdrawable, decimals)} {symbol} may leave —
            the slot must keep {formatDuration(Number(slot.minDepositSeconds))}{" "}
            of runway
          </Alert>
        )}

        {wdAmount > 0n && !exceedsWithdrawable && (
          <Summary
            leftLabel="Withdrawing"
            leftValue={`−${formatBalance(wdAmount, decimals)} ${symbol}`}
            tone="loss"
            rightLabel="Left funded"
            rightValue={`${formatBalance(funded - wdAmount, decimals)} ${symbol}`}
          />
        )}

        <Button
          className="w-full"
          variant="outline"
          disabled={busy || wdAmount === 0n || exceedsWithdrawable}
          onClick={() => withdraw(slotAddress as Address, wdAmount)}
        >
          {busy
            ? "Processing..."
            : wdAmount === 0n
              ? "Choose an amount"
              : `Withdraw ${formatBalance(wdAmount, decimals)} ${symbol}`}
        </Button>
      </TabsContent>

      {isSuccess && (
        <p className="pt-2 text-xs text-emerald-600 dark:text-emerald-500 text-center">
          Transaction confirmed
        </p>
      )}
    </Tabs>
  );
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-1.5 border border-destructive/50 bg-destructive/5 px-2.5 py-2 text-[11px] text-destructive">
      <AlertTriangle className="size-3 mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function Summary({
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
  tone,
}: {
  leftLabel: string;
  leftValue: string;
  rightLabel: string;
  rightValue: string;
  tone: "gain" | "loss";
}) {
  return (
    <div className="bg-muted/50 px-2.5 py-2 space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{leftLabel}</span>
        <span
          className={cn(
            "font-bold tabular-nums",
            tone === "gain"
              ? "text-emerald-600 dark:text-emerald-500"
              : "text-orange-600 dark:text-orange-500",
          )}
        >
          {leftValue}
        </span>
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{rightLabel}</span>
        <span className="tabular-nums">{rightValue}</span>
      </div>
    </div>
  );
}
