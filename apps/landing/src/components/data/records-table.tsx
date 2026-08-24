"use client";

import { useState } from "react";
import type { Hex } from "viem";
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
import { NavLink } from "@/context/navigation";
import { useSlotDataRecords } from "@/hooks/use-slot-data";
import { decodePayload, formatValue, isLive } from "@/lib/slot-data";
import { truncateAddress } from "@/utils";

/**
 * What is actually attached to slots, decoded against the schemas beside it.
 *
 * Stale rows are shown, greyed, rather than filtered out. A tenancy that ended
 * leaves its payloads in storage untouched — that is the design, because
 * clearing on chain is one increment and a sweep would exceed the gas the slot
 * gives the hook — so a table that quietly dropped them would be describing a
 * contract that does not exist. Seeing "generation 2 of 3" is how the
 * O(1)-clearing trick becomes legible instead of surprising.
 */
export function RecordsTable() {
  const {
    data: records,
    isLoading,
    refetch,
    isFetching,
  } = useSlotDataRecords();

  if (isLoading) return <TableSkeleton rows={4} />;
  if (!records || records.length === 0) {
    return <TableEmpty message="Nothing written yet" />;
  }

  return (
    <div>
      <RefreshButton onRefresh={() => refetch()} isFetching={isFetching} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Slot</TableHead>
            <TableHead>Service</TableHead>
            <TableHead>Payload</TableHead>
            <TableHead>Writer</TableHead>
            <TableHead className="text-right">Tenancy</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((r) => (
            <RecordRow key={r.id} record={r} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

type Record = ReturnType<typeof useSlotDataRecords>["data"] extends
  | (infer T)[]
  | undefined
  ? T
  : never;

function RecordRow({ record }: { record: Record }) {
  const { explorerUrl } = useChain();
  const [showRaw, setShowRaw] = useState(false);
  const live = isLive(record);

  const schema = record.serviceRef?.schema ?? null;
  const decoded = schema
    ? decodePayload(schema, record.data as Hex)
    : { ok: false as const, reason: "Service not indexed." };

  return (
    <TableRow className={live ? undefined : "opacity-50"}>
      <TableCell>
        <NavLink
          href={`/app/slots/${record.slot}`}
          className="text-primary hover:underline"
        >
          {truncateAddress(record.slot)}
        </NavLink>
      </TableCell>

      <TableCell>
        <div className="font-medium">{record.serviceRef?.name ?? "—"}</div>
        {schema && (
          <code className="text-[11px] text-muted-foreground">{schema}</code>
        )}
      </TableCell>

      <TableCell className="max-w-md">
        {decoded.ok && !showRaw ? (
          <dl className="space-y-0.5">
            {decoded.fields.map((f) => (
              <div key={f.label} className="flex gap-2 text-xs">
                <dt className="shrink-0 text-muted-foreground">{f.label}</dt>
                <dd className="truncate" title={formatValue(f.value)}>
                  {formatValue(f.value)}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <code className="block truncate text-[11px] text-muted-foreground">
            {record.data}
          </code>
        )}

        {/* The raw bytes stay one click away even when the decode succeeded.
            A decode that returns values is not proof the schema is right —
            a fixed-size type reads 32 bytes from wherever it lands and returns
            whatever was there — so the hex is the only thing on this row that
            cannot be misleading. See lib/slot-data.ts. */}
        <div className="mt-1 flex items-center gap-2">
          {decoded.ok ? (
            <button
              type="button"
              onClick={() => setShowRaw((v) => !v)}
              className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              {showRaw ? "decoded" : "raw"}
            </button>
          ) : (
            <span
              className="text-[10px] text-amber-600"
              title="The bytes and the registered schema disagree. Both are on chain and neither is authoritative — registration is permissionless."
            >
              {decoded.reason}
            </span>
          )}
        </div>
      </TableCell>

      <TableCell>
        <a
          href={`${explorerUrl}/address/${record.writer}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
          title={record.writer}
        >
          {truncateAddress(record.writer)}
        </a>
      </TableCell>

      <TableCell className="text-right">
        {live ? (
          <Badge
            variant="default"
            className="border-green-200 bg-green-50 text-[10px] text-green-700"
          >
            LIVE
          </Badge>
        ) : (
          <span
            className="text-[10px] uppercase tracking-wider text-muted-foreground"
            title={`Written under generation ${record.generation}; the slot is on ${record.tenancyRef?.generation}. The slot changed hands, so this is the previous tenant's.`}
          >
            gen {record.generation} of {record.tenancyRef?.generation}
          </span>
        )}
      </TableCell>
    </TableRow>
  );
}
