"use client";

import { offerBookAbi } from "@0xslots/contracts/slots";
import type { SlotState } from "@0xslots/sdk/slots";
import { ArrowDownRight, Gavel, Info, Loader2 } from "lucide-react";
import type { Address } from "viem";
import { useAccount, useWalletClient } from "wagmi";
import { CopyAddress } from "@/components/copy-address";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useChain } from "@/context/chain";
import type { CurrencyMeta } from "@/hooks/slots/use-slots";
import type { useSlotsAction } from "@/hooks/slots/use-slots-action";
import { cn } from "@/lib/utils";
import { formatBalance } from "@/utils";
import { type BookOffer, useOrders } from "../hooks/use-orders";

type Actions = ReturnType<typeof useSlotsAction>;

/**
 * The standing-offer board for one slot.
 *
 * Two audiences in one tab, because they are two halves of one action: a
 * would-be buyer posts what they would pay, and the occupant sees what they
 * could exit at. Splitting them into separate screens would hide the only
 * number that matters to each — what the other side is willing to do.
 *
 * There is deliberately NO price form here. The valuation field in the buy
 * panel IS the offer form: typing a number under the asking price turns that
 * submit into "Offer", which signs and posts here. A second input would be a
 * second place to say the same thing, and the two would drift.
 */
