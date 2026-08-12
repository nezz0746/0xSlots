"use client";

import { formatUnits } from "viem";
import { useAccount } from "wagmi";
import { AccountTypeIcon } from "@/components/account-type-icon";
import { ExplorerTabs } from "@/components/explorer-tabs";
import { PageHeader } from "@/components/page-header";
import { SlotStatusBadge } from "@/components/slot-status-badge";
import { StatCard } from "@/components/stat-card";
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
import { useSlotsOnChain } from "@/hooks/use-slot-onchain";
import {
  useSlotsByOccupant,
  useSlotsByRecipient,
  type V3Slot,
} from "@/hooks/use-v3";
import { formatBalance, truncateAddress } from "@/utils";

function SlotTable({
  slots,
  subgraphSlots,
  isLoading,
  emptyMessage,
  push,
}: {
  slots: ReturnType<typeof useSlotsOnChain>["data"];
  subgraphSlots: V3Slot[];
  isLoading: boolean;
  emptyMessage: string;
  push: (href: string) => void;
}) {
  const decimals = slots[0]?.currencyDecimals ?? 6;
  const symbol = slots[0]?.currencySymbol ?? "USDC";

  // Build lookup map for account types from subgraph data
  const subgraphMap = new Map(subgraphSlots.map((s) => [s.id, s]));

  if (isLoading) return <TableSkeleton />;
  if (slots.length === 0) return <TableEmpty message={emptyMessage} />;

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Slot</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Recipient</TableHead>
            <TableHead>Occupant</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">Deposit</TableHead>
            <TableHead className="text-right">Tax Owed</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {slots.map((s) => {
            const sg = subgraphMap.get(s.id);
            return (
              <TableRow
                key={s.id}
                className="cursor-pointer"
                onClick={() => push(`/slots/${s.id}`)}
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
                  <span className="inline-flex items-center gap-1.5">
                    {sg?.recipientAccountRef?.type && (
                      <AccountTypeIcon
                        type={sg.recipientAccountRef.type}
                        className="h-3 w-3"
                      />
                    )}
                    {truncateAddress(s.recipient)}
                  </span>
                </TableCell>
                <TableCell className="text-xs">
                  {s.occupant ? (
                    <span className="inline-flex items-center gap-1.5">
                      {sg?.occupantAccountRef?.type && (
                        <AccountTypeIcon
                          type={sg.occupantAccountRef.type}
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
    </div>
  );
}

function ProfileContent({ address }: { address: string }) {
  const { push } = useNavigation();
  const { chainId } = useChain();
  const { data: recipientSubgraph, isLoading: recipientSubLoading } =
    useSlotsByRecipient(address);
  const { data: occupantSubgraph, isLoading: occupantSubLoading } =
    useSlotsByOccupant(address);

  const recipientAddresses = recipientSubgraph?.map((s) => s.id) ?? [];
  const occupantAddresses = occupantSubgraph?.map((s) => s.id) ?? [];

  const { data: recipientSlots, isLoading: recipientOnchainLoading } =
    useSlotsOnChain(recipientAddresses, chainId);
  const { data: occupantSlots, isLoading: occupantOnchainLoading } =
    useSlotsOnChain(occupantAddresses, chainId);

  const recipientLoading = recipientSubLoading || recipientOnchainLoading;
  const occupantLoading = occupantSubLoading || occupantOnchainLoading;

  const decimals =
    recipientSlots[0]?.currencyDecimals ??
    occupantSlots[0]?.currencyDecimals ??
    6;
  const symbol =
    recipientSlots[0]?.currencySymbol ??
    occupantSlots[0]?.currencySymbol ??
    "USDC";

  const totalTaxOwed = recipientSlots.reduce((sum, s) => sum + s.taxOwed, 0n);
  const totalDeposit = occupantSlots.reduce((sum, s) => sum + s.deposit, 0n);

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-2 md:mb-6">
        <StatCard
          label="Owned Slots"
          value={recipientSlots.length.toString()}
        />
        <StatCard label="Occupying" value={occupantSlots.length.toString()} />
        <StatCard
          label="Collectable Tax"
          value={`${formatBalance(totalTaxOwed, decimals)} ${symbol}`}
        />
        <StatCard
          label="Total Deposit"
          value={`${formatBalance(totalDeposit, decimals)} ${symbol}`}
        />
      </div>

      {/* Tabs */}
      <ExplorerTabs
        tabs={[
          {
            id: "owned",
            label: `Owned (${recipientSlots.length})`,
            content: () => (
              <SlotTable
                push={push}
                slots={recipientSlots}
                subgraphSlots={recipientSubgraph ?? []}
                isLoading={recipientLoading}
                emptyMessage="You don't own any slots yet"
              />
            ),
          },
          {
            id: "occupying",
            label: `Occupying (${occupantSlots.length})`,
            content: () => (
              <SlotTable
                push={push}
                slots={occupantSlots}
                subgraphSlots={occupantSubgraph ?? []}
                isLoading={occupantLoading}
                emptyMessage="You're not occupying any slots"
              />
            ),
          },
        ]}
      />
    </>
  );
}

export default function ProfilePage() {
  const { address, isConnected } = useAccount();

  return (
    <div className="min-h-screen">
      <PageHeader maxWidth="max-w-6xl">
        <div>
          <NavLink
            href="/"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Explorer
          </NavLink>
          <h1 className="text-xl font-bold tracking-tight leading-tight">
            My Profile
          </h1>
          {address && (
            <p className="text-xs text-muted-foreground">
              {truncateAddress(address)}
            </p>
          )}
        </div>
      </PageHeader>

      <div className="max-w-6xl mx-auto px-3 md:px-5 py-2 md:py-6">
        {!isConnected || !address ? (
          <div className="rounded-lg border p-12 text-center">
            <p className="text-sm text-muted-foreground">
              Connect your wallet to see your slots
            </p>
          </div>
        ) : (
          <ProfileContent address={address} />
        )}
      </div>
    </div>
  );
}
