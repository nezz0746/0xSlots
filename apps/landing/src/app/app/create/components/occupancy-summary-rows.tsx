"use client";

import { findKnownModule } from "@0xslots/contracts/slots";
import { ShieldCheck } from "lucide-react";
import { useFormContext } from "react-hook-form";
import { type Address, isAddress } from "viem";
import { useChain } from "@/context/chain";
import { truncateAddress } from "@/utils";
import type { CreateSlotFormValues } from "../schema";
import type { SectionId } from "../sections";

/**
 * The occupancy terms, as a summary row.
 *
 * Shared by the desktop summary card and the mobile drawer — they render the
 * same list, and occupancy is the one part of the form that changes what
 * holding the slot feels like, so it must not be visible on only one of them.
 *
 * The terms used to come from a dedicated occupancy policy. They now come from
 * the module, because the protocol folded policies into modules — but the row
 * stayed, and stayed labelled "Occupancy", because the question a reader is
 * asking here is "can this be taken from me, and when", not "which contract
 * implements that".
 */
export function OccupancySummaryRows({
  onJump,
}: {
  onJump?: (id: SectionId) => void;
}) {
  const form = useFormContext<CreateSlotFormValues>();
  const moduleMode = form.watch("moduleMode");
  const module = form.watch("module");
  const { chainId } = useChain();

  const label = (() => {
    if (moduleMode === "none" || !module) {
      // Always says something: "Instant buy" is itself a term worth confirming
      // before signing, not the absence of one.
      return "Instant buy";
    }
    const known = findKnownModule(chainId, module as Address);
    if (known) return known.name;
    return isAddress(module, { strict: false }) ? truncateAddress(module) : "—";
  })();

  const content = (
    <>
      <span className="text-muted-foreground flex items-center gap-1">
        <ShieldCheck className="size-3 text-violet-500" /> Occupancy
      </span>
      <span className="font-semibold text-xs truncate max-w-32">{label}</span>
    </>
  );

  if (!onJump) return <div className="flex justify-between">{content}</div>;

  return (
    <button
      type="button"
      onClick={() => onJump("module")}
      className="flex w-full justify-between rounded px-1 -mx-1 py-0.5 text-left hover:bg-muted/60 transition-colors"
    >
      {content}
    </button>
  );
}
