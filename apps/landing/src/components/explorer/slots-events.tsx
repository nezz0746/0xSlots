"use client";

import { LandPlot, List } from "lucide-react";
import { useState } from "react";
import { EventsTable } from "@/components/explorer/events-table";
import { SlotsTable } from "@/components/explorer/slots-table";
import { TabStrip, type TabStripItem } from "@/components/explorer-tabs";

/**
 * The explorer's Slots view, with Events folded in as a second tab.
 *
 * Events used to be its own top-level section in the sidebar. It moved here
 * because it is not a different THING to explore — it is the same slots, seen
 * as a stream of what happened to them rather than a snapshot of their current
 * state. Two tabs over one subject read more honestly than two sidebar entries.
 */
const TABS: TabStripItem[] = [
  { id: "slots", label: "Slots", icon: LandPlot },
  { id: "events", label: "Events", icon: List },
];

export function SlotsEvents() {
  const [tab, setTab] = useState<string>("slots");

  return (
    <div>
      <TabStrip tabs={TABS} active={tab} onSelect={setTab} />
      {tab === "events" ? <EventsTable /> : <SlotsTable />}
    </div>
  );
}
