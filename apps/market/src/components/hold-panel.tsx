"use client";

import { depositFor } from "@0xslots/sdk/slots";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Address } from "viem";
import { useAccount, usePublicClient } from "wagmi";

import { BalanceLine } from "@/components/balance-line";
import { type SlotAction, SlotActions } from "@/components/slot-actions";
import { Button } from "@/components/ui/button";
import { ValuationInput } from "@/components/valuation-input";
import { useCurrency, useCurrencyBalance } from "@/hooks/use-currency";
import { useClients, useTokenSlot } from "@/hooks/use-market";
import { amount, isNative } from "@/lib/format";
import {
  describeRunway,
  rentFor,
  runwaySeconds,
  runwayTone,
  TONE_LABEL,
  TONE_TEXT,
} from "@/lib/runway";
import { confirm } from "@/lib/tx";

/** Runway to add, in the app's vocabulary rather than raw token amounts. */
const DAY = 24n * 60n * 60n;
const TOP_UPS = [
  { label: "+1d", seconds: DAY },
  { label: "+1w", seconds: DAY * 7n },
  { label: "+1mo", seconds: 30n * DAY },
] as const;

/** Headroom over the floor, so a slow confirmation cannot undershoot it. */
const SETTLE_MARGIN = 10n * 60n;

/**
 * The holder's position, as one form.
 *
 * ── Why one button and not three ─────────────────────────────────────────
 *
 * Because the contract does not treat them as independent. `selfAssess`
 * re-tests the escrow floor at the NEW price, so raising your valuation — the
 * most ordinary thing a holder wants — reverts unless the escrow was already
 * large enough. This panel used to say so in a warning and disable the button,
 * which made the contract's coupling the holder's problem.
 *
 * Now the shortfall is computed and folded into the same submission, and the
 * SDK orders the calls the only way that works: top up, then reprice, then
 * withdraw. Raising a price quietly buys the escrow it needs; lowering one
 * releases what it frees. What was a trap is a line of copy.
 *
 * ── One transaction, or two ──────────────────────────────────────────────
 *
 * `Slot` inherits OpenZeppelin's Multicall, so an ERC-20 work does both in one
 * transaction. It is not payable, so a native top-up cannot ride in it and
 * goes first, alone — the SDK handles that, and the button says how many
 * confirmations to expect rather than letting a second prompt surprise anyone.
 */
