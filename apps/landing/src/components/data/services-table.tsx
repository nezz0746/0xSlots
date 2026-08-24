"use client";

import { RefreshButton } from "@/components/refresh-button";
import { TableEmpty, TableSkeleton } from "@/components/table-states";
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
import { useDataServices } from "@/hooks/use-slot-data";
import { parseSchema } from "@/lib/slot-data";
import { truncateAddress } from "@/utils";

/**
 * The registry — every shape anyone has declared, on one screen.
 *
 * Registration is permissionless, so this table is going to contain junk
 * eventually and is built to show it rather than to hide it. A schema that does
 * not parse is flagged instead of dropped: the row is the evidence that a
 * service is unusable, and dropping it would leave the id it consumed
 * unexplained.
 */
export function ServicesTable() {
  const { data: services, isLoading, refetch, isFetching } = useDataServices();
  const { explorerUrl } = useChain();

  if (isLoading) return <TableSkeleton rows={3} />;
  if (!services || services.length === 0) {
    return <TableEmpty message="No services registered yet" />;
  }

  return (
    <div>
      <RefreshButton onRefresh={() => refetch()} isFetching={isFetching} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Schema</TableHead>
            <TableHead>Registrar</TableHead>
            <TableHead className="text-right">Writes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {services.map((s) => {
            const parsed = parseSchema(s.schema);
            return (
              <TableRow key={s.id}>
                <TableCell className="text-muted-foreground tabular-nums">
                  {s.serviceId}
                </TableCell>
                <TableCell className="font-medium">
                  {s.name || (
                    <span className="text-muted-foreground">unnamed</span>
                  )}
                </TableCell>
                <TableCell>
                  <code className="text-xs">{s.schema}</code>
                  {!parsed && (
                    <Badge
                      variant="secondary"
                      className="ml-2 text-[10px] border-amber-200 bg-amber-50 text-amber-700"
                      title="Not a readable ABI signature — nothing written against this service can be decoded. The contract does not validate schemas, so this is permanent."
                    >
                      UNPARSEABLE
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <a
                    href={`${explorerUrl}/address/${s.registrar}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                    title={s.registrar}
                  >
                    {truncateAddress(s.registrar)}
                  </a>
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {s.writeCount}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
