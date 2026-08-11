"use client";

import { FlaskConical } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSubgraphSource } from "@/context/subgraph-source";

/**
 * Read the development (Subgraph Studio) deployment instead of the
 * decentralized network.
 *
 * Deliberately always visible rather than gated on `NODE_ENV`. The reason to
 * have this at all is to inspect a freshly published subgraph on a DEPLOYED
 * build — a preview, someone else's machine — which is exactly where a
 * build-time flag cannot help. It is per-browser and persisted, so switching it
 * on affects nobody else.
 *
 * The "on" state is loud on purpose. Every list, page and count in the app is
 * then coming from a rate-limited development index that may be mid-sync, and
 * quietly reading a different source is the kind of thing that costs an hour
 * when the numbers look wrong.
 */
export function SubgraphSourceSwitch() {
  const { isStudio, setStudio } = useSubgraphSource();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          role="switch"
          aria-checked={isStudio}
          aria-label="Read from the development subgraph"
          onClick={() => setStudio(!isStudio)}
          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors ${
            isStudio
              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              : "text-muted-foreground hover:bg-muted/60"
          }`}
        >
          <FlaskConical className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="flex-1 text-left">Dev subgraph</span>
          <span
            aria-hidden="true"
            className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${
              isStudio ? "bg-amber-500" : "bg-muted-foreground/25"
            }`}
          >
            <span
              className={`absolute top-0.5 size-3 rounded-full bg-background transition-all ${
                isStudio ? "left-3.5" : "left-0.5"
              }`}
            />
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-64">
        {isStudio ? (
          <>
            <p>Reading Subgraph Studio.</p>
            <p className="text-muted-foreground">
              A development deployment — rate-limited, and it follows whatever
              was published most recently. Not what other users see.
            </p>
          </>
        ) : (
          <>
            <p>Reading the decentralized network.</p>
            <p className="text-muted-foreground">
              Switch to Studio to see a freshly published subgraph before
              indexers pick it up.
            </p>
          </>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
