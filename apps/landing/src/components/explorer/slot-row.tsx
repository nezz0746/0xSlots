"use client";

import { findKnownHook } from "@0xslots/contracts/slots";
import { isNativeCurrency, NATIVE_CURRENCY } from "@0xslots/sdk";
import { formatDistanceToNow } from "date-fns";
import { TriangleAlert } from "lucide-react";
import type { Address } from "viem";
import { AccountTypeIcon } from "@/components/account-type-icon";
import { MutabilityChip } from "@/components/detail-group";
import { EnsAddress } from "@/components/ens-address";
import { SlotStatusBadge } from "@/components/slot-status-badge";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useChain } from "@/context/chain";
import { useSlotState } from "@/hooks/slots/use-slots";
import type { ExplorerSlot } from "@/hooks/use-explorer";
import { formatPrice, truncateAddress } from "@/utils";

/**
 * One row of the slots table.
 *
 * Its own component because hooks cannot be called inside the parent's `.map()`
 * — and this row calls two: the indexed row it is handed, plus a LIVE chain
 * read of the same slot.
 *
 * Both, deliberately. The indexer is what makes the list filterable, sortable
 * and pageable across thousands of rows, and it is authoritative for everything
 * that only changes when an event fires. It cannot answer one question the row
 * has to answer: solvency. `isInsolvent` is a function of `block.timestamp`
 * against the deposit and moves while nothing whatsoever happens on chain, so
 * no event exists for the indexer to have caught. A row that reported occupancy
 * from the indexer alone would show a comfortable occupant who is in fact
 * liquidatable right now.
 *
 * Indexed values are otherwise read directly. This used to reconcile them
 * against a scheduled transfer whose boundary had passed, so that the occupant
 * and the price could not disagree with each other; epoch scheduling is gone
 * and a buy is indexed the moment it lands.
 */
export function SlotRow({
  slot,
  onSelect,
}: {
  slot: ExplorerSlot;
  onSelect: (id: string) => void;
}) {
  const { chainId } = useChain();
  // Slower than the detail page's 5s: this is a list, and a stale-by-seconds
  // solvency badge on a row you are scrolling past costs nothing.
  const { data: state } = useSlotState(slot.id as Address, {
    refetchInterval: 20_000,
  });

  const occupant = slot.occupant ?? null;
  const account = slot.occupantAccountRef;
  const insolvent = state?.isInsolvent ?? false;

  /**
   * Native ETH has no ERC-20 to read a symbol from, so the indexer stores null
   * and this cell rendered blank. The indexer now names it, but that only
   * applies to rows written after a reindex — existing ones keep their nulls,
   * so the fallback stays. `NATIVE_CURRENCY` rather than a literal "ETH":
   * the chain-read path resolves native the same way, and one source of truth
   * beats two.
   */
  const currencySymbol =
    slot.currencyRef?.symbol ??
    (isNativeCurrency(slot.currency as Address)
      ? NATIVE_CURRENCY.symbol
      : null);

  const decimals = slot.currencyRef?.decimals ?? 18;
  const knownHook = findKnownHook(chainId, slot.hook as Address | undefined);
  const pending = slot.pendingHasTax || slot.pendingHasHook;

  return (
    <TableRow className="cursor-pointer" onClick={() => onSelect(slot.id)}>
      <TableCell>
        <span className="inline-flex items-center gap-1.5">
          <AccountTypeIcon
            type={slot.recipientAccountRef?.type ?? "EOA"}
            className="h-3 w-3"
          />
          <EnsAddress address={slot.recipient} />
        </span>
      </TableCell>

      <TableCell className="text-xs">
        <div className="flex items-center gap-1.5">
          {occupant ? (
            <>
              <span className="inline-flex items-center gap-1.5">
                {account && (
                  <AccountTypeIcon type={account.type} className="h-3 w-3" />
                )}
                {truncateAddress(occupant)}
              </span>
              {/* Only ever rendered for an occupied slot: an empty slot cannot
                  be insolvent, and the VACANT badge below already says all
                  there is to say about it. */}
              {insolvent && <SlotStatusBadge occupant={occupant} insolvent />}
            </>
          ) : (
            <Badge variant="secondary" className="text-[10px]">
              VACANT
            </Badge>
          )}
        </div>
      </TableCell>

      <TableCell className="text-right text-xs whitespace-nowrap">
        <span className="font-bold">
          {occupant ? formatPrice(slot.price, decimals) : "0"}
        </span>
        <span className="text-muted-foreground text-[10px] ml-1">
          {currencySymbol}
        </span>
        <span className="text-muted-foreground text-[10px] ml-1">
          ({Number(slot.taxBps) / 100}%/mo)
        </span>
      </TableCell>

      {/* Was "Utility", and listed the slot's module. There is exactly one hook
          per slot now, so this names it rather than counting a gallery. No hook
          is a perfectly ordinary configuration — the plain Harberger slot — so
          it reads as a dash, not as a gap. */}
      <TableCell className="text-xs text-muted-foreground">
        {slot.hook ? (
          <span className="inline-flex items-center gap-1 text-foreground">
            {/* A filled dot, not a word: the column is scanned down, and
                "attached" repeated forty times is noise where a mark is a
                pattern. Colour carries nothing on its own — the name beside it
                is the reading. */}
            <span
              aria-hidden
              className="size-1.5 shrink-0 rounded-full bg-foreground/60"
            />
            {knownHook?.name ?? truncateAddress(slot.hook)}
            {/* `after` callbacks that reverted and were swallowed. Nothing on
                chain will ever tell this hook's users that it is broken. */}
            {(slot.hookRef?.failedCallCount ?? 0) > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <TriangleAlert className="size-3 text-red-600" />
                </TooltipTrigger>
                <TooltipContent>
                  {slot.hookRef?.failedCallCount} swallowed hook failure
                  {slot.hookRef?.failedCallCount === 1 ? "" : "s"}
                </TooltipContent>
              </Tooltip>
            )}
          </span>
        ) : (
          "—"
        )}
      </TableCell>

      {/* The same padlocks the slot detail uses, and for the same reason: a
          closed lock is a GUARANTEE, so both states are always drawn. The old
          badges appeared only when mutable, which made "fixed forever" and
          "this table did not check" render identically — as nothing. */}
      <TableCell>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            Tax
            <MutabilityChip mutable={slot.mutableTax} what="tax rate" />
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            Hook
            <MutabilityChip mutable={slot.mutableHook} what="hook" />
          </span>
          {/* A queued change, already proposed and waiting out its delay. The
              loudest flag here, because it is the one with a deadline. */}
          {pending && (
            <Badge className="text-[9px] bg-amber-500/15 text-amber-700 dark:text-amber-400">
              PENDING
            </Badge>
          )}
        </div>
      </TableCell>

      <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
        {formatDistanceToNow(new Date(Number(slot.createdAt) * 1000), {
          addSuffix: true,
        })}
      </TableCell>
    </TableRow>
  );
}
