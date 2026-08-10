import {
  createSlotsClient,
  type SlotFieldsFragment,
  type SlotsChain,
} from "@0xslots/sdk";
import { queryOptions } from "@tanstack/react-query";
import { subgraphUrlFor } from "@/config/subgraph";

/**
 * Create a SlotsClient instance for a given chain.
 * Works both server-side and client-side.
 */
export function createServerSlotsClient(chainId: SlotsChain) {
  return createSlotsClient({
    chainId,
    subgraphUrl: subgraphUrlFor(chainId),
    subgraphApiKey: process.env.NEXT_PUBLIC_SUBGRAPH_API_KEY,
  });
}

/** Query options for fetching a single slot from the subgraph. */
export function slotQueryOptions(chainId: SlotsChain, id: string) {
  return queryOptions({
    queryKey: ["slot", chainId, id],
    queryFn: async () => {
      const client = createServerSlotsClient(chainId);
      const { slot } = await client.getSlot({ id: id.toLowerCase() });
      return (slot as SlotFieldsFragment | null) ?? null;
    },
    staleTime: 10_000,
  });
}

/** Query options for fetching slots by recipient from the subgraph. */
export function slotsByRecipientQueryOptions(
  chainId: SlotsChain,
  recipient: string,
) {
  return queryOptions({
    queryKey: ["slots-recipient", chainId, recipient],
    queryFn: async () => {
      const client = createServerSlotsClient(chainId);
      const { slots } = await client.getSlotsByRecipient({
        recipient: recipient.toLowerCase(),
        first: 100,
      });
      return slots as SlotFieldsFragment[];
    },
    staleTime: 15_000,
  });
}

/** Query options for fetching slot activity from the subgraph. */
export function slotActivityQueryOptions(chainId: SlotsChain, slotId: string) {
  return queryOptions({
    queryKey: ["slot-activity", chainId, slotId],
    queryFn: async () => {
      const client = createServerSlotsClient(chainId);
      return client.getSlotActivity({
        slotId: slotId.toLowerCase(),
        first: 100,
      });
    },
    staleTime: 10_000,
  });
}