export function OrdersTab({
  slot,
  state,
  currency,
  actions,
  isOccupant,
}: {
  slot: Address;
  state: SlotState;
  currency: CurrencyMeta;
  actions: Actions;
  isOccupant: boolean;
}) {
  const { address } = useAccount();
  const { chainId } = useChain();
  const { data: walletClient } = useWalletClient({ chainId });
  const {
    book,
    offers,
    count,
    bestFound,
    bestId,
    bestOffer,
    isLoading,
    refresh,
  } = useOrders(slot);

  const fmt = (v: bigint) =>
    `${formatBalance(v, currency.decimals)} ${currency.symbol}`;

  /**
   * Accept an offer.
   *
   * One call. The book reprices the slot to the bid and seats the bidder, both
   * inside this transaction — which is why the occupant must first make the
   * book their operator. That grant is scoped to their tenure and lapses the
   * moment the slot changes hands, so it cannot be inherited.
   *
   * No cleanup follows: the book marks the row filled as it goes, and the board
   * stops listing it on its own.
   */
  const accept = async (id: number) => {
    if (!walletClient || !book) return;
    const hash = await actions.exec("Accept offer", () =>
      walletClient.writeContract({
        address: book,
        abi: offerBookAbi,
        functionName: "acceptOffer",
        args: [slot, BigInt(id)],
        account: walletClient.account,
        chain: walletClient.chain,
      }),
    );
    if (hash) refresh();
  };

  /**
   * Let the book reprice this slot, for as long as this tenure lasts.
   *
   * `selfAssess` is `onlyOccupantOrOperator`, so without this the book cannot
   * perform the sale at all. Deliberately a separate, explicit step: it is a
   * real power — repricing to dust would let anyone take the slot cheaply — and
   * the occupant should grant it knowingly rather than have it folded into a
   * button labelled "accept".
   */
  const authorise = async () => {
    const hash = await actions.setOperator(slot, book as Address, true);
    if (hash) refresh();
  };

  /** Take this entry off the board. Does NOT revoke the signature — see below. */
  const cancelOffer = async (id: number) => {
    if (!walletClient || !book) return;
    const hash = await actions.exec("Cancel offer", () =>
      walletClient.writeContract({
        address: book,
        abi: offerBookAbi,
        functionName: "cancel",
        args: [slot, BigInt(id)],
        account: walletClient.account,
        chain: walletClient.chain,
      }),
    );
    if (hash) refresh();
  };

  // No book on this chain: say so rather than render an empty board, which
  // would read as "nobody has bid" when the truth is "there is nowhere to bid".
  if (!book)
    return (
      <div className="p-4">
        <p className="text-xs leading-snug text-muted-foreground">
          No offer book is deployed on this chain, so there is nowhere to post
          or read bids — and nowhere to accept one from. A sale needs the book:
          it is what reprices the slot and seats the bidder.
        </p>
      </div>
    );

  // ERC-20 only, and the reason is structural rather than a policy choice.
  if (currency.isNative)
    return (
      <div className="space-y-2 p-4">
        <p className="text-xs leading-snug text-muted-foreground">
          This slot is priced in native ETH, so it has no offer book. Filling an
          order pulls the bidder&apos;s funds on an ERC-20 allowance and native
          ETH has none — an offer here could never be executed, so none can be
          posted. Buying directly still works.
        </p>
      </div>
    );

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Gavel className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Standing offers</h3>
        </div>
        <span className="text-[10px] text-muted-foreground">{count} live</span>
      </div>

      {/* ── the occupant's exit ── */}
      {isOccupant && (
        <div
          className={cn(
            "border p-3",
            bestFound
              ? "border-emerald-600/40 bg-emerald-500/5"
              : "border-dashed",
          )}
        >
          {bestFound && bestOffer ? (
            <>
              <p className="text-xs text-muted-foreground">
                You can exit now at the best standing offer, rather than
                releasing for nothing.
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-lg font-bold leading-none tabular-nums">
                    {fmt(bestOffer.price)}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    from <CopyAddress address={bestOffer.bidder} />
                  </p>
                </div>
                <Button
                  size="sm"
                  disabled={actions.busy}
                  onClick={() => accept(bestId)}
                >
                  {actions.busy ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <ArrowDownRight className="size-3.5" />
                  )}
                  Sell at {fmt(bestOffer.price)}
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
      <div className="space-y-1">
        {isLoading && (
          <p className="text-xs text-muted-foreground">Reading the book…</p>
        )}
        {!isLoading && offers.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No live offers.{" "}
            {isOccupant
              ? "Anyone may post one by naming a price under yours."
              : "Name a price under the asking price in the panel beside this one to post one."}
          </p>
        )}
        {offers.map((o) => (
          <OfferRow
            key={o.id}
            offer={o}
            isBest={bestFound && o.id === bestId}
            mine={address?.toLowerCase() === o.bidder.toLowerCase()}
            isOccupant={isOccupant}
            busy={actions.busy}
            fmt={fmt}
            onCancel={() => cancelOffer(o.id)}
            onRevoke={() => cancelOffer(o.id)}
            onAccept={() => accept(o.id)}
          />
        ))}
      </div>

      <div className="flex gap-2 border-t pt-3">
        <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        <p className="text-[11px] leading-snug text-muted-foreground">
          The book holds signatures, never funds, and never executes anything —
          the occupant&apos;s own transaction settles a sale — the book reprices
          and seats inside it, and custodies nothing along the way.
        </p>
      </div>
    </div>
  );
}

function OfferRow({
  offer,
  isBest,
  mine,
  isOccupant,
  busy,
  fmt,
  onCancel,
  onRevoke,
  onAccept,
}: {
  offer: BookOffer;
  isBest: boolean;
  mine: boolean;
  isOccupant: boolean;
  busy: boolean;
  fmt: (v: bigint) => string;
  onCancel: () => void;
  onRevoke: () => void;
  onAccept: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b py-1.5 last:border-b-0">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-sm font-medium tabular-nums">
          {fmt(offer.price)}
        </span>
        <span className="truncate text-[10px] text-muted-foreground">
          +{fmt(offer.deposit)} escrow
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
        <CopyAddress address={offer.bidder} />
        {isOccupant && !isBest && (
          <button
            type="button"
            disabled={busy}
            onClick={onAccept}
            className="text-[10px] text-muted-foreground hover:text-foreground"
            title="Sell into this offer rather than the best one"
          >
            accept
          </button>
        )}
        {mine && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={onCancel}
              className="text-[10px] text-muted-foreground hover:text-destructive"
              title="Remove this offer from the board"
            >
              cancel
            </button>
            {/* Different from cancel, and both are worth having: cancelling
                takes the entry off THIS board, while burning the nonce
                invalidates the signature everywhere it was ever published. A
                signed order is a standing authorisation — removing one copy of
                it revokes nothing. */}
            <button
              type="button"
              disabled={busy}
              onClick={onRevoke}
              className="text-[10px] text-muted-foreground hover:text-destructive"
              title="Invalidate the signature everywhere it was published, not just here"
            >
              revoke
            </button>
          </>
        )}
      </div>
    </div>
  );
}
