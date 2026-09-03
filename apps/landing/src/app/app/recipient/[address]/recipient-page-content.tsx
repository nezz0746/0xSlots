"use client";

import { Banknote, Check, Copy, HandCoins, LandPlot } from "lucide-react";
import { useState } from "react";
import { getAddress, isAddress } from "viem";
import { AccountTypeIcon } from "@/components/account-type-icon";
import { Blockie } from "@/components/blockie";
import { PageHeader } from "@/components/page-header";
import { SlotStatusBadge } from "@/components/slot-status-badge";
import { SplitRecipientsBar } from "@/components/split-recipients-bar";
import { StatCard } from "@/components/stat-card";
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
import { NavLink, useNavigation } from "@/context/navigation";
import { useCurrencyMeta, useSlotState } from "@/hooks/slots/use-slots";
import { useExplorerSlots } from "@/hooks/use-explorer";
import { useEnsAvatar, useEnsName } from "@/lib/ens";
import type { AccountType } from "@/lib/indexer";
import { formatBalance, formatBps, truncateAddress } from "@/utils";

/**
 * Everything one address collects tax from.
 *
 * ── Where each half comes from ───────────────────────────────────────────
 *
 * The LIST is indexed: "which slots pay here" is a relationship over history,
 * exactly what an indexer is for, and `recipient` is a filter the ponder schema
 * carries.
 *
 * The FIGURES are read from the chain, per row. Price, deposit and tax owed all
 * move with `block.timestamp` — nothing is emitted when tax accrues — so an
 * indexed total would be a sum of numbers that were each true at a different
 * past block, presented as one current figure. That is worse than showing
 * nothing, because it looks precise.
 */
