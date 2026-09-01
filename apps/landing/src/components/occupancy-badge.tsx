"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Whether the slot is held, and whether it is about to be taken away.
 *
 * There used to be a SOLD state here, for a buy that was binding but would only
 * complete at the next epoch boundary. Epoch scheduling is gone — buys complete
 * in the transaction that makes them — so a slot is only ever held or free.
 *
 * INSOLVENT cannot come from the indexer: solvency is a function of
 * `block.timestamp` against the deposit, and moves while nothing at all happens
 * on chain. It comes from `useSlotState`, a live chain read.
 */
export function OccupancyBadge({
  occupant,
  insolvent,
  className,
}: {
  occupant?: string | null;
  insolvent?: boolean;
  className?: string;
}) {
  if (insolvent) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="destructive" className={className}>
              INSOLVENT
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            The deposit is exhausted. Anyone can liquidate this slot, and it
            becomes claimable for a deposit alone — no hook can prevent it.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Badge variant={occupant ? "default" : "secondary"} className={className}>
      {occupant ? "OCCUPIED" : "VACANT"}
    </Badge>
  );
}
