"use client";

import { useAccount } from "wagmi";
import { CopyAddress } from "@/components/copy-address";
import { PageHeader } from "@/components/page-header";
import { SlotsTable } from "@/components/slots/slots-table";

/**
 * Your slots.
 *
 * Two questions the factory's own logs can answer — which slots you made, and
 * which pay their tax to you, both indexed topics on `SlotCreated`. "Slots you
 * occupy" is deliberately absent: occupancy is not in any log this protocol
 * emits from the factory, so answering it means reading every slot on the
 * chain. That is an indexer's job, and there is no indexer for this protocol
 * yet.
 */
export default function ProfilePage() {
  const { address, isConnected } = useAccount();

  if (!isConnected || !address)
    return (
      <div className="min-h-screen px-3 py-8 md:px-5">
        <div className="border p-8 text-center text-sm text-muted-foreground">
          Connect a wallet to see your slots.
        </div>
      </div>
    );

  return (
    <div className="min-h-screen">
      <PageHeader>
        <div className="flex flex-col">
          <h1 className="text-xl font-bold leading-tight tracking-tight">
            Your slots
          </h1>
          <CopyAddress address={address} />
        </div>
      </PageHeader>

      <div className="space-y-6 px-3 py-3 md:px-5">
        <section className="space-y-2">
          <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Created by you
          </h2>
          <SlotsTable
            filter={{ creator: address }}
            emptyMessage="You have not created a slot on this chain."
          />
        </section>

        <section className="space-y-2">
          <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Paying tax to you
          </h2>
          <SlotsTable
            filter={{ recipient: address }}
            emptyMessage="No slot on this chain names you as its recipient."
          />
        </section>
      </div>
    </div>
  );
}
