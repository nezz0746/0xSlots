import {
  createSlotsClient,
  type SlotFieldsFragment,
  type SlotsChain,
  SubgraphSource,
} from "@0xslots/sdk";
import { queryOptions } from "@tanstack/react-query";

/**
 * Create a SlotsClient for a chain and a subgraph deployment.
 * Works both server-side and client-side.
 *
 * `source` defaults to the decentralized network, which is what the server
 * must use: the Studio preference lives in localStorage and cannot be read
 * during a server render. Client callers pass `useSubgraphSource().source`.
 */
export function createServerSlotsClient(
  chainId: SlotsChain,
  source: SubgraphSource = SubgraphSource.Network,
) {
  return createSlotsClient({
    chainId,
    subgraphSource: source,
    subgraphApiKey: process.env.NEXT_PUBLIC_SUBGRAPH_API_KEY,
  });
}

/**
 * The subgraph source is part of every query key below.
 *
 * It has to be. These pages prefetch on the server and hydrate through a
 * `HydrationBoundary`, and the server always renders from the network — it
 * cannot see a browser preference. Were the key the same for both, React Query
 * would treat the dehydrated network result as a fresh answer for the Studio
 * query and never refetch, so the switch would appear to do nothing until the
 * `staleTime` elapsed.
 *
 * Keying them apart makes the two deployments distinct cache entries: flipping
 * the switch refetches immediately, and flipping back reuses what was already
 * loaded rather than re-fetching it.
 */
export function withSource(parts: unknown[], source: SubgraphSource) {
  // The network key is left exactly as it was, so the server's dehydrated
  // entries still match the client's default and hydrate without a refetch.
  return source === SubgraphSource.Network ? parts : [...parts, source];
}

/** Query options for fetching a single slot from the subgraph. */
export function slotQueryOptions(
  chainId: SlotsChain,
  id: string,
  source: SubgraphSource = SubgraphSource.Network,
) {
  return queryOptions({
    queryKey: withSource(["slot", chainId, id], source),
    queryFn: async () => {
      const client = createServerSlotsClient(chainId, source);
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
  source: SubgraphSource = SubgraphSource.Network,
) {
  return queryOptions({
    queryKey: withSource(["slots-recipient", chainId, recipient], source),
    queryFn: async () => {
      const client = createServerSlotsClient(chainId, source);
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
export function slotActivityQueryOptions(
  chainId: SlotsChain,
  slotId: string,
  source: SubgraphSource = SubgraphSource.Network,
) {
  return queryOptions({
    queryKey: withSource(["slot-activity", chainId, slotId], source),
    queryFn: async () => {
      const client = createServerSlotsClient(chainId, source);
      return client.getSlotActivity({
        slotId: slotId.toLowerCase(),
        first: 100,
      });
    },
    staleTime: 10_000,
  });
}
