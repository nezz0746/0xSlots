"use client";

import { offerBookAbi, offerBookAddress } from "@0xslots/contracts/slots";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { Address } from "viem";
import { usePublicClient } from "wagmi";
import { useChain } from "@/context/chain";

/**
 * The on-chain offer book for one slot.
 *
 * ── Discovery AND settlement, now ────────────────────────────────────────
 *
 * The core used to carry `sell`, and the book only published signed orders for
 * an occupant to submit. `sell` is gone — it was a second seating path with its
 * own hook callbacks — so a sale is `selfAssess` then `buy`, and the BOOK
 * performs both inside the occupant's own transaction.
 *
 * That means the occupant must first make the book their operator
 * (`setOperator(book, true)`), which lapses with their tenure. The book still
 * custodies nothing: it pulls the bidder's payment and spends it in the same
 * call. And it is immutable, precisely because occupants grant it that power.
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
 * `cancelled` and `expiry` — the book also tracks `filled`, and its own verdict
 * is the only one guaranteed to account for every reason a bid is dead.
 */

export interface BookOffer {
  /** Index into the slot's board — the id `cancel` and `acceptOffer` take. */
  id: number;
  bidder: Address;
  price: bigint;
  deposit: bigint;
  expiry: bigint;
  cancelled: boolean;
  /** Set when the bid has been accepted. Distinct from `cancelled`. */
  filled: boolean;
}

type RawOffer = {
  bidder: Address;
  price: bigint;
  deposit: bigint;
  expiry: bigint;
  cancelled: boolean;
  filled: boolean;
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
  };
}
