"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

const COLS = 30;
const ROWS = 15;
const STEP = 30;
const SIZE = 20;
const FLIP_MS = 2200;

/** Deterministic seed so the field looks composed, not noisy. */
function initialOccupancy() {
  const cells: boolean[] = [];
  for (let i = 0; i < COLS * ROWS; i++) {
    cells.push((i * 7 + Math.floor(i / COLS) * 3) % 11 === 0);
  }
  return cells;
}

/**
 * The ambient parcel field behind the hero.
 *
 * Cells turn over on a slow timer — one buys in, one falls vacant.
 * The register never settles, which is the entire argument of the
 * protocol, so the background makes it before the copy does.
 */
export function ParcelField({ className }: { className?: string }) {
  const [occupied, setOccupied] = useState(initialOccupancy);
  const [flashing, setFlashing] = useState<number | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) return;

    const tick = () => {
      const index = Math.floor(Math.random() * COLS * ROWS);
      setOccupied((prev) => prev.map((v, i) => (i === index ? !v : v)));
      setFlashing(index);
      window.setTimeout(() => setFlashing(null), 700);
    };

    timer.current = window.setInterval(tick, FLIP_MS);
    return () => window.clearInterval(timer.current);
  }, []);

  const cells = useMemo(
    () =>
      occupied.map((isOccupied, i) => ({
        i,
        isOccupied,
        x: (i % COLS) * STEP,
        y: Math.floor(i / COLS) * STEP,
      })),
    [occupied],
  );

  return (
    <svg
      className={cn("pointer-events-none select-none", className)}
      viewBox={`0 0 ${COLS * STEP} ${ROWS * STEP}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      /* The register thins out where the argument is being made in
         words, and thickens under the slot it is describing. */
      style={{
        maskImage:
          "linear-gradient(105deg, transparent 6%, rgba(0,0,0,0.28) 40%, #000 78%)",
        WebkitMaskImage:
          "linear-gradient(105deg, transparent 6%, rgba(0,0,0,0.28) 40%, #000 78%)",
      }}
    >
      <title>Parcel register</title>
      {cells.map(({ i, isOccupied, x, y }) => (
        <rect
          key={i}
          x={x + (STEP - SIZE) / 2}
          y={y + (STEP - SIZE) / 2}
          width={SIZE}
          height={SIZE}
          transform={`rotate(45 ${x + STEP / 2} ${y + STEP / 2})`}
          className={cn(
            "transition-all duration-700",
            flashing === i
              ? "fill-destructive/15 stroke-destructive/45"
              : cn(
                  isOccupied ? "fill-foreground/[0.055]" : "fill-none",
                  "stroke-foreground/[0.07]",
                ),
          )}
          strokeWidth={1}
        />
      ))}
    </svg>
  );
}
