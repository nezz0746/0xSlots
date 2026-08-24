"use client";

import { CHAINS } from "@0xslots/contracts";
import { Boxes, Database, List } from "lucide-react";
import { useState } from "react";
import { RecordsTable } from "@/components/data/records-table";
import { RegisterService } from "@/components/data/register-service";
import { ServicesTable } from "@/components/data/services-table";
import { TabStrip } from "@/components/explorer-tabs";
import { PageHeader } from "@/components/page-header";
import { useChain } from "@/context/chain";
import { useDataServices, useSlotDataModule } from "@/hooks/use-slot-data";

/**
 * SlotData — what slots are carrying.
 *
 * The screen exists to make one claim checkable: that a slot's data layer does
 * not need a contract per application. Two tabs, and the relationship between
 * them is the argument — the registry declares shapes, the records are written
 * against them by whoever happens to occupy a slot, and this page decodes both
 * without knowing what either is for.
 *
 * A route of its own rather than a tab on the explorer, for the same reason
 * Utilities is: the explorer's three tabs are one inventory sliced three ways,
 * and this is a different thing entirely.
 */

const TABS = [
  { id: "services", label: "Services", icon: Boxes },
  { id: "records", label: "Records", icon: List },
];

export default function DataPage() {
  const [tab, setTab] = useState("services");
  const module = useSlotDataModule();
  const { chainId } = useChain();
  const chainName = CHAINS.find((c) => c.id === chainId)?.name ?? "this chain";
  const { data: services } = useDataServices();

  return (
    <div className="min-h-screen">
      <PageHeader>
        <div className="flex items-center gap-3">
          <Database className="size-5 text-muted-foreground" aria-hidden />
          <div className="flex flex-col">
            <h1 className="text-xl font-bold leading-tight tracking-tight">
              Slot data
            </h1>
            <p className="text-xs text-muted-foreground">
              One utility, any number of services
            </p>
          </div>
        </div>
        {services && services.length > 0 && (
          <div className="hidden shrink-0 items-center gap-3 text-xs text-muted-foreground md:flex">
            <span>
              <span className="font-medium text-foreground">
                {services.length}
              </span>{" "}
              services
            </span>
          </div>
        )}
      </PageHeader>

      <div className="w-full space-y-4 px-3 py-3 md:px-5">
        {/* Why the payloads below can be read at all. Two sentences, because
            the tables are the explanation and this only has to point at them. */}
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          A service is a name and an ABI signature, stored on chain. Anything
          written against one carries its own schema, so a client can decode a
          payload from an application it has never heard of — including this
          page.
        </p>

        {module ? (
          <>
            <RegisterService module={module} />
            <TabStrip tabs={TABS} active={tab} onSelect={setTab} />
            {tab === "services" ? <ServicesTable /> : <RecordsTable />}
          </>
        ) : (
          /* Not an error and not an empty table. An empty table here would
             read as "this chain has no services", which is a different and
             wrong claim — there is no contract to have any. */
          <div className="border p-6 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">
              Not deployed on {chainName}
            </p>
            <p className="mt-1 max-w-md leading-relaxed">
              SlotData runs on the local chain only for now. Switch to Anvil in
              the sidebar to try it, or follow the indexer — it picks up a new
              deployment from the factory&rsquo;s verification event without
              needing a release of its own.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
