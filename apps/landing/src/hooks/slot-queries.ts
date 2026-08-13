import {
  createSlotsClient,
  type SlotFieldsFragment,
  type SlotsChain,
} from "@0xslots/sdk";
import { queryOptions } from "@tanstack/react-query";
import { indexerUrlFor } from "@/lib/indexer";

/**
 * Create a SlotsClient for a chain. Works server-side and client-side.
 *
 * The `source` parameter is gone along with the network/Studio switch: there is
 * one indexer endpoint now, so server and client always read the same thing.
 * That also removes the reason query keys had to carry a source — see the
 * deleted `withSource`. Server prefetch and client hydration now match by
 * construction.
 */
export function createServerSlotsClient(chainId: SlotsChain) {
  return createSlotsClient({
    chainId,
    apiUrl: indexerUrlFor(chainId),
  });
}

/** Query options for a single slot. */
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

/** Query options for slots paying out to a recipient. */
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
        limit: 100,
      });
      // Plural fields are pages now — `{ items, totalCount, pageInfo }`.
      return slots.items as SlotFieldsFragment[];
    },
    staleTime: 15_000,
  });
}

/** Query options for one slot's full activity feed. */
export function slotActivityQueryOptions(chainId: SlotsChain, slotId: string) {
  return queryOptions({
    queryKey: ["slot-activity", chainId, slotId],
    queryFn: async () => {
      const client = createServerSlotsClient(chainId);
      return client.getSlotActivity({
        slot: slotId.toLowerCase(),
        limit: 100,
      });
    },
    staleTime: 10_000,
  });
}
