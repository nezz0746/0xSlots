"use client";

import { AccountTypeIcon } from "@/components/account-type-icon";
import { EnsAddress } from "@/components/ens-address";
import { RefreshButton } from "@/components/refresh-button";
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
import { useNavigation } from "@/context/navigation";
import { useAccounts } from "@/hooks/use-v3";

/**
 * Occupancy as one fixed-width bar.
 *
 * Replaces a row of one 8px square per slot. That encoding read well at five
 * slots and broke completely at 130 — ~1170px of squares stretching the table
 * past the viewport, and no faster to read than a percentage. A bar is constant
 * width whatever the count, and the exact numbers live in their own columns
 * beside it rather than being spelled out here.
 */
function OccupancyBar({ pct }: { pct: number }) {
  const rounded = Math.round(pct);
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1.5 flex-1 bg-muted"
        // The bar is a redundant view of the two numeric columns beside it, so
        // it is hidden from assistive tech rather than repeating them.
        aria-hidden="true"
      >
        <div
          className="h-full bg-emerald-600 dark:bg-emerald-500"
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
      <span className="w-8 shrink-0 text-right tabular-nums text-[10px] text-muted-foreground">
        {rounded}%
      </span>
    </div>
  );
}

export function RecipientsTable() {
  const { push } = useNavigation();
  const { data: accounts, isLoading, refetch, isFetching } = useAccounts();
  const { page, setPage, pageSize, setPageSize, totalPages, paged } =
    usePagination(accounts ?? []);

  if (isLoading) return <TableSkeleton />;
  if (!accounts || accounts.length === 0)
    return <TableEmpty message="No recipients found" />;

  return (
    <div>
      <RefreshButton onRefresh={() => refetch()} isFetching={isFetching} />
      <div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Recipient</TableHead>
              <TableHead className="text-right">Slots</TableHead>
              <TableHead className="text-right">Occupied</TableHead>
              <TableHead className="w-40">Occupancy</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((a) => {
              // Counted from the slots this account RECEIVES from — not from
              // `account.occupiedCount`, which looks like the right column and
              // is not: that one is incremented on the BUYER (src/slot.ts) and
              // means "slots this account occupies". Pairing it with
              // `slotCount`, which is incremented on the RECIPIENT
              // (src/factory.ts), would put two different roles in one ratio and
              // read as occupancy.
              //
              // The list is capped at 500 by the query fragment, so a recipient
              // holding more than that would under-report here. The largest on
              // record is ~133. If that ceiling is ever approached, the fix is an
              // indexed counter on `account` maintained alongside `slotCount`,
              // not a bigger page.
              const occupied = (a.slotsAsRecipient?.items ?? []).filter(
                (s) => s.occupant != null,
              ).length;
              const total = a.slotCount;
              const pct = total > 0 ? (occupied / total) * 100 : 0;

              return (
                <TableRow
                  key={a.id}
                  className="cursor-pointer"
                  onClick={() => {
                    push(`/recipient/${a.id}`);
                  }}
                >
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5">
                      <AccountTypeIcon type={a.type} className="h-3 w-3" />
                      <EnsAddress address={a.id} />
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs">
                    {total}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs">
                    {occupied}
                  </TableCell>
                  <TableCell>
                    <OccupancyBar pct={pct} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <TablePagination
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          total={accounts.length}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>
    </div>
  );
}
