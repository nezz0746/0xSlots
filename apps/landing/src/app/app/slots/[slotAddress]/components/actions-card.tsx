"use client";

import type { SlotState } from "@0xslots/sdk/slots";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronDown,
  Flame,
  HandCoins,
  Loader2,
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

type Actions = ReturnType<typeof useSlotsAction>;

/**
 * The valuation card: the facts, then the form that acts on them.
 *
 * Only the things you ACT with. The escrow figures — deposit, tax owed, escrow
 * left, runway — used to sit above the form as well as in the info tab, so the
 * page showed the same six numbers twice and this column had to be scrolled
 * past to reach the button. They live in the tab now; this card is the field
 * and the actions, and nothing else.
 */
export function ActionsCard({
  slot,
  state,
  currency,
  accrual,
  actions,
  isManager,
  isOccupant,
}: {
  slot: Address;
  state: SlotState;
  currency: CurrencyMeta;
  accrual: LiveAccrual;
  actions: Actions;
  isManager: boolean;
  isOccupant: boolean;
}) {
  const { address, isConnected } = useAccount();
  const [moreOpen, setMoreOpen] = useState(false);
  const { decimals, symbol } = currency;

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
        {/* Named for the action, not the figure. It read `Valuation: 0.02 ETH`,
            which was the third place that number appeared on the page — the
            info tab leads with it and the field below IS it. */}
        <h2 className="text-sm font-semibold">
          {isOccupant
            ? "Your position"
            : state.isVacant
              ? "Claim this slot"
              : "Take this slot"}
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

      {/* INSOLVENT stays. It is not a figure — the figures moved to the info
          tab — it is the one piece of state that changes what the buttons below
          do, and it belongs beside them. */}
      {accrual.insolvent && !state.isVacant && (
        <div className="border-b border-destructive bg-destructive/10 px-4 py-1.5 text-center text-xs font-bold text-destructive">
          INSOLVENT — ANYONE MAY EVICT
        </div>
      )}

      <div className="space-y-3 p-4">
        {isOccupant ? (
          <ManageTerms
            slot={slot}
            state={state}
            currency={currency}
            accrual={accrual}
            actions={actions}
            bare
            showBalance={isConnected}
            trailing={hasMoreActions ? moreTrigger : undefined}
          />
        ) : (
          <BuySection
            slot={slot}
            state={state}
            currency={currency}
            actions={actions}
            bare
            showBalance={isConnected}
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
                mempool for it.

                Evict-and-take in one transaction is gone. `Slot.
                liquidateAndTake` was removed under audit, and the periphery
                that replaced it has been removed too. Both halves are still
                public, so the composition is available to anyone who wants it —
                including through the slot's own `multicall` on an ERC-20 slot —
                it is just not something this app offers as one button. */}
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
                    ? "Liquidating leaves the slot vacant for anyone — including whoever is watching the mempool. To hold it yourself, liquidate and then Buy the vacant slot, which costs the deposit alone once there is no occupant left to buy out."
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
