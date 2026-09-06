"use client";

import { MoreHorizontal } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useState } from "react";

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
    <DropdownMenu.Root onOpenChange={(open) => !open && setArmed(null)}>
      <DropdownMenu.Trigger
        disabled={disabled}
        aria-label="More actions"
        className="-mr-1 -mt-1 grid size-7 shrink-0 place-items-center border border-transparent text-dim transition-colors hover:border-line hover:text-ink disabled:opacity-40"
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-200 w-64 border border-line bg-paper p-1 text-ink shadow-lg"
        >
          {actions.map((action) => {
            const asking = armed === action.key;
            return (
              <DropdownMenu.Item
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
                className={`cursor-default select-none px-2.5 py-2 outline-none transition-colors focus:bg-lift ${
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
                <p className="mt-1 text-[11px] leading-snug text-dim">
                  {action.note}
                </p>
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
