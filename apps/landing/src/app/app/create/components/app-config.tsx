"use client";

import { AlertCircle, Check, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Address, Hex } from "viem";
import { useQueryClient } from "@tanstack/react-query";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  describeSeconds,
  encodeSettings,
  type AppSettingsSpec,
  type AppField,
  settingsStoreAbi,
  useSettingsRegistered,
  useSettingsCheck,
  ZERO_WORD,
} from "@/hooks/use-app-schema";
import { TIME_MULTIPLIERS, type TimeUnit, timeUnits } from "../sections";

/**
 * The form an app asked for.
 *
 * Nothing here knows what a minimum tenure is. Every control, its units, its
 * bounds and its error text come from the JSON Schema the app published — so a
 * app nobody has written a UI for gets a working form, and an app that changes
 * its limits changes this form without anyone editing it.
 *
 * Two things are separated on purpose. The BOUNDS came from the schema and are
 * advice: they shape the control and catch a wrong value early. The VERDICT
 * comes from `checkSettings` on the chain, and it is the authority — the
 * same function the slot runs at attach. When they disagree the chain wins, and
 * the message says what the chain said. That split matters more now that every
 * value travels as a string: a range on a string is not something a schema
 * validator will enforce for you.
 */
export function HookConfig({
  hookAddress,
  config,
  values,
  onChange,
  onVerdict,
}: {
  hookAddress: string;
  config: AppSettingsSpec;
  /** Raw strings by field name, each in that field's own unit. */
  values: Record<string, string>;
  onChange: (next: Record<string, string>, word: Hex | null) => void;
  /** The chain's answer, for whoever owns the submit button. */
  onVerdict?: (ok: boolean) => void;
}) {
  const filled = config.fields.every((f) => (values[f.name] ?? "").trim());
  const encoded = filled ? encodeSettings(config, values) : null;
  const word = encoded?.word ?? null;

  const queryClient = useQueryClient();
  const check = useSettingsCheck(hookAddress, word);

  /**
   * Whether leaving this empty is allowed — asked, not assumed.
   *
   * The schema says so in `x-optional`, but the app is asked anyway, because
   * the empty word is judged by the same function that judges every other
   * value and its answer is the one the slot will act on. AdLand carries the
   * tenure rule and skips it when the word is zero; the standalone app
   * refuses.
   */
  const zeroCheck = useSettingsCheck(hookAddress, ZERO_WORD, 0);

  /**
   * Whether the app already holds these bytes.
   *
   * Only asked when the word is an id. Registration is permissionless and
   * idempotent, so a configuration somebody already registered — the same
   * three values, from anyone — needs no transaction at all, and the form says
   * so rather than sending one.
   */
  const { registered, refetch } = useSettingsRegistered(
    hookAddress,
    word,
    config.registered,
  );
  const needsRegistering = config.registered && !!word && !registered;

  /**
   * The verdict, reported up.
   *
   * `settled` matters as much as `accepted`: while the debounce or the call is
   * still outstanding the honest answer is "not yet", and reporting `true`
   * there would arm the button for the moment between a keystroke and the
   * chain's reply.
   *
   * An empty form is judged by whether the ZERO word is accepted — the
   * difference between an app that takes an optional configuration and one that
   * requires it.
   *
   * A word whose bytes are not registered yet is NOT accepted: the app would
   * refuse it at attach, which is exactly what `checkSettings` says.
   *
   * Through a ref, and guarded on the value: the caller passes an inline
   * closure, so depending on its identity would run this on every render, and
   * what it does is write to a form — which renders again.
   */
  const settled = !check.checking && !zeroCheck.checking;
  const accepted = filled ? check.ok : zeroCheck.ok;
  const verdict = settled && accepted;

  const report = useRef(onVerdict);
  report.current = onVerdict;
  const last = useRef<boolean | null>(null);
  useEffect(() => {
    if (last.current === verdict) return;
    last.current = verdict;
    report.current?.(verdict);
  }, [verdict]);

  const set = (name: string, next: string) => {
    const merged = { ...values, [name]: next };
    const all = config.fields.every((f) => (merged[f.name] ?? "").trim());
    onChange(merged, all ? (encodeSettings(config, merged)?.word ?? null) : null);
  };

  return (
    <div className="space-y-3">
      {config.fields.map((field) => (
        <FieldControl
          key={field.name}
          field={field}
          value={values[field.name] ?? ""}
          onChange={(next) => set(field.name, next)}
          invalid={!!check.reason}
        />
      ))}

      {needsRegistering && encoded && (
        <RegisterConfig
          hookAddress={hookAddress as Address}
          encoded={encoded.encoded}
          word={word}
          onRegistered={() => {
            refetch();
            // The verdict for this word is a cached REJECTION — the app
            // refused an id it did not hold. Now it holds it, so the question
            // has to be asked again rather than answered from that cache.
            queryClient.invalidateQueries({ queryKey: ["app-data-check"] });
          }}
        />
      )}

      <Verdict
        {...check}
        empty={!filled}
        optional={zeroCheck.ok}
        optionalKnown={!zeroCheck.checking}
        fields={config.fields}
        values={values}
      />
    </div>
  );
}

