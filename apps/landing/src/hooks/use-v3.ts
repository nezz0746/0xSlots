"use client";

import {
  type AccountFieldsFragment,
  createSlotsClient,
  type SlotFieldsFragment,
} from "@0xslots/sdk";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useChain } from "@/context/chain";
import { useSubgraphSource } from "@/context/subgraph-source";
import {
  slotActivityQueryOptions,
  slotQueryOptions,
  slotsByRecipientQueryOptions,
  withSource,
} from "@/hooks/slot-queries";

// Re-export the slot type for convenience
export type { SlotFieldsFragment as V3Slot } from "@0xslots/sdk";

export function useSlotsClient() {
  const { chainId } = useChain();
  const { source } = useSubgraphSource();
  return useMemo(
    () =>
      createSlotsClient({
        chainId,
        subgraphSource: source,
        subgraphApiKey: process.env.NEXT_PUBLIC_SUBGRAPH_API_KEY,
      }),
    [chainId, source],
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
  const { source } = useSubgraphSource();
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
    queryKey: withSource(["slots", chainId, filters, sort, pagination], source),
    queryFn: async () => {
      const { slots } = await client.getSlots({
        first: pagination?.first ?? 100,
        skip: pagination?.skip ?? 0,
        where: where as any,
        orderBy: (sort?.orderBy ?? "createdAt") as any,
        orderDirection: (sort?.orderDirection ?? "desc") as any,
      });
      return slots as SlotFieldsFragment[];
    },
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  });
}

export function useSlot(id: string) {
  const { chainId } = useChain();
  const { source } = useSubgraphSource();
  return useQuery({
    ...slotQueryOptions(chainId, id, source),
    enabled: !!id,
  });
}

export function useSlotsByRecipient(recipient: string) {
  const { chainId } = useChain();
  const { source } = useSubgraphSource();
  return useQuery({
    ...slotsByRecipientQueryOptions(chainId, recipient, source),
    enabled: !!recipient,
  });
}

export function useSlotsByOccupant(occupant: string) {
  const { chainId } = useChain();
  const { source } = useSubgraphSource();
  const client = useSlotsClient();
  return useQuery({
    queryKey: withSource(["slots-occupant", chainId, occupant], source),
    queryFn: async () => {
      const { slots } = await client.getSlotsByOccupant({
        occupant: occupant.toLowerCase(),
        first: 100,
      });
      return slots as SlotFieldsFragment[];
    },
    staleTime: 15_000,
    enabled: !!occupant,
  });
}

export function useFactory() {
  const { chainId } = useChain();
  const { source } = useSubgraphSource();
  const client = useSlotsClient();
  return useQuery({
    queryKey: withSource(["factory", chainId], source),
    queryFn: async () => {
      const { factories } = await client.getFactory();
      return factories[0] ?? null;
    },
    staleTime: 30_000,
  });
}

export function useModules() {
  const { chainId } = useChain();
  const { source } = useSubgraphSource();
  const client = useSlotsClient();
  return useQuery({
    queryKey: withSource(["modules", chainId], source),
    queryFn: async () => {
      const { modules } = await client.getModules({ first: 100 });
      return modules;
    },
    staleTime: 30_000,
  });
}

export function useSlotPurchases(slotId: string) {
  const { chainId } = useChain();
  const { source } = useSubgraphSource();
  const client = useSlotsClient();
  return useQuery({
    queryKey: withSource(["slot-purchases", chainId, slotId], source),
    queryFn: async () => {
      const { boughtEvents } = await client.getBoughtEvents({
        first: 50,
        where: { slot: slotId.toLowerCase() },
        orderBy: "timestamp" as any,
        orderDirection: "desc" as any,
      });
      return boughtEvents;
    },
    staleTime: 10_000,
    enabled: !!slotId,
  });
}

export function useSlotsettlements(slotId: string) {
  const { chainId } = useChain();
  const { source } = useSubgraphSource();
  const client = useSlotsClient();
  return useQuery({
    queryKey: withSource(["slot-settlements", chainId, slotId], source),
    queryFn: async () => {
      const { settledEvents } = await client.getSettledEvents({
        first: 50,
        where: { slot: slotId.toLowerCase() },
        orderBy: "timestamp" as any,
        orderDirection: "desc" as any,
      });
      return settledEvents;
    },
    staleTime: 10_000,
    enabled: !!slotId,
  });
}

export function useSlotTaxCollections(slotId: string) {
  const { chainId } = useChain();
  const { source } = useSubgraphSource();
  const client = useSlotsClient();
  return useQuery({
    queryKey: withSource(["slot-tax-collections", chainId, slotId], source),
    queryFn: async () => {
      const { taxCollectedEvents } = await client.getTaxCollectedEvents({
        first: 50,
        where: { slot: slotId.toLowerCase() },
        orderBy: "timestamp" as any,
        orderDirection: "desc" as any,
      });
      return taxCollectedEvents;
    },
    staleTime: 10_000,
    enabled: !!slotId,
  });
}

export function useSlotActivity(slotId: string) {
  const { chainId } = useChain();
  const { source } = useSubgraphSource();
  return useQuery({
    ...slotActivityQueryOptions(chainId, slotId, source),
    enabled: !!slotId,
  });
}

export function useRecentEvents() {
  const { chainId } = useChain();
  const { source } = useSubgraphSource();
  const client = useSlotsClient();
  return useQuery({
    queryKey: withSource(["recent-events", chainId], source),
    queryFn: async () => {
      return client.getRecentEvents({ first: 100 });
    },
    staleTime: 10_000,
  });
}

export function useAccounts() {
  const { chainId } = useChain();
  const { source } = useSubgraphSource();
  const client = useSlotsClient();
  return useQuery({
    queryKey: withSource(["accounts", chainId], source),
    queryFn: async () => {
      const { accounts } = await client.getAccounts({
        first: 100,
        orderBy: "slotCount" as any,
        orderDirection: "desc" as any,
        where: { slotCount_gt: 0 } as any,
      });
      return accounts as AccountFieldsFragment[];
    },
    staleTime: 15_000,
  });
}
