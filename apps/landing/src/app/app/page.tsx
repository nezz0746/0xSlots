"use client";

import { PlusIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useAccount } from "wagmi";

import { AdBar } from "@/components/ad-bar";
import { EventsTable } from "@/components/explorer/events-table";
import { ModulesTable } from "@/components/explorer/modules-table";
import { RecipientsTable } from "@/components/explorer/recipients-table";
import { SlotsTable } from "@/components/explorer/slots-table";
import { StatsBar } from "@/components/explorer/stats-bar";
import { TabStrip } from "@/components/explorer-tabs";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  EXPLORER_SECTIONS,
  useExplorerSection,
} from "@/context/explorer-section";
import { NavLink } from "@/context/navigation";

/** Section id → table. Section metadata lives in the context so the sidebar
 *  and the mobile strip share one definition. */
const SECTION_CONTENT: Record<string, () => ReactNode> = {
  events: () => <EventsTable />,
  slots: () => <SlotsTable />,
  recipients: () => <RecipientsTable />,
  modules: () => <ModulesTable />,
};

export default function Home() {
  const { chain } = useAccount();
  const { section, setSection } = useExplorerSection();

  return (
    <div className="min-h-screen">
      <PageHeader>
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <h1 className="text-xl font-bold tracking-tight leading-tight">
              Explorer
            </h1>
            <p className="text-muted-foreground text-xs">
              {chain && `${chain?.name}`}
            </p>
          </div>
          <div className="hidden md:flex w-px h-6 bg-border" />
          <StatsBar />
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" asChild>
            <div>
              <PlusIcon className="w-5 h-5" />
              <NavLink href="/app/create">Create Slot</NavLink>
            </div>
          </Button>
        </div>
      </PageHeader>

      <div className="w-full px-3 md:px-5 py-3">
        <AdBar />
        {/* Desktop navigates sections from the sidebar; below md the strip
            stays, driving the same selection. */}
        <TabStrip
          className="md:hidden"
          tabs={EXPLORER_SECTIONS}
          active={section}
          onSelect={setSection}
        />
        {SECTION_CONTENT[section]?.()}

        <div className="mt-8 text-center text-xs text-muted-foreground">
          Powered by 0xSlots · Ponder
        </div>
      </div>
    </div>
  );
}
