"use client";

import { formatDistanceToNow } from "date-fns";
import { EventTypeBadge } from "@/components/event-type-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NavLink } from "@/context/navigation";
import type { UnifiedEvent } from "@/lib/normalize-events";
import { truncateAddress } from "@/utils";

export { normalizeEvents as normalizeSlotActivity } from "@/lib/normalize-events";

export function SlotEventHistory({
  events,
  explorerUrl,
}: {
  events: UnifiedEvent[];
  explorerUrl: string;
}) {
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
              className="text-center text-muted-foreground py-6"
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
                    href={`/recipient/${ev.actor}`}
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
              <TableCell className="text-muted-foreground whitespace-nowrap">
                {formatDistanceToNow(new Date(ev.timestamp * 1000), {
                  addSuffix: true,
                })}
              </TableCell>
              <TableCell>
                <a
                  href={`${explorerUrl}/tx/${ev.tx}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline text-xs"
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
