"use client";

import { useSlotAction } from "@0xslots/sdk/slots/react";
import { useCallback } from "react";
import { toast } from "sonner";
import { useChain } from "@/context/chain";
import { useRefreshSlots, useSlotsFactory } from "./use-slots";

/**
 * Every slot write, wired to this app's chain, factory and toasts.
 *
 * One wrapper rather than the SDK hook at each call site, because the three
 * things every call site would otherwise repeat — which chain, which factory,
 * and re-reading the slot once the receipt lands — are the three things that
 * are silently wrong when one of them is forgotten.
 */
export function useSlotsAction() {
  const { chainId } = useChain();
  const factoryAddress = useSlotsFactory();
  const refresh = useRefreshSlots();

  const onSuccess = useCallback(
    (label: string) => {
      toast.success(`${label} confirmed`);
      refresh();
    },
    [refresh],
  );

  // The SDK surfaces a hook's own revert reason here rather than "call
  // failed" — a `TenureNotElapsed` or a `NotManager` is the most useful thing
  // this app can say, so it is shown verbatim.
  const onError = useCallback((label: string, error: string) => {
    toast.error(label, { description: error });
  }, []);

  return useSlotAction({ chainId, factoryAddress, onSuccess, onError });
}
