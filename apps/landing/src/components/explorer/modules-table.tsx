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
import { useModules } from "@/hooks/use-v3";
import { truncateAddress } from "@/utils";

export function ModulesTable() {
  const { data: modules, isLoading, refetch, isFetching } = useModules();
  const { explorerUrl } = useChain();

  if (isLoading) return <TableSkeleton rows={3} />;
  if (!modules || modules.length === 0)
    return <TableEmpty message="No utilities found" />;

  return (
    <div>
      <RefreshButton onRefresh={() => refetch()} isFetching={isFetching} />
      <div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Address</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Version</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {modules.map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  <a
                    href={`${explorerUrl}/address/${m.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                    title={m.id}
                  >
                    {truncateAddress(m.id)}
                  </a>
                </TableCell>
                <TableCell className="font-medium">{m.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {m.version}
                </TableCell>
                <TableCell className="text-right">
                  <Badge
                    variant={m.verified ? "default" : "secondary"}
                    className={`text-[10px] ${m.verified ? "border-green-200 bg-green-50 text-green-700" : ""}`}
                  >
                    {m.verified ? "VERIFIED" : "UNVERIFIED"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
