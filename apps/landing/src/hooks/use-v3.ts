"use client";

import {
  type AccountFieldsFragment,
  createSlotsClient,
  type SlotFieldsFragment,
} from "@0xslots/sdk";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useChain } from "@/context/chain";
import { indexerUrlFor } from "@/lib/indexer";
import {
  slotActivityQueryOptions,
  slotQueryOptions,
  slotsByRecipientQueryOptions,
} from "@/hooks/slot-queries";

// Re-export the slot type for convenience
export type { SlotFieldsFragment as V3Slot } from "@0xslots/sdk";

export function useSlotsClient() {
  const { chainId } = useChain();
  return useMemo(
    () =>
      createSlotsClient({
        chainId,
        apiUrl: indexerUrlFor(chainId),
      }),
    [chainId],
  );
}

export type SlotFilters = {
  moduleIds?: string[];
  recipient?: string;
  occupant?: string;
};

export type SlotSort = {
  orderBy: string;
  orderDirection: "asc" | "desc";
};

export type SlotPagination = {
  first?: number;
  skip?: number;
};

export function useSlots(
  filters?: SlotFilters,
  sort?: SlotSort,
  pagination?: SlotPagination,
) {
  const { chainId } = useChain();
  const client = useSlotsClient();

  const conditions: Record<string, unknown>[] = [];
  if (filters?.moduleIds && filters.moduleIds.length > 0) {
    conditions.push({ module_in: filters.moduleIds });
  }
  if (filters?.recipient) {
    conditions.push({ recipient: filters.recipient.toLowerCase() });
  }
  if (filters?.occupant) {
    conditions.push({ occupant: filters.occupant.toLowerCase() });
  }

  const where =
    conditions.length > 1
      ? { and: conditions }
      : conditions.length === 1
        ? conditions[0]
        : undefined;

  return useQuery({
    queryKey: ["slots", chainId, filters, sort, pagination],
    queryFn: async () => {
      const { slots } = await client.getSlots({
        limit: pagination?.first ?? 100,
        offset: pagination?.skip ?? 0,
        where: where as any,
        orderBy: (sort?.orderBy ?? "createdAt") as any,
        orderDirection: (sort?.orderDirection ?? "desc") as any,
      });
      return slots.items as SlotFieldsFragment[];
    },
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  });
}

export function useSlot(id: string) {
  const { chainId } = useChain();
  return useQuery({
    ...slotQueryOptions(chainId, id),
    enabled: !!id,
  });
}

export function useSlotsByRecipient(recipient: string) {
  const { chainId } = useChain();
  return useQuery({
    ...slotsByRecipientQueryOptions(chainId, recipient),
    enabled: !!recipient,
  });
}

export function useSlotsByOccupant(occupant: string) {
  const { chainId } = useChain();
  const client = useSlotsClient();
  return useQuery({
    queryKey: ["slots-occupant", chainId, occupant],
    queryFn: async () => {
      const { slots } = await client.getSlotsByOccupant({
        occupant: occupant.toLowerCase(),
        limit: 100,
      });
      return slots.items as SlotFieldsFragment[];
    },
    staleTime: 15_000,
    enabled: !!occupant,
  });
}

export function useFactory() {
  const { chainId } = useChain();
  const client = useSlotsClient();
  return useQuery({
    queryKey: ["factory", chainId],
    queryFn: async () => {
      const { factorys } = await client.getFactory();
      return factorys.items[0] ?? null;
    },
    staleTime: 30_000,
  });
}

export function useModules() {
  const { chainId } = useChain();
  const client = useSlotsClient();
  return useQuery({
    queryKey: ["modules", chainId],
    queryFn: async () => {
      const { modules } = await client.getModules({ limit: 100 });
      return modules.items;
    },
    staleTime: 30_000,
  });
}

export function useSlotPurchases(slotId: string) {
  const { chainId } = useChain();
  const client = useSlotsClient();
  return useQuery({
    queryKey: ["slot-purchases", chainId, slotId],
    queryFn: async () => {
      const { boughtEvents } = await client.getBoughtEvents({
        limit: 50,
        where: { slot: slotId.toLowerCase() },
        orderBy: "timestamp" as any,
        orderDirection: "desc" as any,
      });
      return boughtEvents.items;
    },
    staleTime: 10_000,
    enabled: !!slotId,
  });
}

export function useSlotsettlements(slotId: string) {
  const { chainId } = useChain();
  const client = useSlotsClient();
  return useQuery({
    queryKey: ["slot-settlements", chainId, slotId],
    queryFn: async () => {
      const { settledEvents } = await client.getSettledEvents({
        limit: 50,
        where: { slot: slotId.toLowerCase() },
        orderBy: "timestamp" as any,
        orderDirection: "desc" as any,
      });
      return settledEvents.items;
    },
    staleTime: 10_000,
    enabled: !!slotId,
  });
}

export function useSlotTaxCollections(slotId: string) {
  const { chainId } = useChain();
  const client = useSlotsClient();
  return useQuery({
    queryKey: ["slot-tax-collections", chainId, slotId],
    queryFn: async () => {
      const { taxCollectedEvents } = await client.getTaxCollectedEvents({
        limit: 50,
        where: { slot: slotId.toLowerCase() },
        orderBy: "timestamp" as any,
        orderDirection: "desc" as any,
      });
      return taxCollectedEvents.items;
    },
    staleTime: 10_000,
    enabled: !!slotId,
  });
}

export function useSlotActivity(slotId: string) {
  const { chainId } = useChain();
  return useQuery({
    ...slotActivityQueryOptions(chainId, slotId),
    enabled: !!slotId,
  });
}

export function useRecentEvents() {
  const { chainId } = useChain();
  const client = useSlotsClient();
  return useQuery({
    queryKey: ["recent-events", chainId],
    queryFn: async () => {
      return client.getRecentEvents({ limit: 100 });
    },
    staleTime: 10_000,
  });
}

export function useAccounts() {
  const { chainId } = useChain();
  const client = useSlotsClient();
  return useQuery({
    queryKey: ["accounts", chainId],
    queryFn: async () => {
      const { accounts } = await client.getAccounts({
        limit: 100,
        orderBy: "slotCount" as any,
        orderDirection: "desc" as any,
        where: { slotCount_gt: 0 } as any,
      });
      return accounts.items as AccountFieldsFragment[];
    },
    staleTime: 15_000,
  });
}
