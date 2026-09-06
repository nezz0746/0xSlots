"use client";

import type { Address } from "viem";
import { useAccount } from "wagmi";

import { Plate } from "@/components/plate";
import { useCurrency } from "@/hooks/use-currency";
import { useTokenArt, useTokenSlot } from "@/hooks/use-market";
import { amount, truncate } from "@/lib/format";
import type { IndexedToken } from "@/lib/indexer";

/**
 * How many unminted places to draw before summarising the rest.
 *
 * The run is the point — a collection of eight and a collection of ten
 * thousand are different propositions, and a grid that stopped at whatever
 * happened to be minted showed neither. But ten thousand tiles is ten thousand
 * SVGs, so past this the remainder is stated as a figure instead.
 */
const MAX_PLACES = 120;

/**
 * The hang, for the whole run rather than the part of it that exists.
 *
 * A catalogue caption under each work — number, holder, price — because the
 * price here is not a badge on a picture. It is a standing offer anyone can
 * take, and it is read down the column against every other one.
 *
 * Unminted places are drawn too. The grid used to end at the last mint, so a
 * collection of a hundred with three minted looked like a collection of three,
 * and the scarcity a minter is buying into was invisible. Token ids are
 * sequential and nothing is ever burned, so everything above `totalMinted` is
 * a place nobody has taken yet — and clicking one is how you take it.
 */
export function TokenGrid({
  tokens,
  chainId,
  currency,
  baseURI,
  maxSupply,
  selected,
  onSelect,
}: {
  tokens: IndexedToken[];
  chainId: number;
  currency: Address;
  baseURI: string | null;
  /** The whole run, minted or not. */
  maxSupply: number;
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const minted = tokens.length;
  const empty = Math.max(0, maxSupply - minted);
  const drawn = Math.min(empty, Math.max(0, MAX_PLACES - minted));
  const summarised = empty - drawn;

  return (
    <>
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
        {Array.from({ length: drawn }, (_, i) => minted + i + 1).map((id) => (
          <Place
            key={`empty-${id}`}
            tokenId={id}
            onMint={() => onSelect(null)}
          />
        ))}
      </ul>

      {summarised > 0 && (
        <p className="mt-8 border-t border-line pt-4 text-[12px] text-dim">
          {summarised.toLocaleString()} more places, unminted.
        </p>
      )}
    </>
  );
}

/**
 * A place in the run that nobody has taken.
 *
 * Not a skeleton and not a disabled tile: it is the one thing on this page a
 * visitor can still be first to. Pressing it clears the selection, which is
 * what puts the mint panel back — so the empty tiles are the mint button,
 * rather than sitting inertly beside one.
 */
function Place({ tokenId, onMint }: { tokenId: number; onMint: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onMint}
        className="group block w-full text-left"
      >
        <div className="aspect-square border border-dashed border-line transition-colors group-hover:border-ink" />
        <div className="mt-3 flex items-baseline justify-between gap-2">
          <span className="text-[12px] tabular text-dim">No. {tokenId}</span>
          <span className="text-[11px] text-dim transition-colors group-hover:text-ink">
            unminted
          </span>
        </div>
      </button>
    </li>
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
