"use client";

import { type Dispatch, useRef, useState } from "react";

import { ArtTile } from "@/components/create/art-tile";
import type {
  CreateAction,
  CreateState,
} from "@/hooks/use-create-collection";
import { useObjectUrls } from "@/hooks/use-object-urls";

/**
 * The art, and therefore the size of the collection.
 *
 * There is no supply field. However many works are here is how many places
 * exist — which removes a whole error class the old form could produce (more
 * files than places, the extras uploaded and unmintable, caught only by a
 * warning nobody had to obey) and makes the number something you watch happen
 * rather than something you typed.
 *
 * The cost of that is worth saying out loud in the UI, and it is: the run
 * cannot grow later. So the sentence under the count says so.
 */
export function StepArt({
  state,
  dispatch,
}: {
  state: CreateState;
  dispatch: Dispatch<CreateAction>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const urls = useObjectUrls(state.files);
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState(false);

  return (
    <div>
      <h2 className="text-[26px] font-extrabold leading-[1.1] tracking-[-0.035em] sm:text-[30px]">
        Drop the work in.
      </h2>
      <p className="mt-2.5 max-w-[52ch] text-[14px] leading-relaxed text-dim">
        However many pieces you add is how big the collection is. Twelve works,
        twelve places.
      </p>

      <input
        ref={input}
        type="file"
        multiple
        accept="image/*,video/*"
        hidden
        onChange={(e) => {
          dispatch({ type: "files", files: Array.from(e.target.files ?? []) });
          // Cleared so picking the same files twice still fires a change.
          e.target.value = "";
        }}
      />

      <ul className="mt-7 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        {urls.map((url, i) => (
          <ArtTile
            key={url}
            url={url}
            index={i}
            onRemove={() => dispatch({ type: "remove", index: i })}
            onDragStart={() => setDragging(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragging !== null && dragging !== i)
                dispatch({ type: "reorder", from: dragging, to: i });
              setDragging(null);
            }}
          />
        ))}

        <li>
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              dispatch({
                type: "files",
                files: Array.from(e.dataTransfer.files),
              });
            }}
            aria-label="Add works"
            className={`grid aspect-square w-full place-items-center border-2 border-dashed text-[26px] font-bold transition-colors ${
              over
                ? "border-brand bg-brand-wash text-brand-ink"
                : "border-line text-dim hover:border-brand hover:text-brand-ink"
            }`}
          >
            +
          </button>
        </li>
      </ul>

      <Count n={state.files.length} />
    </div>
  );
}

/**
 * The supply, as a consequence.
 *
 * Keyed on the number so React remounts it and the rise replays on every
 * change: the point is that the figure MOVED when files landed, and a number
 * that silently updates communicates none of that.
 */
function Count({ n }: { n: number }) {
  return (
    <div className="mt-5 flex items-center gap-4 border-l-4 border-brand bg-brand-wash px-4 py-3">
      <span
        key={n}
        className="animate-rise text-[30px] font-extrabold leading-none tracking-[-0.04em] text-brand-ink tabular"
      >
        {n}
      </span>
      <p className="text-[13px] leading-snug">
        <b>
          {n === 1 ? "place in this collection." : "places in this collection."}
        </b>
        <br />
        <span className="text-dim">
          {n === 0
            ? "Add at least one work to continue."
            : "Drag a tile to reorder — the first becomes No. 1. The run is fixed once it opens."}
        </span>
      </p>
    </div>
  );
}
