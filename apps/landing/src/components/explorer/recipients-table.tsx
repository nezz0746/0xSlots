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
              <TableHead>Slots</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((a) => {
              const recipientOccupied = (
                a.slotsAsRecipient?.items ?? []
              ).filter((s) => s.occupant != null).length;
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
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <div className="flex gap-px">
                        {Array.from({ length: a.slotCount }).map((_, i) => (
                          <span
                            key={i}
                            className={`block w-2 h-2 ${i < recipientOccupied ? "animate-pulse bg-green-600" : "bg-muted-foreground/25"}`}
                          />
                        ))}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {recipientOccupied}/{a.slotCount} occupied
                      </span>
                    </div>
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
