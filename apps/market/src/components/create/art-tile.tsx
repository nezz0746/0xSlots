"use client";

import type { DragEvent } from "react";

import { CURSOR } from "@/lib/cursors";

/**
 * One work in the run, before it is one.
 *
 * The number is the token id it will mint as, and it sits ON the tile rather
 * than beside it: the order IS the numbering, so dragging has to visibly
 * change a number or the gesture looks like it did nothing at all.
 */
export function ArtTile({
  url,
  index,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  url: string;
  index: number;
  onRemove: () => void;
  onDragStart: () => void;
  onDragOver: (e: DragEvent) => void;
  onDrop: () => void;
}) {
  return (
    <li
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{
        cursor: CURSOR.grab,
        // Staggered, so a batch of twenty lands as a run being built rather
        // than as twenty things appearing at once. Capped, because the
        // twenty-first arriving half a second late reads as a stall.
        animationDelay: `${Math.min(index, 20) * 28}ms`,
      }}
      className="group relative aspect-square animate-rise overflow-hidden bg-lift"
    >
      {/* biome-ignore lint/performance/noImgElement: a local object URL, which
          is not a host `next/image` can be configured for. */}
      <img src={url} alt="" className="size-full object-cover" />

      <span className="absolute bottom-0 left-0 bg-ink px-1.5 py-1 text-[10px] font-semibold tabular text-paper">
        {String(index + 1).padStart(2, "0")}
      </span>

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove work ${index + 1}`}
        className="absolute right-1 top-1 grid size-6 place-items-center bg-ink/80 text-[13px] leading-none text-paper opacity-0 transition-opacity hover:bg-ebbing focus-visible:opacity-100 group-hover:opacity-100"
      >
        ×
      </button>
    </li>
  );
}
