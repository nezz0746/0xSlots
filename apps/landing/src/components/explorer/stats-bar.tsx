"use client";

import { LandPlot } from "lucide-react";
import { useSlotCounts } from "@/hooks/use-v3";

/**
 * Protocol totals for the active chain.
 *
 * All three numbers come from `useSlotCounts`, which reads them as server-side
 * `totalCount`s. They used to have two different sources — a global count from
 * the factory beside occupancy counted from a 100-row page — so the strip read
 * "239 slots, 13 occupied, 87 vacant" and the last two summed to the page size
 * rather than to the first.
 */
export function StatsBar() {
  const { data } = useSlotCounts();
  const total = data?.total ?? 0;
  const occupied = data?.occupied ?? 0;
  const vacant = data?.vacant ?? 0;

  return (
    <div className="hidden md:flex items-center gap-5">
      <div className="flex items-center gap-1.5">
        <LandPlot className="size-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Slots</span>
        <span className="text-sm font-bold">{total}</span>
      </div>
      <div className="w-px h-3 bg-border" />
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Occupied</span>
        <span className="text-sm font-bold">{occupied}</span>
      </div>
      <div className="w-px h-3 bg-border" />
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Vacant</span>
        <span className="text-sm font-bold">{vacant}</span>
      </div>
    </div>
  );
}