export function RecipientPageContent({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  const { push } = useNavigation();

  const { chainId, explorerUrl } = useChain();
  const valid = isAddress(address, { strict: false });
  const recipient = valid ? getAddress(address) : undefined;

  const { data, isLoading } = useExplorerSlots(
    recipient ? { recipient: recipient.toLowerCase() } : undefined,
    undefined,
    { limit: 100 },
  );
  const rows = data?.items ?? [];

  const { data: ensName } = useEnsName(address);
  const { data: ensAvatar } = useEnsAvatar(ensName);

  const recipientType = rows[0]?.recipientAccountRef?.type;
  const { page, setPage, pageSize, setPageSize, totalPages, paged } =
    usePagination(rows);

  if (!valid)
    return (
      <div className="min-h-screen px-3 py-8 md:px-5">
        <div className="border p-8 text-center text-sm text-muted-foreground">
          “{address}” is not an address.
        </div>
      </div>
    );

  const occupied = rows.filter((s) => s.isOccupied).length;
  const vacant = rows.length - occupied;

  /**
   * How many currencies pay into this address.
   *
   * NOT a total of tax owed or deposit, which is what stood here before. Those
   * summed every slot's figures at the FIRST slot's decimals and printed one
   * number — so a recipient collecting in both ETH and a 6-decimal stablecoin
   * got a total that was wrong by twelve orders of magnitude and looked
   * authoritative. A count of currencies is the honest version of the same
   * signal: it says the totals cannot be added, rather than adding them.
   */
  const currencies = String(
    new Set(rows.map((s) => s.currency.toLowerCase())).size,
  );

  return (
    <div className="min-h-screen">
      <PageHeader maxWidth="max-w-6xl">
        <div className="flex items-center gap-4">
          {ensAvatar ? (
            // biome-ignore lint/performance/noImgElement: an ENS avatar is an
            // arbitrary remote URL, which next/image cannot optimise without a
            // per-host allowlist nobody can enumerate.
            <img
              src={ensAvatar}
              alt={ensName ?? address}
              className="size-12 rounded-full border"
            />
          ) : (
            <Blockie
              address={address}
              className="size-12 rounded-full border"
            />
          )}
          <div>
            <div className="mb-1 flex items-center gap-2">
              <NavLink
                href="/app"
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                ← Explorer
              </NavLink>
            </div>
            <h1 className="text-xl font-bold leading-tight tracking-tight">
              {ensName ?? "Recipient"}
            </h1>
            <div className="inline-flex items-center gap-1.5">
              <a
                href={`${explorerUrl}/address/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                {recipientType && (
                  <AccountTypeIcon type={recipientType} className="size-3" />
                )}
                {truncateAddress(address)}
              </a>
              <button
                type="button"
                className="text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => {
                  navigator.clipboard.writeText(address);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? (
                  <Check className="size-3" />
                ) : (
                  <Copy className="size-3" />
                )}
              </button>
            </div>
            {/* A split pays several people, and which people is the first thing
                anybody looking at a split recipient wants to know. */}
            {recipientType === "SPLIT" && (
              <div className="mt-2">
                <SplitRecipientsBar chainId={chainId} splitAddress={address} />
              </div>
            )}
          </div>
        </div>
      </PageHeader>

      <div className="mx-auto max-w-6xl px-3 py-2 md:px-5 md:py-4">
        <div className="mb-6 grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-4">
          <StatCard
            label="Occupied / Vacant"
            value={`${occupied} / ${vacant}`}
            icon={LandPlot}
          />
          <StatCard
            label="Slots"
            value={String(rows.length)}
            icon={HandCoins}
          />
          <StatCard label="Currencies" value={currencies} icon={Banknote} />
        </div>

        <div className="rounded-t-lg border border-b-0 bg-muted/50 px-4 py-3">
          <h2 className="text-sm font-semibold">Slots</h2>
        </div>
        {isLoading ? (
          <TableSkeleton />
        ) : rows.length === 0 ? (
          <TableEmpty message="No slot on this chain pays its tax here." />
        ) : (
          <div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Slot</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Occupant</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Tax</TableHead>
                  <TableHead className="text-right">Deposit</TableHead>
                  <TableHead className="text-right">Tax owed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((s) => (
                  <RecipientSlotRow
                    key={s.id}
                    id={s.id}
                    currency={s.currency}
                    occupantType={s.occupantAccountRef?.type}
                    onOpen={() => push(`/app/slots/${s.id}`)}
                  />
                ))}
              </TableBody>
            </Table>
            <TablePagination
              page={page}
              totalPages={totalPages}
              pageSize={pageSize}
              total={rows.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * One row, reading its own live figures.
 *
 * Per row rather than one batched read: each row needs its currency's decimals,
 * which is a second read keyed on a value only the first returns, and the list
 * is a page at a time.
 */
function RecipientSlotRow({
  id,
  currency,
  occupantType,
  onOpen,
}: {
  id: `0x${string}`;
  currency: `0x${string}`;
  occupantType?: AccountType;
  onOpen: () => void;
}) {
  const { data: state } = useSlotState(id, { refetchInterval: 15_000 });
  const meta = useCurrencyMeta(currency);
  const amount = (v: bigint) =>
    `${formatBalance(v, meta.decimals)} ${meta.symbol}`;

  return (
    <TableRow className="cursor-pointer" onClick={onOpen}>
      <TableCell className="font-mono text-xs">{truncateAddress(id)}</TableCell>
      <TableCell>
        {state ? (
          <SlotStatusBadge
            occupant={state.isVacant ? null : state.occupant}
            insolvent={state.isInsolvent}
          />
        ) : (
          <span className="text-xs text-muted-foreground">…</span>
        )}
      </TableCell>
      <TableCell className="text-xs">
        {state && !state.isVacant ? (
          <span className="inline-flex items-center gap-1.5">
            {occupantType && (
              <AccountTypeIcon type={occupantType} className="size-3" />
            )}
            {truncateAddress(state.occupant)}
          </span>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums text-xs">
        {state ? amount(state.price) : "…"}
      </TableCell>
      <TableCell className="text-right tabular-nums text-xs">
        {state ? `${formatBps(Number(state.taxBps))}/mo` : "…"}
      </TableCell>
      <TableCell className="text-right tabular-nums text-xs">
        {state ? amount(state.deposit) : "…"}
      </TableCell>
      <TableCell className="text-right tabular-nums text-xs">
        {state ? amount(state.taxOwed) : "…"}
      </TableCell>
    </TableRow>
  );
}
