"use client";

import type { LucideIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { cn } from "@/lib/utils";

interface Tab {
  id: string;
  label: string;
  icon?: LucideIcon;
  content: () => ReactNode;
}

export interface TabStripItem {
  id: string;
  label: string;
  icon?: LucideIcon;
}

/**
 * The row of tab buttons on its own.
 *
 * Split out from ExplorerTabs so a caller can place the strip and its content
 * independently — the explorer needs that to drive one selection from either
 * the desktop sidebar or the mobile strip without mounting content twice.
 */
export function TabStrip({
  tabs,
  active,
  onSelect,
  className,
}: {
  tabs: TabStripItem[];
  active: string | undefined;
  onSelect: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex border-b mb-2", className)}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelect(tab.id)}
            className={cn(
              "text-sm px-2 md:px-6 py-3 border-b-2 -mb-px transition-colors flex items-center gap-1.5",
              active === tab.id
                ? "border-primary font-semibold text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {Icon && <Icon className="size-3.5" />}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

/** Self-contained tabs: strip plus the active tab's content. */
export function ExplorerTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0]?.id);

  return (
    <div>
      <TabStrip tabs={tabs} active={active} onSelect={setActive} />
      {tabs.find((t) => t.id === active)?.content()}
    </div>
  );
}
