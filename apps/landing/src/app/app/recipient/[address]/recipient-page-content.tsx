"use client";

import { Banknote, Check, Copy, HandCoins, LandPlot } from "lucide-react";
import { useState } from "react";
import { isNativeCurrency, NATIVE_CURRENCY } from "@0xslots/sdk";
import { type Address, getAddress, isAddress, zeroAddress } from "viem";
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
import {
  type ExplorerSlot,
  isInsolventAt,
  taxOwedAt,
  useChainClock,
  useExplorerSlots,
} from "@/hooks/use-explorer";
import { useEnsAvatar, useEnsName } from "@/lib/ens";
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

  // One clock for every row — see `RecipientSlotRow`.
  const now = useChainClock();
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
                    slot={s}
                    now={now}
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
 * One row, rendered from the indexed row it was handed.
 *
 * ── It used to read its own live figures, and that was the whole cost ───────
 *
 * This took an `id` and called `useSlotState(id, { refetchInterval: 15_000 })`
 * plus `useCurrencyMeta(currency)` — two chain reads per row, per fifteen
 * seconds, per open tab. The page had ALREADY fetched every one of those
 * values from the indexer a few lines up and thrown them away: occupancy,
 * price, tax rate, deposit and the currency's symbol and decimals are all
 * columns on the row `useExplorerSlots` returns.
 *
 * Only `taxOwed` was genuinely absent, because it is a function of
 * `block.timestamp` rather than of any event — and it is arithmetic over
 * `lastSettled`, `price` and `taxBps`, which the indexer does have. So it is
 * computed here, from the same formula the contract uses, against one clock
 * shared by the whole page.
 */
function RecipientSlotRow({
  slot,
  now,
  onOpen,
}: {
  slot: ExplorerSlot;
  /** The chain's clock, from the indexer. One per page, not one per row. */
  now: bigint | null;
  onOpen: () => void;
}) {
  const id = slot.id;
  const occupantType = slot.occupantAccountRef?.type;

  /*
   * Native ETH has no ERC-20 to name it, so the indexer stores null. Mirrors
   * how `explorer/slot-row.tsx` resolves the same gap.
   */
  const symbol =
    slot.currencyRef?.symbol ??
    (isNativeCurrency(slot.currency as Address) ? NATIVE_CURRENCY.symbol : "");
  const decimals = slot.currencyRef?.decimals ?? 18;
  const amount = (v: bigint) => `${formatBalance(v, decimals)} ${symbol}`;

  const owed = now === null ? null : taxOwedAt(slot, now);
  const state = {
    isVacant: !slot.isOccupied,
    occupant: (slot.occupant ?? zeroAddress) as Address,
    isInsolvent: now === null ? false : isInsolventAt(slot, now),
    price: BigInt(slot.price),
    taxBps: BigInt(slot.taxBps),
    deposit: BigInt(slot.deposit),
  };

  return (
    <TableRow className="cursor-pointer" onClick={onOpen}>
      <TableCell className="text-xs">{truncateAddress(id)}</TableCell>
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
        {owed === null ? "—" : amount(owed)}
      </TableCell>
    </TableRow>
  );
}
