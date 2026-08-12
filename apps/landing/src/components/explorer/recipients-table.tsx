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
              // Both indexed, both scoped to the active chain, and both about
              // the RECIPIENT role — `occupiedAsRecipient` is the companion of
              // `slotCount`, not `occupiedCount` (which counts slots this
              // account OCCUPIES and belongs to a different question entirely).
              //
              // This replaces counting a 500-row page client-side, so it no
              // longer caps, and it no longer sums across chains.
              const occupied = a.occupiedAsRecipient;
              const total = a.slotCount;
              const pct = total > 0 ? (occupied / total) * 100 : 0;

              return (
                <TableRow
                  key={a.account}
                  className="cursor-pointer"
                  onClick={() => {
                    push(`/recipient/${a.account}`);
                  }}
                >
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5">
                      <AccountTypeIcon
                        type={a.accountRef?.type ?? "EOA"}
                        className="h-3 w-3"
                      />
                      <EnsAddress address={a.account} />
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
