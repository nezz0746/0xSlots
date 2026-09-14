"use client";

import { useEffect, useState } from "react";
import { SlotRow } from "@/components/explorer/slot-row";
import { TablePagination } from "@/components/table-pagination";
import { TableEmpty, TableSkeleton } from "@/components/table-states";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useNavigation } from "@/context/navigation";
import {
  type SlotFilters,
  useChainClock,
  useExplorerSlots,
} from "@/hooks/use-explorer";

/**
 * A fixed-filter, paginated list of slots, read from the indexer.
 *
 * ── What this replaces, and why ─────────────────────────────────────────────
 *
 * The file at this path used to read `SlotCreated` logs straight off the chain
 * and then ask every row for its own state. That was never the design — the
 * profile page was subgraph-backed until the hook-protocol port, when the
 * generated GraphQL types still described the retired protocol and the
 * quickest way forward was to read logs. The stopgap outlived its reason.
 *
 * It cost what an unindexed listing always costs. `getLogs` from the factory's
 * deployment block, on a timer, in every open tab, returning EVERY slot ever
 * created with no way to page or sort — so the page got slower and more
 * expensive with each slot the protocol gained, which is the opposite of what
 * a listing should do.
 *
 * ── The split this restores ─────────────────────────────────────────────────
 *
 * The indexer answers what happened; the chain answers what is true right now.
 * A paginated listing is entirely the former, so nothing here touches an RPC —
 * including the solvency badge, which is arithmetic over indexed columns (see
 * `isInsolventAt`). The chain is still read where it has to be: on the single
 * slot page, where it is one slot, one reader, and figures that move with
 * `block.timestamp` between events.
 */
export function SlotList({
  filter,
  emptyMessage,
  pageSize: initialPageSize = 25,
}: {
  /** Fixed for the life of the mount — this list has no filter controls. */
  filter: SlotFilters;
  emptyMessage: string;
  pageSize?: number;
}) {
  const { push } = useNavigation();
  // One clock for every row, rather than one chain read per row.
  const now = useChainClock();

  const [pageSize, setPageSize] = useState(initialPageSize);
  /**
   * One cursor per page visited, `null` for the first.
   *
   * Ponder pages by cursor and has no offset, so a page number alone cannot
   * address a page — going back means remembering where each one started.
   */
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [page, setPage] = useState(0);

  // The filter is fixed per mount, but the CHAIN is not: switching chains has
  // to send the list back to page one, or it asks the new chain for a cursor
  // minted against the old one's ordering.
  const filterKey = `${filter.creator ?? ""}|${filter.recipient ?? ""}|${filter.occupant ?? ""}`;
  useEffect(() => {
    setCursors([null]);
    setPage(0);
  }, [filterKey]);

  const { data, isLoading, isError } = useExplorerSlots(filter, undefined, {
    limit: pageSize,
    after: cursors[page] ?? null,
  });

  const slots = data?.items ?? [];

  const goToPage = (next: number) => {
    if (next < 0) return;
    if (next < cursors.length) {
      setPage(next);
      return;
    }
    // Forward past the end of what we have seen: remember this page's end as
    // the next one's start.
    const endCursor = data?.pageInfo?.endCursor;
    if (!endCursor) return;
    setCursors((prev) => [...prev, endCursor]);
    setPage(next);
  };

  const changePageSize = (size: number) => {
    setPageSize(size);
    // Cursors are sized to the page they were taken from, so they do not
    // survive a resize.
    setCursors([null]);
    setPage(0);
  };

  if (isLoading && !data) return <TableSkeleton />;

  // Says what is wrong rather than showing an empty table. "No slots" and "the
  // indexer is down" look identical to a reader and mean opposite things.
  if (isError)
    return (
      <div className="border p-8 text-center text-sm text-muted-foreground">
        The indexer is unreachable, so this list cannot be shown right now.
      </div>
    );

  if (slots.length === 0) return <TableEmpty message={emptyMessage} />;

  return (
    <div className="border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Recipient</TableHead>
            <TableHead>Occupant</TableHead>
            <TableHead className="text-right">Price / Tax</TableHead>
            <TableHead>Hook</TableHead>
            <TableHead>Config</TableHead>
            <TableHead className="text-right">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {slots.map((slot) => (
            <SlotRow
              key={slot.id}
              slot={slot}
              now={now}
              onSelect={(id) => push(`/app/slots/${id}`)}
            />
          ))}
        </TableBody>
      </Table>
      {/*
       * `hasMore` and no `total`: the props are a union, and passing a count
       * alongside it puts the component in the client-paged mode meant for a
       * fully-loaded array. Cursor paging never holds the whole set, so the
       * count it could report would describe the page rather than the query.
       */}
      <TablePagination
        page={page}
        pageSize={pageSize}
        hasMore={data?.pageInfo?.hasNextPage ?? false}
        onPageChange={goToPage}
        onPageSizeChange={changePageSize}
      />
    </div>
  );
}
