"use client";

import { formatDistanceToNow } from "date-fns";
import { EventTypeBadge } from "@/components/event-type-badge";
import { TablePagination, usePagination } from "@/components/table-pagination";
import { TableEmpty, TableSkeleton } from "@/components/table-states";
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
import { useRecentEvents } from "@/hooks/use-v3";
import { normalizeEvents } from "@/lib/normalize-events";
import { truncateAddress } from "@/utils";

export function EventsTable() {
  const { data, isLoading } = useRecentEvents();
  const { explorerUrl } = useChain();
  const events = normalizeEvents(data);
  const { page, setPage, pageSize, setPageSize, totalPages, paged } =
    usePagination(events);

  if (isLoading) return <TableSkeleton />;
  if (events.length === 0) return <TableEmpty message="No events yet" />;

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Slot</TableHead>
            <TableHead>Actor</TableHead>
            <TableHead>Detail</TableHead>
            <TableHead>Time</TableHead>
            <TableHead>Tx</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paged.map((ev) => (
            <TableRow key={ev.id}>
              <TableCell>
                <EventTypeBadge type={ev.type} />
              </TableCell>
              <TableCell>
                <NavLink
                  href={`/app/slots/${ev.slot}`}
                  className="text-primary hover:underline"
                >
                  {truncateAddress(ev.slot ?? "")}
                </NavLink>
              </TableCell>
              <TableCell>
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
                  className="text-primary hover:underline"
                >
                  {truncateAddress(ev.tx)}
                </a>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <TablePagination
        page={page}
        totalPages={totalPages}
        pageSize={pageSize}
        total={events.length}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
    </>
  );
}
