"use client";

import { useAccount } from "wagmi";
import { CopyAddress } from "@/components/copy-address";
import { PageHeader } from "@/components/page-header";
import { SlotList } from "@/components/slots/slot-list";

/**
 * Your slots.
 *
 * Which slots you made, and which pay their tax to you — read from the
 * indexer, paged, with the filter applied server-side.
 *
 * This asked the chain until recently: `SlotCreated` carries `creator` and
 * `recipient` as indexed topics, so both questions could be answered from
 * logs, and for a while that was the only way — the port to the hook protocol
 * left the generated GraphQL types describing the retired schema. The cost was
 * a full-history log scan per poll that returned every slot ever created and
 * could not page. `SlotList` reads the indexer instead.
 *
 * "Slots you occupy" is still absent, and is now merely unbuilt rather than
 * impossible: the note that used to be here said occupancy was in no log the
 * factory emits and needed an indexer, which there now is — `occupant` is an
 * indexed column and `SlotFilters` already carries the filter.
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
          <SlotList
            filter={{ creator: address }}
            emptyMessage="You have not created a slot on this chain."
          />
        </section>

        <section className="space-y-2">
          <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Paying tax to you
          </h2>
          <SlotList
            filter={{ recipient: address }}
            emptyMessage="No slot on this chain names you as its recipient."
          />
        </section>
      </div>
    </div>
  );
}
