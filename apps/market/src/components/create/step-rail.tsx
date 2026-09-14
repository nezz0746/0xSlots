"use client";

import { type Step, STEPS } from "@/hooks/use-create-collection";

/**
 * Where you are, what is behind you, and what is left.
 *
 * Only the completed steps are pressable. Jumping ahead past a gate is how you
 * reach Review with no art in the run — and since the art is the supply, that
 * is not a form with a blank field in it, it is a collection of nothing.
 */
export function StepRail({
  current,
  onGoto,
}: {
  current: Step;
  onGoto: (step: Step) => void;
}) {
  return (
    <ol className="flex border-b border-line bg-brand-wash">
      {STEPS.map((label, i) => {
        const done = i < current;
        const now = i === current;
        return (
          <li key={label} className="relative flex-1">
            <button
              type="button"
              disabled={!done}
              onClick={() => onGoto(i as Step)}
              className={`w-full px-2.5 py-3 text-left transition-colors sm:px-4 ${
                now ? "bg-paper" : ""
              } ${done ? "cursor-pointer hover:bg-paper" : "cursor-default"}`}
            >
              <span
                className={`block text-[10px] font-bold tracking-[0.14em] ${
                  done || now ? "text-brand-ink" : "text-dim/60"
                }`}
              >
                {String(i + 1).padStart(2, "0")}
                {done ? " ✓" : ""}
              </span>
              <span
                className={`mt-1.5 block truncate text-[12px] font-semibold tracking-[-0.01em] sm:text-[13px] ${
                  done || now ? "text-ink" : "text-dim"
                }`}
              >
                {label}
              </span>
            </button>
            {now && (
              <span className="absolute inset-x-0 -bottom-px h-[3px] bg-brand" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
