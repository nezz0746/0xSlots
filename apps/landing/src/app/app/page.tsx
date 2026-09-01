"use client";

import { PlusIcon } from "lucide-react";
import { useAccount } from "wagmi";
import { RecipientsTable } from "@/components/explorer/recipients-table";
import { SlotsEvents } from "@/components/explorer/slots-events";
import { StatsBar } from "@/components/explorer/stats-bar";
import { TabStrip } from "@/components/explorer-tabs";
import { IndexerStatus } from "@/components/indexer-status";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { useChain } from "@/context/chain";
import {
  EXPLORER_SECTIONS,
  useExplorerSection,
} from "@/context/explorer-section";
import { NavLink } from "@/context/navigation";
import { useSlotsFactory } from "@/hooks/slots/use-slots";
import { truncateAddress } from "@/utils";

/**
 * The explorer.
 *
 * Rows come from the indexer, which is what makes them filterable, sortable and
 * pageable; each row tops that up with a live chain read for the one fact no
 * event can carry — solvency. When the indexer is unreachable the slots table
 * falls back to reading `SlotCreated` logs from the node, so the page still
 * lists slots on a chain whose indexer has not caught up.
 *
 * The section (Slots / Recipients) is held in `ExplorerSectionProvider` so the
 * desktop sidebar and the mobile tab strip below drive the same selection, and
 * so it survives a reload in the URL.
 */
export default function Explorer() {
  const { chain } = useAccount();
  const { chainId } = useChain();
  const factory = useSlotsFactory();
  const { section, setSection } = useExplorerSection();

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
          {/* Totals for the whole chain, not for the page you are looking at. */}
          <StatsBar />
        </div>
        <div className="flex items-center gap-3">
          {/* How far behind the rows below are. Silent when synced. */}
          <IndexerStatus />
          <NavLink href="/app/create">
            <Button size="sm">
              <PlusIcon className="size-4" />
              Create slot
            </Button>
          </NavLink>
        </div>
      </PageHeader>

      <div className="px-3 py-3 md:px-5">
        {/* Below md there is no sidebar, so the sections render as a strip
            driving the very same state the sidebar drives above it. */}
        <TabStrip
          tabs={EXPLORER_SECTIONS}
          active={section}
          onSelect={setSection}
          className="md:hidden"
        />

        {section === "recipients" ? <RecipientsTable /> : <SlotsEvents />}
      </div>
    </div>
  );
}
