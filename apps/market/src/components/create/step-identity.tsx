"use client";

import { cloneElement, type Dispatch, isValidElement, useId } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  CreateAction,
  CreateState,
} from "@/hooks/use-create-collection";

export function StepIdentity({
  state,
  dispatch,
}: {
  state: CreateState;
  dispatch: Dispatch<CreateAction>;
}) {
  return (
    <div>
      <h2 className="text-[26px] font-extrabold leading-[1.1] tracking-[-0.035em] sm:text-[30px]">
        Give it a name.
      </h2>
      <p className="mt-2.5 max-w-[52ch] text-[14px] leading-relaxed text-dim">
        Both are permanent. The symbol is what wallets and explorers show.
      </p>

      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        <Field label="Name">
          <Input
            value={state.name}
            placeholder="Ferrous"
            onChange={(e) =>
              dispatch({ type: "field", key: "name", value: e.target.value })
            }
          />
        </Field>
        <Field label="Symbol">
          <Input
            value={state.symbol}
            placeholder="FER"
            onChange={(e) =>
              dispatch({
                type: "field",
                key: "symbol",
                value: e.target.value.toUpperCase(),
              })
            }
          />
        </Field>
      </div>
    </div>
  );
}

/**
 * A control and what it decides.
 *
 * The hint sits under the field rather than beside the label: these are
 * consequences, not names, and half of them ("fixes it for ever") are the
 * reason somebody stops and reads before typing.
 *
 * Lives here rather than in a file of its own because two steps use it and a
 * fourth file for twenty lines is churn. If a third step ever needs it, that
 * is the moment to move it.
 */
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactElement<{ id?: string }>;
}) {
  // The label is a sibling rather than a wrapper — a Select trigger inside a
  // <label> swallows its own click — so the id is minted here and handed down.
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {isValidElement(children) ? cloneElement(children, { id }) : children}
      {hint && (
        <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
