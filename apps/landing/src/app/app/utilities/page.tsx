"use client";

import { Puzzle } from "lucide-react";
import { ModulesTable } from "@/components/explorer/modules-table";
import { PageHeader } from "@/components/page-header";

/**
 * What a slot can be made to DO.
 *
 * A route rather than a tab on the explorer, which is where it used to live.
 * The explorer's three tabs are one dataset sliced three ways — the same slots,
 * by slot, by recipient, by event — so moving between them changes the view.
 * A utility is not a slice of that; it is one of the two contracts a slot
 * plugs in, and the catalogue of them answers "what is possible" rather than
 * "what is happening". Sitting it beside `/app/policies`, the other pluggable
 * half, is what makes that pair legible.
 */
export default function UtilitiesPage() {
  return (
    <div className="min-h-screen">
      <PageHeader>
        <div className="flex items-center gap-3">
          <Puzzle className="size-5 text-muted-foreground" aria-hidden />
          <div className="flex flex-col">
            <h1 className="text-xl font-bold tracking-tight leading-tight">
              Utilities
            </h1>
            <p className="text-muted-foreground text-xs">
              What holding a slot grants
            </p>
          </div>
        </div>
      </PageHeader>

      <div className="w-full px-3 md:px-5 py-3">
        <ModulesTable />
      </div>
    </div>
  );
}
