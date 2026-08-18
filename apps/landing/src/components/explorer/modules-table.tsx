"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import type { Address } from "viem";
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
import { useFactoryAdmin } from "@/hooks/use-factory-admin";
import { useSlotAction } from "@/hooks/use-slot-action";
import { useModules } from "@/hooks/use-v3";
import { truncateAddress } from "@/utils";

export function ModulesTable() {
  const { data: modules, isLoading, refetch, isFetching } = useModules();
  const { explorerUrl } = useChain();
  const { isAdmin } = useFactoryAdmin();
  const { setUtilityVerified, busy } = useSlotAction();
  const [lastClicked, setLastClicked] = useState<string | null>(null);

  // Which row is actually in flight. Deriving it from `busy` rather than
  // clearing it in an effect means a rejected transaction stops the spinner on
  // the same render that `busy` drops, with no window where a settled row still
  // looks like it is working.
  const pendingId = busy ? lastClicked : null;

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
                  {/* Same badge either way. Only the admin gets it wrapped in a
                      button, so the table a normal visitor sees is unchanged. */}
                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={() => {
                        setLastClicked(m.id);
                        void setUtilityVerified(m.id as Address, !m.verified);
                      }}
                      // Every row disables while one is in flight: the factory
                      // serialises these anyway, and a second wallet prompt
                      // stacked on the first is how you sign the wrong one.
                      disabled={busy}
                      title={
                        m.verified
                          ? `Unverify ${m.name}`
                          : `Verify ${m.name} — reverts unless it answers ERC-165 for IUtility and IModuleMetadata`
                      }
                      className="inline-flex items-center gap-1.5 align-middle transition-opacity hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {pendingId === m.id && (
                        <Loader2
                          className="size-3 animate-spin text-muted-foreground"
                          aria-hidden="true"
                        />
                      )}
                      <StatusBadge verified={m.verified} />
                    </button>
                  ) : (
                    <StatusBadge verified={m.verified} />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function StatusBadge({ verified }: { verified: boolean }) {
  return (
    <Badge
      variant={verified ? "default" : "secondary"}
      className={`text-[10px] ${verified ? "border-green-200 bg-green-50 text-green-700" : ""}`}
    >
      {verified ? "VERIFIED" : "UNVERIFIED"}
    </Badge>
  );
}
