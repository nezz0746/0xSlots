"use client";

import type { SlotState } from "@0xslots/sdk/slots";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Banknote,
  ChevronDown,
  Clock,
  Flame,
  HandCoins,
  Loader2,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import type { Address } from "viem";
import { useAccount } from "wagmi";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { CurrencyMeta } from "@/hooks/slots/use-slots";
import { useWithdrawable } from "@/hooks/slots/use-slots";
import type { useSlotsAction } from "@/hooks/slots/use-slots-action";
import type { LiveAccrual } from "@/hooks/use-live-accrual";
import { cn } from "@/lib/utils";
import { formatBalance } from "@/utils";
import { BuySection } from "./buy-section";
import { ManageTerms } from "./manage-terms";
import { PendingUpdatesPanel, type PendingViewer } from "./pending-updates";
import { formatRunway } from "./slot-facts";
import { UserCurrencyBalance } from "./user-balance";

type Actions = ReturnType<typeof useSlotsAction>;

/**
 * The valuation card: the facts, then the form that acts on them.
 *
 * The ordering is the design. Price, deposit and the three counting figures sit
 * DIRECTLY above the valuation form, in one card, because they are the inputs
 * to the single decision this column exists for — what to value the slot at,
 * and whether the deposit behind it survives. Split into a separate panel
 * elsewhere on the page, the reader has to hold "liquidation in 40 minutes" in
 * their head while scrolling to the field it should change.
 *
 * Everything that merely describes the slot — its terms, its hook, its history
 * — lives in the tabbed column beside this one. This card is the part you act
 * with.
 */
