"use client";

import { getChainTokens } from "@0xslots/sdk";
import { ShieldCheck } from "lucide-react";
import { useFormContext } from "react-hook-form";
import { isAddress } from "viem";
import { getVouchedPolicy } from "@/config/policies";
import { useChain } from "@/context/chain";
import { truncateAddress } from "@/utils";
import { type CreateSlotFormValues, formatValueUnit } from "../schema";

/**
 * The occupancy terms, as summary rows.
 *
 * Shared by the desktop summary card and the mobile drawer — they render the
 * same list, and occupancy is the one part of the form that changes what
 * holding the slot feels like, so it must not be visible on only one of them.
 */
export function OccupancySummaryRows() {
  const form = useFormContext<CreateSlotFormValues>();
  const policyMode = form.watch("occupancyPolicyMode");
  const tenureValue = form.watch("tenureValue");
  const tenureUnit = form.watch("tenureUnit");
  const occupancyPolicy = form.watch("occupancyPolicy");
  const minPriceValue = form.watch("minPriceValue");

  const { chainId } = useChain();
  const presetCurrency = form.watch("presetCurrency");
  const symbol = getChainTokens(chainId).find(
    (t) => t.address === presetCurrency,
  )?.symbol;

  const policyLabel = (() => {
    switch (policyMode) {
      case "tenure":
        return `${formatValueUnit(tenureValue, tenureUnit)} min.`;
      case "price":
        return `min ${minPriceValue} ${symbol ?? ""}`.trim();
      case "known":
        return occupancyPolicy
          ? (getVouchedPolicy(occupancyPolicy, chainId)?.label ??
              truncateAddress(occupancyPolicy))
          : "—";
      case "custom":
        return isAddress(occupancyPolicy as `0x${string}`)
          ? truncateAddress(occupancyPolicy)
          : "—";
      default:
        // Always says something: "Instant buy" is itself a term worth
        // confirming before signing, not the absence of one.
        return "Instant buy";
    }
  })();

  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground flex items-center gap-1">
        <ShieldCheck className="size-3 text-violet-500" /> Occupancy
      </span>
      <span className="font-semibold text-xs truncate max-w-32">
        {policyLabel}
      </span>
    </div>
  );
}
