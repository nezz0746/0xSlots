"use client";

/**
 * What a work looks like before it looks like anything.
 *
 * A collection sets its baseURI when it has art to point at, and until then
 * every token in a marketplace grid is an id and a price above a grey box.
 * This draws a plate instead: two inks overprinted, cut by the bytes of the
 * slot address the token follows. Deterministic, so the same work is the same
 * plate on every device and in every session — an identity, not a placeholder.
 *
 * Four compositions rather than one parameterised layout. Moving a circle
 * around inside a fixed arrangement gives plates that are all the same picture
 * at thumbnail size, which is the size most of them are seen at.
 *
 * When there IS art, this steps aside and shows it.
 */

/* Printing inks rather than a hue wheel. A generated hue lands wherever the
   address does, including on the colours this app reserves for meaning.
   These are also the only warm colour on the page now that the chrome is
   cool near-white, which is the point: the works carry the temperature. */
const INKS = [
  "#2c3e9e", // ultramarine
  "#8c2f39", // oxblood
  "#1f5c4a", // viridian
  "#c9752b", // ochre
  "#2a1b2e", // aubergine
  "#6d5ba3", // periwinkle
  "#0d7488", // teal
  "#a8474f", // madder
];

function bytesOf(seed: string): number[] {
  const hex = seed.replace(/^0x/, "");
  const out: number[] = [];
  for (let i = 0; i + 1 < hex.length; i += 2)
    out.push(Number.parseInt(hex.slice(i, i + 2), 16) || 0);
  return out.length ? out : [0];
}

export function Plate({
  seed,
  src,
  alt = "",
  className,
}: {
  /** The slot address the token follows. */
  seed: string;
  /** The work itself, when the collection has one. */
  src?: string;
  alt?: string;
  className?: string;
}) {
  if (src)
    // Not next/image: these URLs come from a collection's own baseURI, an
    // arbitrary host the optimizer has no allowlist for.
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={alt}
        loading="lazy"
        // Contained, not cropped. A collection's works are not all square,
        // and cover silently trims whatever does not fit — on a portrait piece
        // that is the top and bottom of the image, which is usually the part
        // that made it a composition. The tile keeps its square and the
        // artwork sits inside it.
        className={`block h-full w-full bg-lift object-contain ${className ?? ""}`}
      />
    );

  const b = bytesOf(seed);
  const at = (i: number) => b[i % b.length] ?? 0;
  const unit = (i: number) => at(i) / 255;

  const first = at(0) % INKS.length;
  // Never the same ink twice: the overprint is the whole picture.
  const second = (first + 1 + (at(1) % (INKS.length - 1))) % INKS.length;
  const ink = INKS[first];
  const over = INKS[second];
  const label = alt || "Generated plate";

  return (
    <svg
      viewBox="0 0 100 100"
      className={`block h-full w-full ${className ?? ""}`}
      role="img"
      aria-label={label}
      preserveAspectRatio="xMidYMid slice"
    >
      <title>{label}</title>
      <rect width="100" height="100" fill="#f2f3f5" />
      <g style={{ mixBlendMode: "multiply" }}>
        {composition(at(2) % 4, { at, unit, ink, over })}
      </g>
    </svg>
  );
}

type Cut = {
  at: (i: number) => number;
  unit: (i: number) => number;
  ink: string;
  over: string;
};

function composition(kind: number, { at, unit, ink, over }: Cut) {
  switch (kind) {
    // A band across, and a disc riding it.
    case 0: {
      const y = 20 + unit(3) * 46;
      const h = 10 + unit(4) * 26;
      const tilt = -34 + unit(5) * 68;
      return (
        <>
          <rect
            x="-40"
            y={y}
            width="180"
            height={h}
            fill={ink}
            transform={`rotate(${tilt} 50 50)`}
          />
          <circle
            cx={20 + unit(6) * 60}
            cy={20 + unit(7) * 60}
            r={10 + unit(8) * 18}
            fill={over}
          />
        </>
      );
    }
    // Two columns of unequal weight.
    case 1: {
      const split = 26 + unit(3) * 44;
      const gap = 2 + unit(4) * 6;
      return (
        <>
          <rect x="0" y="0" width={split} height="100" fill={ink} />
          <rect
            x={split + gap}
            y={12 + unit(5) * 30}
            width={100 - split - gap}
            height={100}
            fill={over}
          />
        </>
      );
    }
    // A ring, off centre, over a corner block.
    case 2: {
      const r = 22 + unit(3) * 20;
      return (
        <>
          <rect
            x={at(4) % 2 ? 0 : 50}
            y={at(5) % 2 ? 0 : 50}
            width="50"
            height="50"
            fill={ink}
          />
          <circle
            cx={26 + unit(6) * 48}
            cy={26 + unit(7) * 48}
            r={r}
            fill="none"
            stroke={over}
            strokeWidth={5 + unit(8) * 11}
          />
        </>
      );
    }
    // A stack of rules, thinning.
    default: {
      const count = 3 + (at(3) % 4);
      const step = 100 / (count + 1);
      return (
        <>
          {Array.from({ length: count }, (_, n) => (
            <rect
              key={n}
              x={4 + unit(4 + n) * 26}
              y={step * (n + 1) - 4}
              width={96 - unit(5 + n) * 40}
              height={3 + unit(6 + n) * 9}
              fill={n % 2 ? over : ink}
            />
          ))}
        </>
      );
    }
  }
}
