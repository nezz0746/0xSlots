"use client";

import { findKnownHook } from "@0xslots/contracts/slots";
import { AlertTriangle, Clock, Plug, ShieldCheck } from "lucide-react";
import type { Address } from "viem";
import { zeroAddress } from "viem";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useChain } from "@/context/chain";
import { useNavigation } from "@/context/navigation";
import {
  type CreatedSlot,
  useCreatedSlots,
  useCurrencyMeta,
  useSlotState,
  useSlotsFactory,
} from "@/hooks/slots/use-slots";
import { formatBalance, formatBps, truncateAddress } from "@/utils";

function StatusCell({
  isVacant,
  isInsolvent,
}: {
  isVacant: boolean;
  isInsolvent: boolean;
}) {
  if (isVacant)
    return (
      <Badge variant="outline" className="gap-1">
        <Clock className="size-3" /> Vacant
      </Badge>
    );
  if (isInsolvent)
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="size-3" /> Insolvent
      </Badge>
    );
  return (
    <Badge className="gap-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
      <ShieldCheck className="size-3" /> Occupied
    </Badge>
  );
}

/**
 * One row, reading its own state.
 *
 * Per-row rather than one batched read, because the list is short and each row
 * already needs its currency's decimals — which is a second read keyed on a
 * value only the first read returns.
 */
function SlotRow({ slot }: { slot: CreatedSlot }) {
  const { chainId } = useChain();
  const { push } = useNavigation();
  const { data: state } = useSlotState(slot.address, {
    refetchInterval: 15_000,
  });
  const currency = useCurrencyMeta(slot.currency);
  const hook = findKnownHook(chainId, slot.hook);

  return (
    <TableRow
      className="cursor-pointer"
      onClick={() => push(`/app/slots/${slot.address}`)}
    >
      <TableCell className="text-xs">{truncateAddress(slot.address)}</TableCell>
      <TableCell>
        {state ? (
          <StatusCell
            isVacant={state.isVacant}
            isInsolvent={state.isInsolvent}
          />
        ) : (
          <span className="text-xs text-muted-foreground">…</span>
        )}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {state ? (state.isVacant ? "—" : truncateAddress(state.occupant)) : "…"}
      </TableCell>
      <TableCell className="text-right tabular-nums text-xs">
        {state
          ? `${formatBalance(state.price, currency.decimals)} ${currency.symbol}`
          : "…"}
      </TableCell>
      <TableCell className="text-right tabular-nums text-xs">
        {state ? `${formatBps(Number(state.taxBps))}/mo` : "…"}
      </TableCell>
      <TableCell className="text-xs">
        {slot.currency === zeroAddress ? "ETH" : currency.symbol || "ERC-20"}
      </TableCell>
      <TableCell className="text-xs">
        {slot.hook === zeroAddress ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className="inline-flex items-center gap-1">
            <Plug className="size-3" />
            {hook?.name ?? truncateAddress(slot.hook)}
          </span>
        )}
      </TableCell>
      <TableCell className="text-right text-xs">
        {state && !state.pending.isEmpty ? (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400">
            terms pending
          </Badge>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

export function SlotsTable({
  filter,
  emptyMessage = "No slots yet.",
}: {
  filter?: { recipient?: Address; creator?: Address };
  emptyMessage?: string;
}) {
  const factory = useSlotsFactory();
  const { data, isLoading, error } = useCreatedSlots(filter);

  if (!factory)
    return (
      <div className="border p-8 text-center text-sm text-muted-foreground">
        The Slots protocol is not deployed on this chain.
      </div>
    );

  if (isLoading)
    return (
      <div className="border p-8 text-center text-sm text-muted-foreground">
        Reading slots from the chain…
      </div>
    );

  if (error)
    return (
      <div className="border p-8 text-center text-sm text-destructive">
        Could not read the factory&apos;s logs on this chain.
      </div>
    );

  if (!data?.length)
    return (
      <div className="border p-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );

  return (
    <div className="border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Slot</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Occupant</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">Tax</TableHead>
            <TableHead>Currency</TableHead>
            <TableHead>Hook</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((slot) => (
            <SlotRow key={slot.address} slot={slot} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
