"use client";

import { NATIVE_CURRENCY_ADDRESS } from "@0xslots/sdk";
import type { Dispatch } from "react";
import { useAccount } from "wagmi";

import { Field } from "@/components/create/step-identity";
import { CurrencyChoice } from "@/components/currency-choice";
import { TermsPreview } from "@/components/terms-preview";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  CreateAction,
  CreateState,
} from "@/hooks/use-create-collection";

/** Windows a collection realistically wants, rather than a seconds field. */
const WINDOWS = [
  { label: "1 day", seconds: 86_400n },
  { label: "7 days", seconds: 604_800n },
  { label: "30 days", seconds: 2_592_000n },
] as const;

/**
 * The terms and the two addresses, on one step.
 *
 * They were separate sections and are now one, because they answer the same
 * question — what does holding a work here cost, and who does that money reach
 * — and splitting them put the rate on one screen and its destination on
 * another.
 */
export function StepTerms({
  state,
  dispatch,
  chainId,
}: {
  state: CreateState;
  dispatch: Dispatch<CreateAction>;
  chainId: number;
}) {
  const { address } = useAccount();
  const taxBps = BigInt(Math.round(Number(state.taxPct || "0") * 100));
  const chosen =
    state.currency === "custom" ? state.customCurrency : state.currency;

  return (
    <div>
      <h2 className="text-[26px] font-extrabold leading-[1.1] tracking-[-0.035em] sm:text-[30px]">
        Set the terms once.
      </h2>
      <p className="mt-2.5 max-w-[52ch] text-[14px] leading-relaxed text-dim">
        Everyone who mints chooses only what their work is worth to them — and
        holds it at that price until someone pays it.
      </p>

      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        <Field label="Rent" hint="% of the holder's valuation, per 30 days">
          <Input
            value={state.taxPct}
            inputMode="decimal"
            className="tabular"
            onChange={(e) =>
              dispatch({ type: "field", key: "taxPct", value: e.target.value })
            }
          />
        </Field>
        <Field label="Funded window" hint="what a mint's escrow buys">
          <Select
            value={String(state.window)}
            onValueChange={(v) =>
              dispatch({ type: "window", seconds: BigInt(v) })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WINDOWS.map((w) => (
                <SelectItem key={w.label} value={String(w.seconds)}>
                  {w.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="mt-5">
        <CurrencyChoice
          chainId={chainId}
          value={state.currency}
          onChange={(v) =>
            dispatch({ type: "field", key: "currency", value: v })
          }
          custom={state.customCurrency}
          onCustom={(v) =>
            dispatch({ type: "field", key: "customCurrency", value: v })
          }
        />
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        <Field label="Rent goes to" hint="for ever">
          <Input
            value={state.recipient}
            placeholder={address ?? "0x…"}
            onChange={(e) =>
              dispatch({
                type: "field",
                key: "recipient",
                value: e.target.value,
              })
            }
          />
        </Field>
        <Field
          label="Manager"
          hint="may change the rent. Blank fixes it for ever"
        >
          <Input
            value={state.manager}
            placeholder="blank"
            onChange={(e) =>
              dispatch({ type: "field", key: "manager", value: e.target.value })
            }
          />
        </Field>
      </div>

      {/* The two that cannot be undone. Said once, beside the fields that set
          them, rather than as a hint under each where a reader meets them one
          at a time and never together. */}
      <p className="mt-5 border-l-4 border-ebbing bg-ebbing/5 px-4 py-3 text-[12.5px] leading-snug text-dim">
        The recipient and the manager are fixed on every slot this collection
        ever mints, and nothing changes either afterwards. Use addresses you
        will still control in a year.
      </p>

      <div className="mt-7">
        <TermsPreview
          taxBps={taxBps}
          minDepositSeconds={state.window}
          symbol={chosen === NATIVE_CURRENCY_ADDRESS ? "ETH" : ""}
        />
      </div>
    </div>
  );
}
