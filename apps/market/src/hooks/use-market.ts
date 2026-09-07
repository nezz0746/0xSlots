"use client";

import { createCollectionsClient, createSlotsClient } from "@0xslots/sdk/slots";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { Address } from "viem";
import { usePublicClient, useWalletClient } from "wagmi";

import { factoryFor } from "@/lib/chains";
import {
  type IndexedCollection,
  type IndexedToken,
  query,
} from "@/lib/indexer";

/** The SDK clients, wired to the connected chain. */
export function useClients(chainId: number) {
  const publicClient = usePublicClient({ chainId });
  const { data: walletClient } = useWalletClient({ chainId });

  return useMemo(() => {
    const shared = {
      publicClient: publicClient as never,
      walletClient: walletClient as never,
    };
    return {
      collections: createCollectionsClient({
        ...shared,
        factoryAddress: factoryFor(chainId),
      }),
      // Buying a token IS buying its slot, so the marketplace needs both
      // clients and only one of them is about NFTs.
      slots: createSlotsClient(shared),
      ready: !!publicClient,
      canWrite: !!walletClient,
    };
  }, [publicClient, walletClient, chainId]);
}

const COLLECTIONS = `
  query Collections($chainId: Int!) {
    collections(where: { chainId: $chainId }, orderBy: "createdAt", orderDirection: "desc") {
      items {
        id chainId name symbol maxSupply totalMinted currency recipient
        taxBps minDepositSeconds manager owner baseURI createdAt
      }
    }
  }`;

export function useCollections(chainId: number) {
  return useQuery({
    queryKey: ["collections", chainId],
    queryFn: async () => {
      const d = await query<{ collections: { items: IndexedCollection[] } }>(
        chainId,
        COLLECTIONS,
        { chainId },
      );
      return d.collections.items;
    },
  });
}

// `Float!` rather than `Int!`, and not a typo: ponder types `chainId` as `Int`
// inside a `where` filter and as `Float` as a positional argument. The two
// queries below therefore disagree, and have to.
const COLLECTION = `
  query Collection($id: String!, $chainId: Float!) {
    collection(id: $id, chainId: $chainId) {
      id chainId name symbol maxSupply totalMinted currency recipient
      taxBps minDepositSeconds manager owner baseURI createdAt
    }
  }`;

export function useCollection(chainId: number, address?: Address) {
  return useQuery({
    queryKey: ["collection", chainId, address],
    enabled: !!address,
    // Supply moves whenever anyone mints, not only when this tab does.
    refetchInterval: 10_000,
    queryFn: async () => {
      const d = await query<{ collection: IndexedCollection | null }>(
        chainId,
        COLLECTION,
        { id: address!.toLowerCase(), chainId },
      );
      return d.collection;
    },
  });
}

const TOKENS = `
  query Tokens($collection: String!, $chainId: Int!) {
    collectionTokens(
      where: { collection: $collection, chainId: $chainId }
      orderBy: "tokenId"
      orderDirection: "asc"
    ) {
      items { id tokenId slot owner minter mintedAt }
    }
  }`;

export function useTokens(chainId: number, collection?: Address) {
  return useQuery({
    queryKey: ["tokens", chainId, collection],
    enabled: !!collection,
    // Ownership changes whenever a slot changes hands, which is the whole
    // point of the collection — so this is the one query worth polling.
    refetchInterval: 10_000,
    queryFn: async () => {
      const d = await query<{ collectionTokens: { items: IndexedToken[] } }>(
        chainId,
        TOKENS,
        { collection: collection!.toLowerCase(), chainId },
      );
      return d.collectionTokens.items;
    },
  });
}

/** The live slot behind a token: price, occupant, escrow, runway. */
export function useTokenSlot(chainId: number, slot?: Address) {
  const { slots, ready } = useClients(chainId);
  return useQuery({
    queryKey: ["token-slot", chainId, slot],
    enabled: !!slot && ready,
    refetchInterval: 5_000,
    queryFn: () => slots.slotState(slot!),
  });
}

/** What a mint at `valuation` costs, asked of the collection itself. */
export function useMintQuote(
  chainId: number,
  collection?: Address,
  valuation?: bigint,
) {
  const { collections, ready } = useClients(chainId);
  return useQuery({
    queryKey: ["mint-quote", chainId, collection, valuation?.toString()],
    enabled: !!collection && !!valuation && valuation > 0n && ready,
    queryFn: () => collections.quoteMint(collection!, valuation!),
  });
}

/**
 * The work behind a token, when its collection points at one.
 *
 * `SlotBoundNFT` is a plain ERC-721 in this respect: `tokenURI` is the base
 * plus the id, so the metadata is fetched directly rather than through a
 * contract read per tile. A collection with no baseURI has no art yet and this
 * returns nothing — the grid draws the token's own plate instead.
 *
 * Never retried and never thrown: a collection can point anywhere, and an
 * unreachable host is a missing picture, not a broken page.
 */
export function useTokenArt(
  baseURI: string | null | undefined,
  tokenId?: string,
) {
  return useQuery({
    queryKey: ["token-art", baseURI, tokenId],
    enabled: !!baseURI && !!tokenId,
    retry: false,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const url = gateway(`${baseURI}${tokenId}`);
      const res = await fetch(url);
      if (!res.ok) return null;

      // Two conventions, because both exist and one of them was ours. ERC-721
      // says `tokenURI` names a JSON document with an `image` field, which is
      // what an upload through this app now writes. But pointing a base
      // straight at images is the obvious thing to do by hand, and reading
      // that as JSON threw — which surfaced as the generated plate,
      // indistinguishable from having no art at all.
      const type = res.headers.get("content-type") ?? "";
      if (type.startsWith("image/") || type.startsWith("video/"))
        return { image: url, name: undefined };

      try {
        const meta = (await res.json()) as { image?: string; name?: string };
        return meta.image
          ? { image: gateway(meta.image), name: meta.name }
          : null;
      } catch {
        return null;
      }
    },
  });
}

/**
 * ipfs:// is not a scheme a browser fetches, and a public gateway is not a
 * host it can fetch FROM.
 *
 * Reading metadata means `fetch`, which is cross-origin against a gateway and
 * fails without CORS — the same URL that returns 200 from a terminal throws
 * "Failed to fetch" in the page. So reads go through this app's own route,
 * which fetches server-side. That also lets a deployment point at Économe's
 * own node, which holds the pins and serves a fresh upload immediately rather
 * than after the DHT has caught up.
 */
function gateway(uri: string): string {
  return uri.startsWith("ipfs://")
    ? `/api/ipfs/${uri.slice("ipfs://".length)}`
    : uri;
}
