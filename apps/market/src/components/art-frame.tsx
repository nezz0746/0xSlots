"use client";

/**
 * A square in the hang, in one of four states.
 *
 * There used to be a fifth thing here, and it was the problem: a generated
 * plate, drawn from the slot address whenever art was missing. It was right
 * when nothing could have art and wrong the moment something did — it LOOKED
 * like a real work, so four different facts arrived as one picture. A
 * collection still loading, a collection whose creator never uploaded
 * anything, a place nobody has minted, and a real work were indistinguishable
 * at thumbnail size, which is the size most of them are seen at.
 *
 * They are four facts and they now look like four things:
 *
 *   art      the work itself, and only ever the work itself
 *   loading  obviously temporary — it pulses, and it is never mistaken for art
 *   place    obviously empty and obviously clickable; this is the one thing a
 *            visitor can still be first to, so it answers the hover
 *   bare     minted, but this collection points at no art at all. Rare, and
 *            only reachable by collections opened before art was required —
 *            solid rather than dashed, so it never reads as available
 */
export function ArtFrame({
  src,
  alt,
  state,
  tokenId,
}: {
  src?: string;
  alt?: string;
  state: "art" | "loading" | "place" | "bare";
  tokenId?: number;
}) {
  if (state === "art" && src)
    // biome-ignore lint/performance/noImgElement: an arbitrary IPFS host is
    // not a domain `next/image` can be configured for ahead of time.
    return (
      <img
        src={src}
        alt={alt ?? ""}
        loading="lazy"
        className="size-full animate-rise bg-lift object-contain"
      />
    );

  if (state === "loading")
    return <div className="size-full animate-pulse bg-lift" aria-hidden />;

  if (state === "bare")
    return (
      <div className="grid size-full place-items-center border border-line bg-lift">
        {tokenId !== undefined && (
          <span className="tabular text-[11px] text-dim">{tokenId}</span>
        )}
      </div>
    );

  return (
    <div className="grid size-full place-items-center border border-dashed border-line transition-colors group-hover:border-brand">
      {tokenId !== undefined && (
        <span className="tabular text-[11px] text-dim transition-colors group-hover:text-brand-ink">
          {tokenId}
        </span>
      )}
    </div>
  );
}
