"use client";

import { formatDistanceToNow } from "date-fns";
import { useMemo } from "react";
import type { Address } from "viem";
import { EventTypeBadge } from "@/components/event-type-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useChain } from "@/context/chain";
import { NavLink } from "@/context/navigation";
import { useSlotEvents } from "@/hooks/use-explorer";
import { normalizeEvents } from "@/lib/normalize-events";
import { truncateAddress } from "@/utils";

/**
 * One slot's history, newest first.
 *
 * Reads the indexer rather than the chain: this is the one thing on the page a
 * node cannot answer without replaying logs, and the one thing that does not
 * need to be correct to the second. Solvency and the runway stay on the chain
 * reads next door, for the opposite reason — nothing is emitted when a slot
 * crosses into insolvency, so no indexed row could ever be right about it.
 */
export function SlotEventHistory({ slot }: { slot: Address }) {
  const { explorerUrl } = useChain();
  const { data, isLoading, error } = useSlotEvents(slot);

  const events = useMemo(() => (data ? normalizeEvents(data) : []), [data]);

  if (isLoading)
    return (
      <p className="px-4 py-6 text-center text-sm text-muted-foreground">
        Reading this slot&apos;s history…
      </p>
    );

  if (error)
    return (
      <p className="px-4 py-6 text-center text-sm text-muted-foreground">
        The indexer is unreachable, so history is unavailable. Everything else
        on this page is read straight from the chain and is unaffected.
      </p>
    );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Type</TableHead>
          <TableHead>Actor</TableHead>
          <TableHead>Detail</TableHead>
          <TableHead>Time</TableHead>
          <TableHead>Tx</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {events.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={5}
              className="py-6 text-center text-muted-foreground"
            >
              No activity yet
            </TableCell>
          </TableRow>
        ) : (
          events.map((ev) => (
            <TableRow key={ev.id}>
              <TableCell>
                <EventTypeBadge type={ev.type} />
              </TableCell>
              <TableCell className="text-xs">
                {ev.actor ? (
                  <NavLink
                    href={`/app/recipient/${ev.actor}`}
                    className="text-primary hover:underline"
                  >
                    {truncateAddress(ev.actor)}
                  </NavLink>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {ev.detail}
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {formatDistanceToNow(new Date(ev.timestamp * 1000), {
                  addSuffix: true,
                })}
              </TableCell>
              <TableCell>
                <a
                  href={`${explorerUrl}/tx/${ev.tx}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline"
                >
                  {truncateAddress(ev.tx)}
                </a>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
