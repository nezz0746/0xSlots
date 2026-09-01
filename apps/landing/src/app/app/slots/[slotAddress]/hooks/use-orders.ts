"use client";

import { offerBookAbi, offerBookAddress } from "@0xslots/contracts/slots";
import type { SellOrder } from "@0xslots/sdk/slots";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { Address, Hex } from "viem";
import { usePublicClient } from "wagmi";
import { useChain } from "@/context/chain";

/**
 * The on-chain offer book for one slot.
 *
 * ── Discovery, not settlement ────────────────────────────────────────────
 *
 * A signed sell order is how a sale SETTLES: the occupant hands
 * `(order, signature)` to `Slot.sell`, which re-verifies it, so nothing here
 * can alter the terms the bidder agreed to. The book is how a bid is FOUND —
 * bidders publish their signed terms, anyone reads them, the occupant accepts
 * the best. It never executes and never custodies funds, which is exactly why
 * it is safe to treat as untrusted infrastructure.
 *
 * An earlier version of this hook kept orders in `localStorage`, on the belief
 * that a bid was only ever handed over privately. That was wrong, and the cost
 * of being wrong was the interesting part: a per-browser store cannot show an
 * occupant the offer a stranger just posted, which is the single case the
 * feature exists for.
 *
 * ── Two rules that look like details and are not ─────────────────────────
 *
 * 1. The badge counts `liveCount`, NEVER `offerCount`. `offerCount` is the
 *    number of entries ever posted — cancelled, expired and filled included —
 *    so it overstates the book and, having no way down, never falls again.
 *
 * 2. The list filters on `isLive`, NEVER `fundable`. They answer different
 *    questions: `fundable` asks only whether the bidder could still pay, and a
 *    FILLED order goes on answering yes, because the bidder's balance is not
 *    what consuming it changed. Rendering a filled offer as acceptable is a
 *    button that lies to the occupant.
 *
 * `board(slot)` gives the list and the contract's own per-entry liveness
 * verdict in ONE call, which is why it is preferred over `offers` plus N
 * `isLive` reads — and why the verdict is never recomputed here from
 * `cancelled` and `expiry`. A filled offer sets no flag on itself (the bidder
 * simply becomes the occupant), so a local `!cancelled && !expired` test calls
 * it live long after it was consumed.
 */

export interface BookOffer {
  /** Index into the slot's board — the id `cancel` and `orderOf` take. */
  id: number;
  bidder: Address;
  price: bigint;
  deposit: bigint;
  expiry: bigint;
  cancelled: boolean;
  /** The bidder's nonce on the SLOT. Burned when their order executes. */
  nonce: bigint;
  /** Their EIP-712 signature over these exact terms. */
  signature: Hex;
}

type RawOffer = {
  bidder: Address;
  price: bigint;
  deposit: bigint;
  expiry: bigint;
  cancelled: boolean;
  nonce: bigint;
  signature: Hex;
};

/** The book for the current chain, if one is deployed there. */
export function useOfferBook(): Address | undefined {
  const { chainId } = useChain();
  return offerBookAddress[chainId];
}

export function useOrders(slot: Address | undefined) {
  const { chainId } = useChain();
  const publicClient = usePublicClient({ chainId });
  const book = useOfferBook();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["slots", "offer-book", chainId, slot],
    enabled: !!book && !!slot && !!publicClient,
    refetchInterval: 8_000,
    queryFn: async () => {
      const [board, count, best] = await Promise.all([
        publicClient!.readContract({
          address: book!,
          abi: offerBookAbi,
          functionName: "board",
          args: [slot!],
        }) as Promise<readonly [readonly RawOffer[], readonly boolean[]]>,
        // The badge's number, straight from the contract. See rule 1.
        publicClient!.readContract({
          address: book!,
          abi: offerBookAbi,
          functionName: "liveCount",
          args: [slot!],
        }) as Promise<bigint>,
        publicClient!.readContract({
          address: book!,
          abi: offerBookAbi,
          functionName: "best",
          args: [slot!],
        }) as Promise<readonly [boolean, bigint, RawOffer]>,
      ]);

      const [list, live] = board;
      const offers: BookOffer[] = list
        .map((o, id) => ({ ...o, id }))
        // The contract's verdict, not ours. See rule 2.
        .filter((o) => live[o.id] === true)
        .sort((a, b) => (b.price > a.price ? 1 : b.price < a.price ? -1 : 0));

      return {
        offers,
        count: Number(count),
        bestFound: best[0],
        bestId: Number(best[1]),
        bestOffer: best[2],
      };
    },
  });

  /** Re-read the book. Every write below lands here. */
  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["slots", "offer-book"] });
  }, [queryClient]);

  /**
   * The bidder's own signed order for the best offer, ready for `Slot.sell`.
   *
   * Read at accept time rather than assembled from the board row: `bestOrder`
   * returns the `(SellOrder, signature)` pair the slot will verify, so the
   * occupant forwards exactly what the bidder signed and this app never has to
   * reconstruct a struct whose field order it could get wrong.
   */
  const readBestOrder = useCallback(async (): Promise<{
    order: SellOrder;
    signature: Hex;
  } | null> => {
    if (!book || !slot || !publicClient) return null;
    const [found, , order, signature] = (await publicClient.readContract({
      address: book,
      abi: offerBookAbi,
      functionName: "bestOrder",
      args: [slot],
    })) as readonly [boolean, bigint, SellOrder, Hex];
    return found ? { order, signature } : null;
  }, [book, slot, publicClient]);

  /** One board row's signed order, for accepting something other than the best. */
  const readOrderAt = useCallback(
    async (
      id: number,
    ): Promise<{ order: SellOrder; signature: Hex } | null> => {
      if (!book || !slot || !publicClient) return null;
      const [order, signature] = (await publicClient.readContract({
        address: book,
        abi: offerBookAbi,
        functionName: "orderOf",
        args: [slot, BigInt(id)],
      })) as readonly [SellOrder, Hex];
      return { order, signature };
    },
    [book, slot, publicClient],
  );

  return {
    /** Undefined means this chain has no book — not that the book is empty. */
    book,
    offers: query.data?.offers ?? [],
    /** `liveCount`, for the tab badge. */
    count: query.data?.count ?? 0,
    bestFound: query.data?.bestFound ?? false,
    bestId: query.data?.bestId ?? -1,
    bestOffer: query.data?.bestOffer,
    isLoading: query.isLoading,
    refresh,
    readBestOrder,
    readOrderAt,
  };
}
