"use client";

import { MoreHorizontal } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * The actions that are not the point of the panel.
 *
 * Release, liquidate and collect are real and occasionally urgent, and none of
 * them belongs beside the control somebody came here to use. As buttons they
 * competed with repricing for the same attention and made a holder's panel
 * read like a control room; behind a menu they are one glyph until wanted.
 *
 * Each carries a line saying what it does, because none of these words means
 * anything on its own — "collect" in particular sounds like it pays the person
 * pressing it, and it does not.
 *
 * Only what the viewer can actually do is listed. An action shown and refused
 * is worse than an action absent: it reads as a permission problem rather than
 * as a state that has not arrived.
 */
export type SlotAction = {
  key: string;
  label: string;
  note: string;
  /** Irreversible from the presser's point of view, so it asks twice. */
  destructive?: boolean;
  run: () => void | Promise<void>;
};

export function SlotActions({
  actions,
  disabled,
}: {
  actions: SlotAction[];
  disabled?: boolean;
}) {
  const [armed, setArmed] = useState<string | null>(null);
  if (actions.length === 0) return null;

  return (
    <DropdownMenu onOpenChange={(open) => !open && setArmed(null)}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={disabled}
          aria-label="More actions"
          className="-mr-1 -mt-1 shrink-0 text-muted-foreground"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {actions.map((action) => {
          const asking = armed === action.key;
          return (
            <DropdownMenuItem
              key={action.key}
              // Kept open on the first press of a destructive item, so the
              // confirmation is on the thing being confirmed.
              onSelect={(e) => {
                if (action.destructive && !asking) {
                  e.preventDefault();
                  setArmed(action.key);
                  return;
                }
                void action.run();
              }}
              className={`flex-col items-start gap-1 ${
                asking ? "bg-ebbing/10" : ""
              }`}
            >
              <div
                className={`text-[13px] leading-none ${
                  action.destructive ? "text-ebbing" : ""
                }`}
              >
                {asking ? `${action.label} — press again` : action.label}
              </div>
              <p className="text-[11px] leading-snug text-muted-foreground">
                {action.note}
              </p>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