export function ActionsCard({
  slot,
  state,
  currency,
  accrual,
  actions,
  viewer,
  nowSeconds,
  isManager,
  isOccupant,
}: {
  slot: Address;
  state: SlotState;
  currency: CurrencyMeta;
  accrual: LiveAccrual;
  actions: Actions;
  viewer: PendingViewer;
  nowSeconds: number;
  isManager: boolean;
  isOccupant: boolean;
}) {
  const { address, isConnected } = useAccount();
  const [moreOpen, setMoreOpen] = useState(false);
  const { decimals, symbol } = currency;
  const amount = (v: bigint) => `${formatBalance(v, decimals)} ${symbol}`;

  /**
   * What a `collect` would actually pay out.
   *
   * `collect()` settles before flushing, so the figure is the already-settled
   * bucket PLUS whatever `_settle` can still take from the deposit. Gating on
   * `collectedTax` alone hides the button on any slot untouched since
   * occupancy; gating on `taxOwed` alone strands tax already settled onto a
   * slot that has since been vacated.
   *
   * Off the interpolated accrual, which is already capped at the deposit, so it
   * climbs in step with the tax row above rather than sitting on whatever the
   * last read happened to catch.
   */
  const collectable = state.collectedTax + accrual.taxOwed;
  /**
   * Money the protocol credited to `address` because a push payment could not
   * reach them — a reverting `receive`, a blocklisting token. Nothing else in
   * the UI reveals that it is sitting there, so it belongs somewhere always
   * reachable rather than in a panel that only renders for some viewers.
   */
  const { data: withdrawable } = useWithdrawable(slot, address);
  const isRecipient =
    !!address && address.toLowerCase() === state.recipient.toLowerCase();

  /**
   * Whether the chevron is worth showing at all — the same condition the panel
   * uses, named once so the trigger can never appear over an empty disclosure.
   */
  const hasMoreActions =
    isOccupant ||
    collectable > 0n ||
    !state.isVacant ||
    (withdrawable ?? 0n) > 0n;

  /**
   * The disclosure, as a square beside the primary button.
   *
   * It was a full-width bar under the form, which read as a fourth thing to do
   * rather than as "there is more". Beside the button it is obviously an
   * attachment to it, and costs no vertical space at all.
   */
  const moreTrigger = (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-expanded={moreOpen}
      aria-label={moreOpen ? "Hide more actions" : "More actions"}
      title={moreOpen ? "Hide more actions" : "More actions"}
      onClick={() => setMoreOpen((v) => !v)}
      className="shrink-0"
    >
      <ChevronDown
        aria-hidden
        className={cn("size-4 transition-transform", moreOpen && "rotate-180")}
      />
    </Button>
  );

  const role = isOccupant
    ? {
        label: "You hold this",
        badge: "border-violet-500/40 text-violet-600 dark:text-violet-400",
      }
    : isManager
      ? {
          label: "You manage this",
          badge: "border-rose-500/40 text-rose-600 dark:text-rose-400",
        }
      : null;

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/50 px-3 py-3">
        <h2 className="text-sm font-semibold">
          {state.isVacant ? "Vacant slot" : `Valuation: ${amount(state.price)}`}
        </h2>
        {role && (
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[11px] font-medium",
              role.badge,
            )}
          >
            {role.label}
          </span>
        )}
      </div>

      {state.isVacant ? (
        <div className="border-b p-4">
          <p className="text-sm text-muted-foreground">
            Nobody holds this slot, so there is no escrow and no tax accruing.
            Claiming it costs the deposit alone.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5 border-b p-4 text-sm">
          <div className="flex justify-between">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Banknote className="size-3" /> Deposit
            </span>
            <span className="tabular-nums">{amount(state.deposit)}</span>
          </div>

          {/* These three count rather than sit. The figures come from the
              interpolation, and the tax row tints for a beat each time it
              moves — which is what makes it read as accruing rather than as a
              number that happens to differ from the last time you looked. */}
          <div className="flex justify-between">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <HandCoins className="size-3" /> Tax owed
            </span>
            <span
              className={cn(
                "tabular-nums transition-colors duration-500",
                accrual.rising && "text-emerald-600 dark:text-emerald-500",
              )}
            >
              {amount(accrual.taxOwed)}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Wallet className="size-3" /> Net balance
            </span>
            <span
              className={cn(
                "font-bold tabular-nums",
                accrual.insolvent && "text-destructive",
              )}
            >
              {amount(accrual.remaining)}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="size-3" /> Liquidation in
            </span>
            <span
              className={cn(
                "tabular-nums",
                accrual.insolvent && "font-bold text-destructive",
              )}
            >
              {accrual.insolvent
                ? "NOW"
                : formatRunway(accrual.secondsUntilLiquidation)}
            </span>
          </div>

          {accrual.insolvent && (
            <div className="border border-destructive bg-destructive/10 py-1 text-center text-xs font-bold text-destructive">
              INSOLVENT — ANYONE MAY EVICT
            </div>
          )}
        </div>
      )}

      {isConnected && (
        <UserCurrencyBalance currency={state.currency} meta={currency} />
      )}

      {/* Before the form, not after it: on this column a queued change is not a
          fact about the slot, it is a term of the transaction the form is about
          to send. */}
      <PendingUpdatesPanel
        slot={slot}
        state={state}
        viewer={viewer}
        nowSeconds={nowSeconds}
        actions={isManager ? actions : undefined}
        bare
      />

      <div className="space-y-3 p-4">
        {isOccupant ? (
          <ManageTerms
            slot={slot}
            state={state}
            currency={currency}
            accrual={accrual}
            actions={actions}
            bare
            trailing={hasMoreActions ? moreTrigger : undefined}
          />
        ) : (
          <BuySection
            slot={slot}
            state={state}
            currency={currency}
            actions={actions}
            bare
            trailing={hasMoreActions ? moreTrigger : undefined}
          />
        )}

        {/* Reachable, but not competing with the form.
            These were full-width buttons stacked under the terms, which gave
            giving up the slot — and liquidating someone else's — the same
            weight as repricing. Folded behind the chevron they read as what
            they are: things you occasionally need, not what the panel is for.

            Rendered BELOW both forms rather than inside either, which is why
            `moreOpen` lives on this card: the same disclosure has to serve the
            occupant's form and the buyer's. */}
        {hasMoreActions && moreOpen && (
          <div className="space-y-2 border p-2.5">
            {/* `collect()` is permissionless — anyone may flush settled tax to
                the recipient. The label only reflects whether the caller is the
                one getting paid. */}
            {collectable > 0n && (
              <Button
                variant="outline"
                className="w-full"
                disabled={actions.busy}
                onClick={() => actions.collect(slot)}
              >
                {actions.busy && actions.activeAction === "Collect tax" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <HandCoins className="mr-1 size-4" />
                    {isRecipient ? "Collect tax" : "Distribute tax"} (
                    {formatBalance(collectable, decimals)} {symbol})
                  </>
                )}
              </Button>
            )}

            {withdrawable !== undefined && withdrawable > 0n && (
              <Button
                variant="outline"
                className="w-full"
                disabled={actions.busy}
                onClick={() => actions.claim(slot, address)}
              >
                {actions.busy && actions.activeAction === "Claim" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <ArrowDownToLine className="mr-1 size-4" />
                    Claim {formatBalance(withdrawable, decimals)} {symbol}
                  </>
                )}
              </Button>
            )}

            {/* Behind a confirmation. It is the one action here that cannot be
                undone by doing it again. */}
            {isOccupant && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    className="w-full"
                    disabled={actions.busy}
                  >
                    {actions.busy && actions.activeAction === "Release slot" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <>
                        <ArrowUpFromLine className="mr-1 size-4" />
                        Release slot
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Release this slot?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This gives up your occupancy and returns your remaining
                      deposit. You lose your position and the slot becomes
                      claimable by anyone straight away.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => actions.release(slot)}>
                      Release
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {/* Permissionless, but only once the deposit is actually gone.
                Disabled rather than hidden while solvent, so the rule is
                visible instead of the button being a mystery that appears one
                day.

                Two verbs, because the outcomes differ and the difference is the
                whole reason "no bounty" is honest: `liquidate` evicts and
                leaves the slot VACANT — you then race everyone watching the
                mempool for it — while evict-and-take seats you in the same
                transaction.

                The second is no longer a function on the slot. `Slot.
                liquidateAndTake` was removed under audit, and the composition
                lives outside the core: the periphery `SlotTaker` on a native
                slot, the slot's own `multicall` on an ERC-20 one. Its cost
                still comes from a quote rather than from `price()` — from
                `SlotTaker.quote(slot, account, deposit)` now — because the
                eviction runs first and there is nobody left to buy out. */}
            {!state.isVacant && !isOccupant && (
              <div className="space-y-2 border-t pt-2">
                <Button
                  variant="destructive"
                  className="w-full"
                  // The interpolated figure, so it unlocks the moment the
                  // deposit runs out rather than on the next manual refresh.
                  disabled={actions.busy || !accrual.insolvent}
                  title={
                    accrual.insolvent
                      ? "The occupant has run out of deposit"
                      : "Only once the occupant's deposit runs out"
                  }
                  onClick={() => actions.liquidate(slot)}
                >
                  {actions.busy && actions.activeAction === "Liquidate" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      <Flame className="mr-1 size-4" />
                      Liquidate
                    </>
                  )}
                </Button>
                <p className="text-[10px] leading-snug text-muted-foreground">
                  {accrual.insolvent
                    ? "Liquidating leaves the slot vacant for anyone. To evict and take it in one transaction, set your price above and use Buy — it routes through the SlotTaker and charges the deposit alone, quoted from there, since there is nobody left to buy out."
                    : "Available once the occupant's deposit is spent. There is no bounty; the reward is that the slot becomes takeable."}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
