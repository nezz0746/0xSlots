"use client";

import { offerBookAbi, offerBookAddress } from "@0xslots/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownRight, Gavel, Loader2 } from "lucide-react";
import { type Address, formatUnits } from "viem";
import { useAccount, usePublicClient } from "wagmi";

import { CopyAddress } from "@/components/copy-address";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useChain } from "@/context/chain";
import { useSlotAction } from "@/hooks/use-slot-action";
import type { SlotOnChain } from "@/hooks/use-slot-onchain";
import { cn } from "@/lib/utils";

const ZERO = "0x0000000000000000000000000000000000000000";

type Offer = {
  bidder: Address;
  price: bigint;
  deposit: bigint;
  expiry: bigint;
  cancelled: boolean;
};

/**
 * The standing-offer board for one slot.
 *
 * Two audiences in one panel, because they are two halves of one action: a
 * would-be buyer posts what they would pay, and the occupant sees what they
 * could exit at. Splitting them into separate screens would hide the only
 * number that matters to each — what the other side is willing to do.
 */
export function OfferBookPanel({
  slot,
  isOccupant,
  onDone,
}: {
  slot: SlotOnChain;
  isOccupant: boolean;
  onDone?: () => void;
}) {
  const { chainId } = useChain();
  const { address } = useAccount();
  const client = usePublicClient({ chainId });
  // Same hook the Buy button uses: toasts on confirm, a shared busy flag, and
  // the post-transaction refresh that invalidates this very board.
  const { cancelOffer, retireOffer, sell, busy: isPending } = useSlotAction();
  const queryClient = useQueryClient();

  const book = offerBookAddress[chainId as keyof typeof offerBookAddress] as
    | Address
    | undefined;

  const decimals = slot.currencyDecimals ?? 6;
  const symbol = slot.currencySymbol ?? "USDC";
  const slotAddr = slot.id as Address;
  const isNative = slot.currency.toLowerCase() === ZERO;

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["offer-book", chainId, slotAddr],
    enabled: !!book && !!client,
    refetchInterval: 8000,
    queryFn: async () => {
      if (!book || !client) throw new Error("no book");
      // `board` rather than `offers`: it returns the contract's OWN liveness
      // verdict per entry. Deciding that here instead cost us a real bug — a
      // filled offer sets no flag on itself (the bidder just becomes the
      // occupant), so `!cancelled && !expired` called it live long after it
      // had been consumed.
      const [board, best] = await Promise.all([
        client.readContract({
          address: book,
          abi: offerBookAbi,
          functionName: "board",
          args: [slotAddr],
        }) as Promise<readonly [readonly Offer[], readonly boolean[]]>,
        client.readContract({
          address: book,
          abi: offerBookAbi,
          functionName: "best",
          args: [slotAddr],
        }) as Promise<readonly [boolean, bigint, Offer]>,
      ]);
      return {
        offers: board[0],
        liveFlags: board[1],
        found: best[0],
        bestId: Number(best[1]),
        best: best[2],
      };
    },
  });

  const fmt = (v: bigint) =>
    Number(formatUnits(v, decimals)).toLocaleString(undefined, {
      maximumFractionDigits: 2,
    });

  // Cancel and sell also write directly rather than through `useSlotAction`,
  // so they need the same explicit invalidation — `refetch` alone only moves
  // this component's own copy, and the buy panel above reads the same key.
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["offer-book"] });
    await refetch();
    onDone?.();
  };

  const handleCancel = async (id: number) => {
    const hash = await cancelOffer(slotAddr, BigInt(id));
    if (hash) await refresh();
  };

  // ── the exit: sell into the best standing offer ───────────────────────
  const sellIntoBest = async () => {
    if (!data?.found) return;
    const filledId = data.bestId;
    const { bidder, price, deposit } = data.best;

    const hash = await sell(slotAddr, bidder, price, deposit);
    if (!hash) return; // `exec` already reported why

    /**
     * Retire the offer we just consumed.
     *
     * `Slot.sell` cannot do this itself: the book is periphery and the core
     * holds no reference to it. Left un-retired the entry is only HIDDEN — it
     * reappears the moment its author is bought out, offering the next
     * occupant a price from before the fill.
     *
     * Deliberately not awaited into the result: the sale is already final, and
     * a failed cleanup must not be reported as a failed sale. Anyone can
     * retire it later, since the condition is public.
     */
    await retireOffer(slotAddr, BigInt(filledId));
    await refresh();
  };

  // No offer book on this chain → render nothing at all, not a placeholder.
  //
  // `offerBookAddress` is deployed only to anvil for now, so on base and
  // base-sepolia `book` is undefined. Returning null here (rather than a "not
  // available" panel) is what keeps the whole sell/offer feature invisible in
  // production while it ships to main: the moment an address is added for a
  // real chain, the panel lights up there with no further change. The buy
  // panel's offer path is gated the same way, on the same `book` value.
  if (!book) return null;

  if (isNative) {
    return (
      <Panel>
        <p className="text-xs text-muted-foreground">
          This slot is priced in native ETH. Selling pulls the buyer&apos;s
          funds on an allowance, and native ETH has none — so offers only work
          on ERC-20 slots.
        </p>
      </Panel>
    );
  }

  const live = (data?.offers ?? [])
    .map((o, i) => ({ ...o, id: i }))
    .filter((o) => data?.liveFlags?.[o.id] === true)
    .sort((a, b) => (b.price > a.price ? 1 : b.price < a.price ? -1 : 0));

  return (
    <Panel>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Gavel className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Standing offers</h3>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {live.length} live
        </span>
      </div>

      {/* ── the occupant's exit ── */}
      {isOccupant && (
        <div
          className={cn(
            "mt-3 rounded-lg border p-3",
            data?.found
              ? "border-emerald-600/40 bg-emerald-500/5"
              : "border-dashed",
          )}
        >
          {data?.found ? (
            <>
              <p className="text-xs text-muted-foreground">
                You can exit now at the best standing offer, rather than
                releasing for nothing.
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-lg font-bold tabular-nums leading-none">
                    {fmt(data.best.price)} {symbol}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    from <CopyAddress address={data.best.bidder} ens />
                  </p>
                </div>
                <Button size="sm" disabled={isPending} onClick={sellIntoBest}>
                  {isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <ArrowDownRight className="size-3.5" />
                  )}
                  Sell at {fmt(data.best.price)}
                </Button>
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Nobody has an offer on this slot. With one, you could exit at that
              price instead of releasing and receiving nothing.
            </p>
          )}
        </div>
      )}

      {/* ── the board ── */}
      <div className="mt-3 space-y-1">
        {isLoading && (
          <p className="text-xs text-muted-foreground">Reading the book…</p>
        )}
        {!isLoading && live.length === 0 && (
          <p className="text-xs text-muted-foreground">No offers yet.</p>
        )}
        {live.map((o) => {
          const mine = address?.toLowerCase() === o.bidder.toLowerCase();
          const isBest = data?.found === true && o.id === data.bestId;
          return (
            <div
              key={o.id}
              className="flex items-center justify-between gap-2 border-b py-1.5 last:border-b-0"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="text-sm font-medium tabular-nums">
                  {fmt(o.price)} {symbol}
                </span>
                <span className="truncate text-[10px] text-muted-foreground">
                  +{fmt(o.deposit)} escrow
                </span>
                {mine && (
                  <Badge variant="outline" className="text-[10px]">
                    yours
                  </Badge>
                )}
                {isBest && (
                  <Badge className="bg-emerald-600 text-[10px] hover:bg-emerald-600">
                    best
                  </Badge>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <CopyAddress address={o.bidder} ens />
                {mine && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleCancel(o.id)}
                    className="text-[10px] text-muted-foreground hover:text-destructive"
                  >
                    cancel
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* No form here. The valuation field in the buy panel above IS the
          offer form — typing a number under the asking price turns it into
          one. A second input would be a second place to say the same thing,
          and the two would drift. */}
    </Panel>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border p-3">{children}</div>;
}
