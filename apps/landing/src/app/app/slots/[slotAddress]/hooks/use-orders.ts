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
 * own module callbacks — so a sale is `selfAssess` then `buy`, and the BOOK
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
 * `boardPage(slot, start, count)` gives the list and the contract's own
 * per-entry liveness verdict together, which is why it is preferred over
 * `offers` plus N `isLive` reads — and why the verdict is never recomputed here
 * from `cancelled` and `expiry` — the book also tracks `filled`, and its own
 * verdict is the only one guaranteed to account for every reason a bid is
 * dead. Paged rather than one `board(slot)` call because the board only grows:
 * the live count and the best bid are taken from the same verdicts, so rule 1
 * holds with `offerCount` used only to know where the pages end.
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

/** Board entries read per `boardPage` call. Far under any RPC's gas budget. */
const BOARD_PAGE = 200n;

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
      // Paged. The board only grows, and every entry costs the book four
      // foreign reads to judge, so a few thousand dust bids would put a
      // whole-board read past the RPC's gas budget for good. `best` and the
      // count come from the same pages, by the contract's own verdict per
      // entry — see rule 2 — rather than two more whole-board calls.
      const total = (await publicClient!.readContract({
        address: book!,
        abi: offerBookAbi,
        functionName: "offerCount",
        args: [slot!],
      })) as bigint;

      const pages: Promise<readonly [readonly RawOffer[], readonly boolean[]]>[] = [];
      for (let start = 0n; start < total; start += BOARD_PAGE) {
        pages.push(
          publicClient!.readContract({
            address: book!,
            abi: offerBookAbi,
            functionName: "boardPage",
            args: [slot!, start, BOARD_PAGE],
          }) as Promise<readonly [readonly RawOffer[], readonly boolean[]]>,
        );
      }

      const live: BookOffer[] = [];
      let id = 0;
      for (const [list, isLive] of await Promise.all(pages)) {
        list.forEach((o, i) => {
          if (isLive[i] === true) live.push({ ...o, id: id + i });
        });
        id += list.length;
      }

      // The book's rule: highest price, lowest id among equals.
      let best: BookOffer | undefined;
      for (const o of live) if (!best || o.price > best.price) best = o;

      const offers = [...live].sort((a, b) =>
        b.price > a.price ? 1 : b.price < a.price ? -1 : 0,
      );

      return {
        offers,
        count: live.length,
        bestFound: best !== undefined,
        bestId: best?.id ?? -1,
        bestOffer: best,
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