/**
 * One value, rendered as whatever the schema said it is.
 *
 * The control is chosen from the DESCRIPTION, never from which app this is —
 * so every app declaring seconds gets the same duration picker, every app
 * declaring labels gets the same select, and anything else gets a plain box.
 */
function FieldControl({
  field,
  value,
  onChange,
  invalid,
}: {
  field: AppField;
  value: string;
  onChange: (next: string) => void;
  invalid: boolean;
}) {
  const isSeconds = field.unit === "seconds";
  const bounded = !!field.min || !!field.max;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={`app-${field.name}`}>{field.title}</Label>
        {bounded && !field.enumLabels.length && (
          <span className="text-[10px] text-muted-foreground">
            {isSeconds
              ? `${describeSeconds(field.min)} – ${describeSeconds(field.max)}`
              : `${field.min || "0"} – ${field.max}`}
          </span>
        )}
      </div>

      {field.enumLabels.length > 0 ? (
        <select
          id={`app-${field.name}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border bg-background px-2 py-1.5 text-sm"
        >
          {field.enumLabels.map((label, i) => (
            <option key={label} value={String(i)}>
              {label}
            </option>
          ))}
        </select>
      ) : isSeconds ? (
        <DurationInput seconds={value} onChange={onChange} />
      ) : (
        <Input
          id={`app-${field.name}`}
          value={value}
          placeholder={field.param.type.startsWith("uint") ? "0" : "0x…"}
          inputMode={field.param.type.startsWith("uint") ? "numeric" : undefined}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid ? true : undefined}
        />
      )}

      {field.description && (
        <p className="text-[10px] leading-snug text-muted-foreground">
          {field.description}
        </p>
      )}
    </div>
  );
}

/**
 * Give the app the bytes its id stands for.
 *
 * A configuration larger than a word lives in the app's own store, and the
 * slot holds its `keccak256`. So the values are handed over once, and after
 * that any slot can point at them by id.
 *
 * Permissionless and idempotent, which is what makes this cheap: the id is the
 * hash of the bytes, so somebody else registering the same three values
 * registers them for everyone, and this step disappears — the caller only
 * renders it when the chain says the id is unknown.
 */
function RegisterConfig({
  hookAddress,
  encoded,
  word,
  onRegistered,
}: {
  hookAddress: Address;
  encoded: Hex;
  word: Hex | null;
  onRegistered: () => void;
}) {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });
  const busy = isPending || confirming;

  const done = useRef(onRegistered);
  done.current = onRegistered;
  useEffect(() => {
    if (isSuccess) done.current();
  }, [isSuccess]);

  return (
    <div className="space-y-1.5 border-l-2 border-amber-500/40 pl-3">
      <p className="text-[10px] leading-snug text-muted-foreground">
        These values have to be given to the app once before a slot can point at
        them. They are{" "}
        <span className="font-mono">{word?.slice(0, 10)}…</span>
      </p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() =>
          writeContract({
            address: hookAddress,
            abi: settingsStoreAbi,
            functionName: "registerSettings",
            args: [encoded],
          })
        }
      >
        {busy ? (
          <>
            <Loader2 className="size-3 animate-spin" /> Registering…
          </>
        ) : (
          "Register with the app"
        )}
      </Button>
    </div>
  );
}

/**
 * Seconds, entered the way people say them.
 *
 * The value crossing the boundary is always SECONDS — that is what the app's
 * signature asks for — and the unit is presentation, held here. Changing the
 * unit re-reads the same number in it (7 days → 7 hours), which is how the
 * runway control further up this form behaves; converting instead, to hold the
 * duration constant, makes the picker look like it did nothing.
 *
 * This replaced a row of presets — a day, a week, a month, three months —
 * which a number and a unit cover more finely and in fewer pixels.
 *
 * The typed amount is local rather than derived from the seconds prop, because
 * a derived one fights the typist: "0.0001 days" rounds to 9 seconds and comes
 * back as 0.000104. It still follows the prop when the value is changed from
 * outside, and it is reset by remounting, since the caller keys this on the
 * app address.
 */
function DurationInput({
  seconds,
  onChange,
}: {
  seconds: string;
  onChange: (seconds: string) => void;
}) {
  const initial = splitSeconds(seconds);
  const [amount, setAmount] = useState(initial.amount);
  const [unit, setUnit] = useState<TimeUnit>(initial.unit);

  // A preset writes seconds directly, so the boxes follow it rather than
  // showing what was last typed here.
  const mine = useRef(seconds);
  if (mine.current !== seconds) {
    mine.current = seconds;
    const split = splitSeconds(seconds);
    setAmount(split.amount);
    setUnit(split.unit);
  }

  const write = (nextAmount: string, nextUnit: TimeUnit) => {
    setAmount(nextAmount);
    setUnit(nextUnit);
    mine.current = nextAmount.trim()
      ? String(toSecondsRaw(nextAmount, nextUnit))
      : "";
    onChange(mine.current);
  };

  return (
    <div className="flex gap-2">
      <Input
        id="app-config"
        value={amount}
        inputMode="decimal"
        placeholder="0"
        className="w-24"
        onChange={(e) => write(e.target.value, unit)}
      />
      <select
        value={unit}
        onChange={(e) => write(amount, e.target.value as TimeUnit)}
        className="border bg-background px-2 text-sm"
        aria-label="Unit"
      >
        {timeUnits.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </select>
    </div>
  );
}

/** `toSeconds`, as a number rather than through the form's bigint. */
function toSecondsRaw(amount: string, unit: TimeUnit): number {
  const n = Number(amount.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * TIME_MULTIPLIERS[unit]);
}

/** Seconds → the largest whole unit that expresses them exactly. */
function splitSeconds(seconds: string): { amount: string; unit: TimeUnit } {
  const n = Number(seconds);
  if (!seconds || !Number.isFinite(n) || n <= 0)
    return { amount: "", unit: "days" };

  for (const unit of ["months", "days", "hours", "minutes"] as const) {
    const mult = TIME_MULTIPLIERS[unit];
    if (n % mult === 0) return { amount: String(n / mult), unit };
  }
  return { amount: String(n), unit: "seconds" };
}

/** What the chain says about the value in the box, once it has been asked. */
function Verdict({
  checking,
  ok,
  reason,
  empty,
  optional,
  optionalKnown,
  fields,
  values,
}: {
  checking: boolean;
  ok: boolean;
  reason: string | null;
  empty: boolean;
  optional: boolean;
  optionalKnown: boolean;
  fields: AppField[];
  values: Record<string, string>;
}) {
  if (empty)
    return (
      <p className="text-[10px] text-muted-foreground">
        {!optionalKnown
          ? "Reading what this app needs…"
          : optional
            ? "Optional — left empty, the app runs without it."
            : "Required by this app. The slot refuses an attach without it."}
      </p>
    );

  if (checking)
    return (
      <p className="flex items-center gap-1.5 text-[10px] text-blue-500">
        <Loader2 className="size-3 animate-spin" />
        Asking the app…
      </p>
    );

  if (reason)
    return (
      <p className="flex items-center gap-1.5 text-[10px] text-destructive">
        <AlertCircle className="size-3" />
        {reason}
      </p>
    );

  if (ok)
    return (
      <p className="flex items-center gap-1.5 text-[10px] text-green-600">
        <Check className="size-3" />
        {fields
          .map((f) =>
            f.unit === "seconds"
              ? describeSeconds(values[f.name])
              : f.enumLabels[Number(values[f.name] ?? 0)] ||
                (values[f.name] ?? ""),
          )
          .join(", ")}
        , accepted by the app.
      </p>
    );

  return null;
}
