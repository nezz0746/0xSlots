"use client";

import { formatDistanceToNow } from "date-fns";
import { ChevronRight, PlusIcon, Users } from "lucide-react";
import type { Address } from "viem";
import { useAccount } from "wagmi";
import {
  CollectiveUnavailable,
  useCollectiveFactory,
} from "@/components/collective-unavailable";
import { CopyAddress } from "@/components/copy-address";
import { PageHeader } from "@/components/page-header";
import { TableEmpty, TableSkeleton } from "@/components/table-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { NavLink, useNavigation } from "@/context/navigation";
import { type CollectiveRow, useMyCollectives } from "@/hooks/use-collectives";
import { cn } from "@/lib/utils";
import { truncateAddress } from "@/utils";

/**
 * Collectives you have a stake in.
 *
 * Deliberately "mine", not "all": a collective is a governance body, and the
 * useful question is which ones answer to you. The explorer lists slots; this
 * lists the bodies behind them.
 */
export default function CollectivesPage() {
  const { address } = useAccount();
  const { data, isLoading, error } = useMyCollectives(address);
  const deployed = useCollectiveFactory();

  return (
    <div className="min-h-screen">
      <PageHeader>
        <div className="flex items-center gap-3">
          <Users className="size-5 text-muted-foreground" />
          <div>
            <h1 className="text-xl font-bold tracking-tight leading-tight">
              My Collectives
            </h1>
            <p className="text-muted-foreground text-xs">
              Bodies that receive a slot&apos;s tax and govern it
            </p>
          </div>
        </div>
        {deployed && (
          <Button size="sm" asChild>
            <div>
              <PlusIcon className="size-4" />
              <NavLink href="/collectives/create">Create Collective</NavLink>
            </div>
          </Button>
        )}
      </PageHeader>

      <div className="w-full px-3 md:px-5 py-3">
        <Body
          address={address}
          available={!!deployed}
          rows={data}
          isLoading={isLoading}
          error={error}
        />
      </div>
    </div>
  );
}

function Body({
  address,
  available,
  rows,
  isLoading,
  error,
}: {
  address: Address | undefined;
  available: boolean;
  rows: ReturnType<typeof useMyCollectives>["data"];
  isLoading: boolean;
  error: unknown;
}) {
  if (!available) return <CollectiveUnavailable />;

  if (!address) return <TableEmpty message="Connect a wallet to see yours" />;
  if (isLoading) return <TableSkeleton rows={3} />;

  if (error) {
    return (
      <div className="border p-4 text-xs">
        <p className="font-medium">Could not reach the indexer.</p>
        <p className="mt-1 text-muted-foreground">
          {error instanceof Error ? error.message : "Unknown error"}
        </p>
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="border p-6 text-center">
        <p className="text-sm font-medium">No collectives yet</p>
        <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
          A collective pools the tax from any number of slots, fans it out over
          a split, and puts each governable dimension behind its own role.
        </p>
        <Button size="sm" className="mt-3" asChild>
          <div>
            <PlusIcon className="size-4" />
            <NavLink href="/collectives/create">Create your first</NavLink>
          </div>
        </Button>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Collective</TableHead>
          <TableHead>Your role</TableHead>
          <TableHead className="text-right">Payees</TableHead>
          <TableHead className="text-right">Created</TableHead>
          <TableHead className="text-right">Status</TableHead>
          <TableHead className="w-8" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <CollectiveListRow key={row.id} row={row} />
        ))}
      </TableBody>
    </Table>
  );
}

/**
 * One row, linking to the collective's own page.
 *
 * Was an accordion. A collective has five roles with their holders, a payout
 * split and controls that mutate all of it — more than a drawer can hold, and
 * all of it worth a URL that can be linked, bookmarked and shared.
 */
function CollectiveListRow({ row }: { row: CollectiveRow }) {
  const { push } = useNavigation();
  const href = `/collectives/${row.id}`;

  return (
    <TableRow
      onClick={() => push(href)}
      className="cursor-pointer"
      // The address cell holds a real link, so keyboard and middle-click reach
      // the page properly; this handler is only a convenience for the rest of
      // the row's surface.
    >
      <TableCell className="font-medium">
        <div className="flex items-center gap-1.5">
          <NavLink
            href={href}
            onClick={(e) => e.stopPropagation()}
            className="font-mono text-xs hover:underline"
          >
            {truncateAddress(row.id)}
          </NavLink>
          <CopyAddress address={row.id} showAddress={false} />
        </div>
      </TableCell>

      {/* Icons alone, tinted to match the create form's sections — the same
          code the role cards use, so the list and the detail page read as one
          vocabulary. Each carries its name as a tooltip and an aria-label,
          since a glyph with no text has to supply its own. */}
      <TableCell>
        <div className="flex flex-wrap items-center gap-1">
          {row.relation.map((r) => {
            const Icon = r.icon;
            return (
              <Tooltip key={r.key}>
                <TooltipTrigger asChild>
                  {/* role="img" is load-bearing: a bare span has no role, and
                      `aria-label` is only honoured where the role supports a
                      name. Without it these badges would be silent. */}
                  <span
                    role="img"
                    aria-label={r.title}
                    className={cn(
                      "flex size-5 items-center justify-center",
                      r.tint,
                    )}
                  >
                    <Icon className="size-3" aria-hidden="true" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">{r.title}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TableCell>

      <TableCell className="text-right tabular-nums text-xs">
        {row.splitRecipientCount}
      </TableCell>
      <TableCell className="text-right text-xs text-muted-foreground">
        {formatDistanceToNow(new Date(Number(row.createdAt) * 1000), {
          addSuffix: true,
        })}
      </TableCell>
      <TableCell className="text-right">
        {row.paused ? (
          <Badge variant="outline" className="text-[10px]">
            Paused
          </Badge>
        ) : (
          <span className="text-[10px] text-muted-foreground">Active</span>
        )}
      </TableCell>
      <TableCell className="w-8 text-right">
        <ChevronRight className="size-3.5 text-muted-foreground" />
      </TableCell>
    </TableRow>
  );
}
