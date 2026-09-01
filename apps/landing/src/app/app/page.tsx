"use client";

import { PlusIcon } from "lucide-react";
import { useAccount } from "wagmi";
import { PageHeader } from "@/components/page-header";
import { SlotsTable } from "@/components/slots/slots-table";
import { Button } from "@/components/ui/button";
import { useChain } from "@/context/chain";
import { NavLink } from "@/context/navigation";
import { useSlotCount, useSlotsFactory } from "@/hooks/slots/use-slots";
import { truncateAddress } from "@/utils";

/**
 * Every slot the factory has made.
 *
 * Read from `SlotCreated` logs, not an indexer: the indexer serves the previous
 * protocol, and rows from it would look identical and be entirely wrong.
 */
export default function Explorer() {
  const { chain } = useAccount();
  const { chainId } = useChain();
  const factory = useSlotsFactory();
  const { data: count } = useSlotCount();

  return (
    <div className="min-h-screen">
      <PageHeader>
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <h1 className="text-xl font-bold leading-tight tracking-tight">
              Slots
            </h1>
            <p className="text-xs text-muted-foreground">
              {chain?.name ?? `Chain ${chainId}`}
              {factory ? ` · factory ${truncateAddress(factory)}` : ""}
            </p>
          </div>
          {count !== undefined ? (
            <>
              <div className="hidden h-6 w-px bg-border md:flex" />
              <div className="flex flex-col">
                <span className="text-lg font-semibold tabular-nums leading-tight">
                  {count.toString()}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  created
                </span>
              </div>
            </>
          ) : null}
        </div>
        <NavLink href="/app/create">
          <Button size="sm">
            <PlusIcon className="size-4" />
            Create slot
          </Button>
        </NavLink>
      </PageHeader>

      <div className="px-3 py-3 md:px-5">
        <SlotsTable emptyMessage="No slots on this chain yet. Create the first one." />
      </div>
    </div>
  );
}
