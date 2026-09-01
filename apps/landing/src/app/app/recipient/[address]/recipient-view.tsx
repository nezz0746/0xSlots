"use client";

import { type Address, isAddress } from "viem";
import { CopyAddress } from "@/components/copy-address";
import { PageHeader } from "@/components/page-header";
import { SlotsTable } from "@/components/slots/slots-table";

/**
 * Every slot whose tax flows to one address.
 *
 * `recipient` is an indexed topic on `SlotCreated`, so this is a filtered log
 * query rather than a scan — the one relationship the factory's events answer
 * directly.
 */
export function RecipientView({ address }: { address: string }) {
  if (!isAddress(address))
    return (
      <div className="min-h-screen px-3 py-8 md:px-5">
        <div className="border p-8 text-center text-sm text-muted-foreground">
          “{address}” is not an address.
        </div>
      </div>
    );

  return (
    <div className="min-h-screen">
      <PageHeader>
        <div className="flex flex-col">
          <h1 className="text-xl font-bold leading-tight tracking-tight">
            Recipient
          </h1>
          <CopyAddress address={address} />
        </div>
      </PageHeader>
      <div className="px-3 py-3 md:px-5">
        <SlotsTable
          filter={{ recipient: address as Address }}
          emptyMessage="No slot on this chain pays its tax here."
        />
      </div>
    </div>
  );
}
