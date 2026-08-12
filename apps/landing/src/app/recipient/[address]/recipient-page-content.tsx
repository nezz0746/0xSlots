"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { Banknote, Check, Copy, HandCoins, LandPlot } from "lucide-react";
import { useState } from "react";
import { formatUnits } from "viem";
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
import { slotsByRecipientQueryOptions } from "@/hooks/slot-queries";
import { useSlotsOnChain } from "@/hooks/use-slot-onchain";
import { useEnsAvatar, useEnsName } from "@/lib/ens";
import { formatBalance, truncateAddress } from "@/utils";

export function RecipientPageContent({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  const { explorerUrl, chainId: selectedChainId } = useChain();
  const { push } = useNavigation();

  // Subgraph data — prefetched on the server, reads from cache instantly
  const { data: subgraphSlots } = useSuspenseQuery(
    slotsByRecipientQueryOptions(selectedChainId, address),
  );
  const slotAddresses = subgraphSlots?.map((s) => s.id) ?? [];

  // Live on-chain data for all slots via multicall
  const { data: slots, isLoading: onchainLoading } = useSlotsOnChain(
    slotAddresses,
    selectedChainId,
  );

  const { data: ensName } = useEnsName(address);
  const { data: ensAvatar } = useEnsAvatar(ensName);

  const isLoading = onchainLoading;
  const recipientType = subgraphSlots?.[0]?.recipientAccountRef?.type;
  const subgraphMap = new Map((subgraphSlots ?? []).map((s) => [s.id, s]));
  const occupied = slots.filter((s) => s.occupant != null);
  const vacant = slots.length - occupied.length;
  const decimals = slots[0]?.currencyDecimals ?? 6;
  const symbol = slots[0]?.currencySymbol ?? "USDC";
  const totalTaxOwed = slots.reduce((sum, s) => sum + s.taxOwed, 0n);
  const totalDeposit = slots.reduce((sum, s) => sum + s.deposit, 0n);

  const { page, setPage, pageSize, setPageSize, totalPages, paged } =
    usePagination(slots);

  return (
    <div className="min-h-screen">
      <PageHeader maxWidth="max-w-6xl">
        <div className="flex items-center gap-4">
          {ensAvatar ? (
            <img
              src={ensAvatar}
              alt={ensName ?? address}
              className="w-12 h-12 rounded-full border"
            />
          ) : (
            <Blockie
              address={address}
              className="w-12 h-12 rounded-full border"
            />
          )}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <NavLink
                href="/"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Explorer
              </NavLink>
            </div>
            <h1 className="text-xl font-bold tracking-tight leading-tight">
              {ensName ?? "Recipient"}
            </h1>
            <div className="inline-flex items-center gap-1.5">
              <a
                href={`${explorerUrl}/address/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline inline-flex items-center gap-1.5"
              >
                {recipientType && (
                  <AccountTypeIcon type={recipientType} className="h-3 w-3" />
                )}
                {truncateAddress(address)}
              </a>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground transition-colors"
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
            {recipientType === "SPLIT" && (
              <div className="mt-2">
                <SplitRecipientsBar
                  chainId={selectedChainId}
                  splitAddress={address}
                />
              </div>
            )}
          </div>
        </div>
      </PageHeader>

      <div className="max-w-6xl mx-auto px-3 md:px-5 py-2 md:py-4">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-6">
          <StatCard
            label="Occupied / Vacant"
            value={`${occupied.length} / ${vacant}`}
            icon={LandPlot}
          />
          <StatCard
            label="Pending Tax"
            value={`${formatBalance(totalTaxOwed, decimals)} ${symbol}`}
            icon={HandCoins}
          />
          <StatCard
            label="Total Deposit"
            value={`${formatBalance(totalDeposit, decimals)} ${symbol}`}
            icon={Banknote}
          />
        </div>

        {/* Slots Table */}
        <div className="bg-muted/50 border rounded-t-lg border-b-0 px-4 py-3">
          <h2 className="text-sm font-semibold">Slots</h2>
        </div>
        {isLoading ? (
          <TableSkeleton />
        ) : slots.length === 0 ? (
          <TableEmpty message="No slots found for this recipient" />
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
                  <TableHead className="text-right">Tax Owed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((s) => {
                  const occupantType = subgraphMap.get(s.id)?.occupantAccountRef
                    ?.type;
                  return (
                    <TableRow
                      key={s.id}
                      className="cursor-pointer"
                      onClick={() => {
                        push(`/slots/${s.id}`);
                      }}
                    >
                      <TableCell className="text-xs">
                        {truncateAddress(s.id)}
                      </TableCell>
                      <TableCell>
                        <SlotStatusBadge
                          occupant={s.occupant}
                          insolvent={s.insolvent}
                        />
                      </TableCell>
                      <TableCell className="text-xs">
                        {s.occupant ? (
                          <span className="inline-flex items-center gap-1.5">
                            {occupantType && (
                              <AccountTypeIcon
                                type={occupantType}
                                className="h-3 w-3"
                              />
                            )}
                            {truncateAddress(s.occupant)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatBalance(s.price, decimals)} {symbol}
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(s.taxPercentage) / 100}%
                      </TableCell>
                      <TableCell className="text-right">
                        {formatBalance(s.deposit, decimals)} {symbol}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatBalance(s.taxOwed, decimals)} {symbol}
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
              total={slots.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )}
      </div>
    </div>
  );
}