export function HoldPanel({
  chainId,
  tokenId,
  slot,
  currency,
}: {
  chainId: number;
  tokenId: string;
  slot: Address;
  currency: Address;
}) {
  const { address } = useAccount();
  const { slots, canWrite } = useClients(chainId);
  const queryClient = useQueryClient();
  const publicClient = usePublicClient({ chainId });
  const { data: state } = useTokenSlot(chainId, slot);
  const { symbol, decimals } = useCurrency(chainId, currency);
  const balance = useCurrencyBalance(chainId, currency);

  const [price, setPrice] = useState(0n);
  const [addSeconds, setAddSeconds] = useState(0n);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Seeds once from what the work is held at; a typed value is never
  // overwritten by a poll.
  useEffect(() => {
    if (state && price === 0n) setPrice(state.price);
  }, [state, price]);

  // Money the protocol owes this address because a payout could not be pushed
  // to it. Invisible everywhere else, and nobody would think to look.
  const { data: claimable } = useQuery({
    queryKey: ["claimable", chainId, slot, address],
    enabled: !!address,
    refetchInterval: 15_000,
    queryFn: () => slots.withdrawableOf(slot, address as Address),
  });

  const at = (v: bigint) => amount(v, decimals, symbol);
  const taxBps = state?.taxBps ?? 0n;
  const window = state?.minDepositSeconds ?? 0n;

  // Everything is measured against escrow AFTER settlement, because that is
  // what the contract checks: every one of these settles before testing.
  const settled =
    state && state.deposit > state.taxOwed ? state.deposit - state.taxOwed : 0n;

  // Nothing is proposed until something is asked for. Computing the figures
  // unconditionally meant the settle margin always read as a shortfall, so a
  // panel nobody had touched offered to top itself up by ten minutes of rent.
  const dirty = !!state && (price !== state.price || addSeconds > 0n);

  const chosen = rentFor(addSeconds, price, taxBps);
  const floor = depositFor(price, taxBps, window);
  const margin = rentFor(SETTLE_MARGIN, price, taxBps);

  // The whole point of the form: what the NEW price needs that the escrow does
  // not already have. Added silently rather than refused loudly — and only
  // when the price actually went UP, since that is the only direction that can
  // leave the escrow short.
  const raised = !!state && price > state.price;
  const need = floor + margin;
  const shortfall =
    raised && settled + chosen < need ? need - settled - chosen : 0n;
  const topUp = dirty ? chosen + shortfall : 0n;

  // Cutting the price frees escrow. Offered in the same submission, which is
  // the only way it can be taken: `withdraw` tests the floor at the price
  // standing when it runs, so it has to follow the reprice.
  const lowered = !!state && price < state.price;
  const release = lowered && settled > need ? settled - need : 0n;

  const runwayAfter = runwaySeconds(settled + topUp - release, price, taxBps);
  const tone = runwayTone(runwayAfter, window);
  const changed = dirty;
  const native = isNative(currency);
  // A native top-up is its own transaction; the reprice follows it.
  const steps = topUp > 0n && native && price !== state?.price ? 2 : 1;

  async function send(label: string, action: () => Promise<`0x${string}`>) {
    setError(null);
    setBusy(label);
    try {
      const hash = await action();
      setBusy("Confirming…");
      await confirm(publicClient, hash);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["token-slot"] }),
        queryClient.invalidateQueries({ queryKey: ["tokens"] }),
        queryClient.invalidateQueries({ queryKey: ["claimable"] }),
      ]);
      setAddSeconds(0n);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(/rejected|denied/i.test(message) ? "Cancelled" : message);
    } finally {
      setBusy(null);
    }
  }

  const actions: SlotAction[] = [];
  if (state && !state.isVacant && state.collectedTax > 0n)
    actions.push({
      key: "collect",
      label: `Send ${at(state.collectedTax)} rent onward`,
      note: "Rent already charged, waiting in the work. This pays it to the collection's recipient, not to you.",
      run: () => send("Collecting…", () => slots.collect(slot)),
    });
  if (claimable !== undefined && claimable > 0n)
    actions.push({
      key: "claim",
      label: `Claim ${at(claimable)} owed to you`,
      note: "A payout this work could not push to you. It waits until claimed.",
      run: () => send("Claiming…", () => slots.claim(slot, address)),
    });
  actions.push({
    key: "release",
    label: "Release this work",
    note: `It returns to the collection and ${at(settled)} of escrow comes back to you.`,
    destructive: true,
    run: () => send("Releasing…", () => slots.release(slot)),
  });

  return (
    <div className="border border-line bg-lift p-5">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h3 className="text-lg font-semibold leading-none tracking-[-0.02em]">
            No. {tokenId}
          </h3>
          <p className="mt-1 text-xs text-dim">You hold this one</p>
        </div>
        <SlotActions actions={actions} disabled={!canWrite || !!busy} />
      </div>

      <div className="mt-5">
        <ValuationInput
          id="hold-valuation"
          label="Your valuation"
          value={price}
          onChange={setPrice}
          decimals={decimals}
          taxBps={taxBps}
          symbol={symbol}
          disabled={!!busy}
        />
      </div>

      <div className="mt-3">
        <p className="text-[10px] leading-none text-dim">Add runway</p>
        <div className="mt-1.5 flex border border-line">
          {TOP_UPS.map(({ label, seconds }, i) => {
            const on = addSeconds === seconds;
            return (
              <button
                key={label}
                type="button"
                disabled={!!busy}
                // Toggles off, so a chip pressed by mistake is not a commitment.
                onClick={() => setAddSeconds(on ? 0n : seconds)}
                className={`flex-1 py-1.5 text-[12px] transition-colors disabled:opacity-40 ${
                  i > 0 ? "border-l border-line" : ""
                } ${on ? "bg-standing text-paper" : "enabled:hover:bg-paper"}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* The summary: what leaves the wallet, and what it buys. Colour is
          paired with the word beside it, never carrying the meaning alone. */}
      <dl className="mt-4 space-y-1.5 border-y border-line py-3 text-[11px]">
        {topUp > 0n && <Row label="You add" value={at(topUp)} />}
        {/* Only when it is a PART of the total. Alone it restates the row
            above it, which reads as the figure having been counted twice. */}
        {shortfall > 0n && chosen > 0n && (
          <Row
            label="of which the new price needs"
            value={at(shortfall)}
            quiet
          />
        )}
        {release > 0n && (
          <Row label="You take back" value={at(release)} tone="text-standing" />
        )}
        <Row
          label="Rent / month"
          value={at((price * taxBps) / 10_000n)}
          quiet
        />
        <Row
          label="Funded for"
          value={`${describeRunway(runwayAfter)} · ${TONE_LABEL[tone]}`}
          tone={TONE_TEXT[tone]}
        />
      </dl>

      <Button
        type="button"
        size="block"
        className="mt-4"
        disabled={!canWrite || !!busy || !changed || price <= 0n}
        onClick={() =>
          send("Applying…", () =>
            slots.manageTerms(slot, {
              ...(state && price !== state.price ? { newPrice: price } : {}),
              ...(topUp > 0n ? { topUpAmount: topUp } : {}),
              ...(release > 0n ? { withdrawAmount: release } : {}),
            }),
          )
        }
      >
        {busy ??
          (changed
            ? steps > 1
              ? "Apply terms (2 confirmations)"
              : "Apply terms"
            : "Nothing to change")}
      </Button>
      <BalanceLine balance={balance} total={topUp} at={at} />

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

function Row({
  label,
  value,
  tone,
  quiet,
}: {
  label: string;
  value: string;
  tone?: string;
  quiet?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-dim">{label}</dt>
      <dd className={`tabular ${tone ?? (quiet ? "text-dim" : "")}`}>
        {value}
      </dd>
    </div>
  );
}
