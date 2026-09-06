"use client";

import { depositFor } from "@0xslots/sdk/slots";
import { useWalletModal } from "@0xslots/wallet";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Address } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { BalanceLine } from "@/components/balance-line";
import { HoldingCost } from "@/components/holding-cost";
import { RunwayChoice } from "@/components/runway-choice";
import { type SlotAction, SlotActions } from "@/components/slot-actions";
import { Button } from "@/components/ui/button";
import { ValuationInput } from "@/components/valuation-input";
import { useCurrency, useCurrencyBalance } from "@/hooks/use-currency";
import { useClients, useTokenSlot } from "@/hooks/use-market";
import { amount, truncate } from "@/lib/format";
import { confirm } from "@/lib/tx";

/**
 * Buying a work IS buying its slot.
 *
 * Which is why this asks for a NEW valuation rather than showing a price:
 * taking the slot means declaring what it is worth to you and paying rent on
 * that number from the moment you hold it. A marketplace that hid this behind
 * a "Buy" button would be selling something other than what arrives.
 *
 * Both controls are the explorer's, and deliberately: this is the same
 * decision made in two places, and a bidder who has used one should not have
 * to learn the other. The valuation steps compound so a bid can be made by
 * feel; the escrow is chosen as runway, because that is the unit it is
 * actually measured in.
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
  const queryClient = useQueryClient();
  const publicClient = usePublicClient({ chainId });
  const { data: state } = useTokenSlot(chainId, slot);
  const { symbol, decimals } = useCurrency(chainId, currency);
  const balance = useCurrencyBalance(chainId, currency);

  const [valuation, setValuation] = useState(0n);
  const [mult, setMult] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Opened on a work, the field starts at what it is worth now. A bid is
  // almost always a move from the standing price rather than a number thought
  // up from nothing, and the percentage steps only mean something off a base.
  useEffect(() => {
    if (state && valuation === 0n) setValuation(state.price);
    // Only ever seeds; a typed value is never overwritten by a poll.
  }, [state, valuation]);

  const at = (v: bigint) => amount(v, decimals, symbol);
  const taxBps = state?.taxBps ?? 0n;
  const window = state?.minDepositSeconds ?? 0n;

  // Mirrors `SlotMath.depositFor`, pinned against the contract in the SDK's
  // tests. Computed rather than read so the three options price instantly;
  // the amount actually sent is asked of the slot at submit time.
  const escrowFor = (m: number) =>
    window > 0n ? depositFor(valuation, taxBps, window * BigInt(m)) : 0n;
  const escrow = escrowFor(mult);

  /**
   * What the buy will actually charge, asked of the slot.
   *
   * NOT the valuation plus the escrow, which is what this used to show and is
   * wrong in every case. `quoteBuy` is
   * `(occupied ? currentPrice : 0) + deposit + arrearsOf[buyer]`: the price
   * paid out is the one the SITTING holder declared, not the one being named
   * here. Raising your valuation raises your escrow and your rent — it does
   * not raise what you hand the person you are taking it from — and on a
   * vacant work there is nobody to pay, so the charge is the escrow alone.
   *
   * The arrears term is why this is read rather than derived: tax an earlier
   * occupancy could not cover follows the ACCOUNT, and is charged again on
   * re-entry. Nothing on the client knows about it.
   */
  const { data: quoted } = useQuery({
    queryKey: ["quote-buy", chainId, slot, address, escrow.toString()],
    enabled: !!address && !!state && valuation > 0n,
    queryFn: () => slots.quoteBuy(slot, address as Address, escrow),
  });

  // Until the quote lands, the same sum without the arrears term — right for
  // everyone who has never run a deposit dry, and never higher than the truth.
  const priceOut = state?.isVacant ? 0n : (state?.price ?? 0n);
  const payable = quoted ?? priceOut + escrow;
  const arrears = quoted !== undefined ? quoted - priceOut - escrow : 0n;
  const short = balance !== undefined && payable > balance;

  // A tenure hook refuses a mid-window buy below ten times the holder's price.
  // Shown BEFORE the attempt, because the alternative is a rejected
  // transaction explaining it afterwards.
  const premium = state?.hookFlags?.beforeBuy
    ? (state.price * 100_000n) / 10_000n
    : undefined;

  async function act(label: string, action: () => Promise<`0x${string}`>) {
    setError(null);
    setBusy(label);
    try {
      const hash = await action();
      setBusy("Confirming…");
      await confirm(publicClient, hash);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["token-slot"] }),
        queryClient.invalidateQueries({ queryKey: ["tokens"] }),
      ]);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(/rejected|denied/i.test(message) ? "Cancelled" : message);
    } finally {
      setBusy(null);
    }
  }

  async function buy() {
    setError(null);
    try {
      if (!address) throw new Error("Connect a wallet");
      if (valuation <= 0n) throw new Error("Name a valuation above zero");

      // The floor is the slot's to state. `escrowFor` is the same formula, but
      // the number sent should come from the contract that will check it.
      const floor = await slots.minDepositForBuy(slot, valuation);
      const deposit = escrow > floor ? escrow : floor;
      const params = {
        slot,
        account: address,
        selfAssessedPrice: valuation,
        depositAmount: deposit,
      };

      // Simulated first, and this is not belt-and-braces. A hook's refusal is
      // a `view` revert carrying its own reason — `BuyoutBelowPremium(1000)`,
      // `TenureNotElapsed(…)` — and that reason survives only a simulation.
      // Sent blind, the same veto arrives as a mined transaction with no
      // reason at all, and the best this panel could say is "it failed".
      setBusy("Checking…");
      await slots.simulateBuy(params);

      setBusy("Buying…");
      const hash = await slots.buy(params);
      setBusy("Confirming…");
      await confirm(publicClient, hash);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["token-slot"] }),
        queryClient.invalidateQueries({ queryKey: ["tokens"] }),
      ]);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  // What anyone may do to a work they do not hold. Both are permissionless and
  // neither pays the presser, which is why each says so.
  const actions: SlotAction[] = [];
  if (state?.isInsolvent)
    actions.push({
      key: "liquidate",
      label: "Evict the holder",
      note: "Their escrow has run out, so the work can be vacated. This pays you nothing — it opens the work for anyone to take.",
      run: () => act("Evicting…", () => slots.liquidate(slot)),
    });
  if (state && state.collectedTax > 0n)
    actions.push({
      key: "collect",
      label: `Send ${at(state.collectedTax)} rent onward`,
      note: "Rent already charged, waiting in the work. This pays it to the collection's recipient, not to you.",
      run: () => act("Collecting…", () => slots.collect(slot)),
    });

  return (
    <div className="border border-line bg-lift p-5">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h3 className="text-lg font-semibold leading-none tracking-[-0.02em]">
            No. {tokenId}
          </h3>
          <p className="mt-1 text-xs text-dim">
            Held by{" "}
            {state?.isVacant
              ? "nobody"
              : state
                ? truncate(state.occupant)
                : "—"}
          </p>
        </div>
        <SlotActions actions={actions} disabled={!canWrite || !!busy} />
      </div>

      {/* What it is costing its holder right now. */}
      {state && (
        <div className="mt-4">
          <HoldingCost
            price={state.price}
            taxBps={state.taxBps}
            symbol={symbol}
            decimals={decimals}
            secondsUntilLiquidation={state.secondsUntilLiquidation}
            isVacant={state.isVacant}
            isInsolvent={state.isInsolvent}
            minDepositSeconds={state.minDepositSeconds}
          />
        </div>
      )}

      <>
        <div className="mt-5">
          <ValuationInput
            id="buy-valuation"
            label="Your valuation"
            value={valuation}
            onChange={setValuation}
            decimals={decimals}
            taxBps={taxBps}
            symbol={symbol}
            disabled={!!busy}
            below={<BalanceLine balance={balance} total={payable} at={at} />}
          />
        </div>

        {window > 0n && (
          <div className="mt-3">
            <RunwayChoice
              base={window}
              mult={mult}
              onPick={setMult}
              amountFor={escrowFor}
              decimals={decimals}
              symbol={symbol}
              disabled={!!busy || valuation <= 0n}
            />
          </div>
        )}

        {/* No second strip of the same three. The escrow control above
              already names the runway, the rate has not moved, and the button
              names the total — so all that is left to say is how the total
              splits, which is the one thing neither of them shows. */}
        {valuation > 0n && (
          <p className="mt-3 text-[11px] leading-snug text-dim">
            <span className={short ? "text-ebbing" : "text-standing"}>
              {at(payable)}
            </span>{" "}
            in total:{" "}
            {priceOut > 0n
              ? `${at(priceOut)} to the holder, ${at(escrow)} escrow you get back`
              : `${at(escrow)} escrow, and nobody to pay — this one is unheld`}
            {arrears > 0n && `, ${at(arrears)} tax you still owe this work`}.
          </p>
        )}

        {premium !== undefined && premium > 0n && (
          <p className="mt-3 text-[11px] leading-snug text-waning">
            Inside its window this work cannot be taken below {at(premium)}, ten
            times the holder&apos;s own price.
          </p>
        )}

        {canWrite ? (
          <Button
            type="button"
            size="block"
            className="mt-4"
            disabled={!!busy || valuation <= 0n || short}
            onClick={buy}
          >
            {busy ??
              (valuation > 0n
                ? `Take it for ${at(payable)}`
                : "Name a valuation")}
          </Button>
        ) : (
          <Button
            type="button"
            size="block"
            variant="outline"
            className="mt-4"
            onClick={openConnect}
          >
            Connect a wallet
          </Button>
        )}
      </>

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
