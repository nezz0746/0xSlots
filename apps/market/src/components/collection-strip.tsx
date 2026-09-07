"use client";

import { Plate } from "@/components/plate";
import { useTokenArt } from "@/hooks/use-market";
import type { IndexedCollection } from "@/lib/indexer";

/**
 * Four works from a collection, at the size of a thumbnail.
 *
 * The listing drew generated plates for every collection, which was right when
 * nothing could have art and wrong the moment something did — a creator who
 * had just uploaded their work still saw the placeholder on the page everyone
 * arrives at.
 *
 * Only the first four, and only the minted ones. A collection of a hundred
 * does not get a hundred requests from a listing; a collection of two shows
 * two works and two places.
 */
export function CollectionStrip({
  collection,
}: {
  collection: IndexedCollection;
}) {
  const minted = collection.totalMinted;
  // Four tiles, or the whole run when it is shorter. A collection of one drew
  // three empty places beside its only work, which reads as a collection of
  // four that nobody has minted rather than one that is complete.
  const shown = Math.min(4, Number(collection.maxSupply) || 4);

  return (
    <div className="flex gap-1">
      {Array.from({ length: shown }, (_, i) => i + 1).map((tokenId) => (
        <div key={tokenId} className="size-9 overflow-hidden">
          {tokenId <= minted ? (
            <Tile collection={collection} tokenId={tokenId} />
          ) : (
            // A place nobody has taken. Faint rather than absent, so the strip
            // keeps its shape and a half-minted collection reads as one.
            <div className="size-full border border-dashed border-line" />
          )}
        </div>
      ))}
    </div>
  );
}

function Tile({
  collection,
  tokenId,
}: {
  collection: IndexedCollection;
  tokenId: number;
}) {
  const { data: art } = useTokenArt(collection.baseURI, String(tokenId));

  // The plate is the fallback, not the placeholder: it stands in while the
  // metadata is in flight and stays for a collection that never set a base.
  return art?.image ? (
    // biome-ignore lint/performance/noImgElement: an arbitrary IPFS host is
    // not a domain `next/image` can be configured for ahead of time.
    <img
      src={art.image}
      alt=""
      loading="lazy"
      className="size-full bg-lift object-contain"
    />
  ) : (
    <Plate seed={`${collection.id}0${tokenId}`} />
  );
}
