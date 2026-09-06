"use client";

import { useWalletModal } from "@0xslots/wallet";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { type Address, parseUnits } from "viem";
import { useAccount } from "wagmi";

import { HoldingCost } from "@/components/holding-cost";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WhatItCostsYou } from "@/components/what-it-costs-you";
import { useClients, useTokenSlot } from "@/hooks/use-market";
import { isNative, truncate } from "@/lib/format";

/**
 * Buying a token IS buying its slot.
 *
 * Which is why this panel asks for a NEW valuation rather than just showing a
 * price: taking the slot means declaring what it is worth to you, and paying
 * rent on that number from the moment you hold it. A marketplace that hid this
 * behind a "Buy" button would be selling something other than what arrives.
 */
export function BuyPanel({
  chainId,
  tokenId,
  slot,
  currency,
  onDone,
}: {
  chainId: number;
  tokenId: string;
  slot: Address;
  currency: Address;
  onDone: () => void;
}) {
  const { address } = useAccount();
  const { slots, canWrite } = useClients(chainId);
  const { openConnect } = useWalletModal();
  const { data: state } = useTokenSlot(chainId, slot);

  const [valuation, setValuation] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parsed = (() => {
    try {
      return parseUnits(valuation || "0", 18);
    } catch {
      return 0n;
    }
  })();

  // What YOUR valuation would cost, priced by the slot rather than here. One
  // read per settled input, not per keystroke.
  const { data: yourDeposit } = useQuery({
    queryKey: ["min-deposit", chainId, slot, parsed.toString()],
    enabled: parsed > 0n,
    queryFn: () => slots.minDepositForBuy(slot, parsed),
  });

  const symbol = isNative(currency) ? "ETH" : "";
  const mine = address?.toLowerCase() === state?.occupant?.toLowerCase();

  // A tenure hook refuses a mid-window buy below ten times the holder's price.
  // Shown BEFORE the attempt, because the alternative is a rejected
  // transaction explaining it afterwards.
  const premium = state?.hookFlags?.beforeBuy
    ? (state.price * 100_000n) / 10_000n
    : undefined;

  async function buy() {
    setError(null);
    try {
      if (!address) throw new Error("Connect a wallet");
      const newPrice = parseUnits(valuation || "0", 18);
      if (newPrice <= 0n) throw new Error("Name a valuation above zero");

      const deposit = await slots.minDepositForBuy(slot, newPrice);
      const params = {
        slot,
        account: address,
        selfAssessedPrice: newPrice,
        depositAmount: deposit,
      };

      // Simulated first, and this is not belt-and-braces. A hook's refusal is a
      // `view` revert carrying its own reason — `BuyoutBelowPremium(1000)`,
      // `TenureNotElapsed(…)` — and that reason survives only a simulation.
      // Sent blind, the same veto arrives as a mined transaction with no reason
      // at all, and the best this panel could say is "it failed".
      setBusy("Checking…");
      await slots.simulateBuy(params);

      // Approval and native value are the client's job — `buy` quotes the total
      // and pays it in whichever currency the slot names.
      setBusy("Buying…");
      await slots.buy(params);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="border border-line bg-lift p-5">
      <h3 className="font-display text-lg leading-none">No. {tokenId}</h3>

      <p className="mt-1 text-xs text-dim">
        Held by{" "}
        {state?.isVacant ? "nobody" : state ? truncate(state.occupant) : "—"}
      </p>

      {/* What it is costing its holder right now — the same six figures the
          explorer shows, so the two never quote a slot differently. */}
      {state && (
        <div className="mt-4">
          <HoldingCost
            price={state.price}
            taxBps={state.taxBps}
            symbol={symbol}
            deposit={state.deposit}
            taxOwed={state.taxOwed}
            escrowLeft={
              state.deposit > state.taxOwed ? state.deposit - state.taxOwed : 0n
            }
            secondsUntilLiquidation={state.secondsUntilLiquidation}
            isVacant={state.isVacant}
            isInsolvent={state.isInsolvent}
            minDepositSeconds={state.minDepositSeconds}
          />
        </div>
      )}

      {mine ? (
        <p className="mt-5 text-xs text-dim">
          You hold this one. Anyone may take it from you at the price above.
        </p>
      ) : (
        <>
          <div className="mt-5 grid gap-1.5">
            <Label htmlFor="buy-valuation">Your valuation</Label>
            <Input
              id="buy-valuation"
              value={valuation}
              onChange={(e) => setValuation(e.target.value)}
              inputMode="decimal"
              placeholder="0.0"
              className="tabular"
            />
          </div>
          <p className="mt-1 text-[11px] leading-snug text-dim">
            You pay the current price, then hold it at yours — and pay rent on
            that number until somebody takes it.
          </p>

          {parsed > 0n && yourDeposit !== undefined && state && (
            <div className="mt-3">
              <WhatItCostsYou
                valuation={parsed}
                taxBps={state.taxBps}
                deposit={yourDeposit}
                minDepositSeconds={state.minDepositSeconds}
                symbol={symbol}
                buyoutPremium={premium}
              />
            </div>
          )}

          {canWrite ? (
            <Button
              type="button"
              size="block"
              className="mt-5"
              disabled={!!busy}
              onClick={buy}
            >
              {busy ?? "Take it"}
            </Button>
          ) : (
            <Button
              type="button"
              size="block"
              variant="outline"
              className="mt-5"
              onClick={openConnect}
            >
              Connect a wallet
            </Button>
          )}
        </>
      )}

      {error && (
        <p
          role="alert"
          className="mt-3 text-[12px] leading-snug text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}
