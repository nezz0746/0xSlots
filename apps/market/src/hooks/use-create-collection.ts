"use client";

import { NATIVE_CURRENCY_ADDRESS } from "@0xslots/sdk";
import { type Dispatch, useMemo, useReducer } from "react";

export const STEPS = [
  "The art",
  "Name it",
  "Terms & payout",
  "Review",
] as const;

export type Step = 0 | 1 | 2 | 3;

export type FieldKey =
  | "name"
  | "symbol"
  | "taxPct"
  | "currency"
  | "customCurrency"
  | "recipient"
  | "manager";

export type CreateState = {
  step: Step;
  /** Which way the last move went, so a step slides in from the side it came from. */
  direction: 1 | -1;
  files: File[];
  name: string;
  symbol: string;
  taxPct: string;
  window: bigint;
  currency: string;
  customCurrency: string;
  recipient: string;
  manager: string;
};

export type CreateAction =
  | { type: "next" }
  | { type: "back" }
  | { type: "goto"; step: Step }
  | { type: "files"; files: File[] }
  | { type: "reorder"; from: number; to: number }
  | { type: "remove"; index: number }
  | { type: "field"; key: FieldKey; value: string }
  | { type: "window"; seconds: bigint };

const INITIAL: CreateState = {
  step: 0,
  direction: 1,
  files: [],
  name: "",
  symbol: "",
  taxPct: "10",
  window: 604_800n,
  // The chain's own first token, the same one the explorer picks.
  currency: NATIVE_CURRENCY_ADDRESS,
  customCurrency: "",
  recipient: "",
  manager: "",
};

function reducer(state: CreateState, action: CreateAction): CreateState {
  switch (action.type) {
    case "next":
      return {
        ...state,
        step: Math.min(3, state.step + 1) as Step,
        direction: 1,
      };
    case "back":
      return {
        ...state,
        step: Math.max(0, state.step - 1) as Step,
        direction: -1,
      };
    case "goto":
      return {
        ...state,
        step: action.step,
        direction: action.step > state.step ? 1 : -1,
      };
    case "files":
      // Appended, not replaced. Picking a second batch is how somebody adds to
      // a run, and replacing silently discarded the first one — which with the
      // supply now derived from the count meant the collection quietly shrank.
      return { ...state, files: [...state.files, ...action.files] };
    case "reorder": {
      const files = [...state.files];
      const [moved] = files.splice(action.from, 1);
      if (moved) files.splice(action.to, 0, moved);
      return { ...state, files };
    }
    case "remove":
      return {
        ...state,
        files: state.files.filter((_, i) => i !== action.index),
      };
    case "field":
      return { ...state, [action.key]: action.value };
    case "window":
      return { ...state, window: action.seconds };
  }
}

/**
 * Everything the create form knows, in one place.
 *
 * The page used to hold ten `useState`s alongside the submit, which is
 * workable at one screen and not at four: every step would have needed the
 * whole set threaded through it, and the page would have owned both the data
 * and the rendering of four different things. The steps are presentational and
 * read from here. Only the final submit talks to a chain.
 */
export function useCreateCollection(): {
  state: CreateState;
  dispatch: Dispatch<CreateAction>;
  canAdvance: boolean;
} {
  const [state, dispatch] = useReducer(reducer, INITIAL);

  const canAdvance = useMemo(() => {
    switch (state.step) {
      // The art IS the supply, so a run of nothing is not a collection. This
      // is the only gate that exists because of that change.
      case 0:
        return state.files.length > 0;
      case 1:
        return state.name.trim().length > 0 && state.symbol.trim().length > 0;
      case 2:
        return Number(state.taxPct) >= 0;
      case 3:
        return true;
    }
  }, [state]);

  return { state, dispatch, canAdvance };
}
