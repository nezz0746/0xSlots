"use client";

import { slotDataAddress } from "@0xslots/contracts";
import { useQuery } from "@tanstack/react-query";
import { useChain } from "@/context/chain";
import { useSlotsClient } from "./use-slots-client";

/**
 * The SlotData deployment for the active chain, or null where none exists.
 *
 * Null is a first-class answer, not an error: SlotData is on anvil only today,
 * and the screen's job on base is to say so rather than to render an empty
 * table that looks like a chain with no services on it. The address table in
 * `@0xslots/contracts` is the single place that changes when one ships.
 */
export function useSlotDataModule(): `0x${string}` | null {
  const { chainId } = useChain();
  const table = slotDataAddress as Record<number, `0x${string}` | undefined>;
  return table[chainId] ?? null;
}

export function useDataServices() {
  const { chainId } = useChain();
  const client = useSlotsClient();
  const module = useSlotDataModule();

  return useQuery({
    queryKey: ["data-services", chainId],
    queryFn: async () => {
      const { dataServices } = await client.getDataServices({
        limit: 100,
        orderBy: "serviceId",
        orderDirection: "asc",
      });
      return dataServices.items;
    },
    staleTime: 30_000,
    enabled: !!module,
  });
}

/**
 * Records, newest write first.
 *
 * Ordered by `updatedAt` rather than `createdAt` because a record moves in
 * place when its tenant overwrites it — sorting by creation would bury the
 * freshest payload on the page under rows nobody has touched in weeks.
 */
export function useSlotDataRecords(slot?: string) {
  const { chainId } = useChain();
  const client = useSlotsClient();
  const module = useSlotDataModule();

  return useQuery({
    queryKey: ["slot-data-records", chainId, slot ?? "all"],
    queryFn: async () => {
      const { slotDataRecords } = await client.getSlotDataRecords({
        limit: 100,
        orderBy: "updatedAt",
        orderDirection: "desc",
        ...(slot ? { where: { slot: slot.toLowerCase() } } : {}),
      });
      return slotDataRecords.items;
    },
    staleTime: 10_000,
    enabled: !!module,
  });
}

/** Every write, including ones since overwritten or cleared. */
export function useSlotDataWrites(limit = 50) {
  const { chainId } = useChain();
  const client = useSlotsClient();
  const module = useSlotDataModule();

  return useQuery({
    queryKey: ["slot-data-writes", chainId, limit],
    queryFn: async () => {
      const { slotDataWroteEvents } = await client.getSlotDataWrites({
        limit,
        orderBy: "timestamp",
        orderDirection: "desc",
      });
      return slotDataWroteEvents.items;
    },
    staleTime: 10_000,
    enabled: !!module,
  });
}
