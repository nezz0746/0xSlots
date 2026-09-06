"use client";

import type { Address } from "viem";
import { useAccount } from "wagmi";

import { Plate } from "@/components/plate";
import { useCurrency } from "@/hooks/use-currency";
import { useTokenArt, useTokenSlot } from "@/hooks/use-market";
import { amount, truncate } from "@/lib/format";
import type { IndexedToken } from "@/lib/indexer";

/**
 * The hang.
 *
 * A catalogue caption under each work — number, holder, price — because the
 * price here is not a badge on a picture. It is a standing offer anyone can
 * take, and it is read down the column against every other one.
 */
export function TokenGrid({
  tokens,
  chainId,
  currency,
  baseURI,
  selected,
  onSelect,
}: {
  tokens: IndexedToken[];
  chainId: number;
  currency: Address;
  baseURI: string | null;
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  if (tokens.length === 0)
    return (
      <p className="mt-8 border-y border-line py-6 text-[14px] text-dim">
        Nothing minted yet. The first one sets its own price.
      </p>
    );

  return (
    <ul className="mt-6 grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3">
      {tokens.map((token) => (
        <Work
          key={token.id}
          token={token}
          chainId={chainId}
          currency={currency}
          baseURI={baseURI}
          active={selected === token.tokenId}
          onSelect={onSelect}
        />
      ))}
    </ul>
  );
}

function Work({
  token,
  chainId,
  currency,
  baseURI,
  active,
  onSelect,
}: {
  token: IndexedToken;
  chainId: number;
  currency: Address;
  baseURI: string | null;
  active: boolean;
  onSelect: (id: string | null) => void;
}) {
  const { address } = useAccount();
  // The price is the SLOT's, live. The indexer knows who holds the token; only
  // the slot knows what it currently costs, and that is what is being clicked.
  const { data: slot } = useTokenSlot(chainId, token.slot);
  const { data: art } = useTokenArt(baseURI, token.tokenId);
  const { symbol, decimals } = useCurrency(chainId, currency);

  const mine = address?.toLowerCase() === token.owner.toLowerCase();

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(active ? null : token.tokenId)}
        aria-pressed={active}
        className="group block w-full text-left"
      >
        <div
          className={`aspect-square overflow-hidden transition-transform duration-300 group-hover:-translate-y-1 ${
            active ? "outline outline-2 outline-offset-[3px] outline-ink" : ""
          }`}
        >
          <Plate
            seed={token.slot}
            src={art?.image}
            alt={art?.name ?? `Work ${token.tokenId}`}
          />
        </div>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="tabular text-[12px] text-dim">
            {art?.name ?? `No. ${token.tokenId}`}
          </span>
          {mine && <span className="text-[11px] text-standing">yours</span>}
        </div>
        <div className="mt-1 tabular text-[15px]">
          {slot ? amount(slot.price, decimals, symbol) : "—"}
        </div>
        <div className="mt-0.5 truncate text-[11px] text-dim">
          {slot?.isVacant ? "unheld" : truncate(token.owner)}
        </div>
      </button>
    </li>
  );
}
