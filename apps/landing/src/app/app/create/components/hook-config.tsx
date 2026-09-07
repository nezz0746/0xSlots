"use client";

import { AlertCircle, Check, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  describeSeconds,
  encodeHookData,
  type HookFamilySpec,
  useHookDataCheck,
  ZERO_WORD,
} from "@/hooks/use-hook-schema";
import { TIME_MULTIPLIERS, type TimeUnit, timeUnits } from "../sections";

/**
 * The form a hook asked for.
 *
 * Nothing here knows what a minimum tenure is. The control, its units, its
 * bounds and its error text all come from what the hook published — so a hook
 * nobody has written a UI for gets a working form, and a hook that changes its
 * limits changes this form without anyone editing it.
 *
 * This is now the ONLY configuration form. The minimum-tenure hook used to
 * have a second, hand-written one — a value and a unit, encoded at submit —
 * and the two disagreed about the same `uint256 window`: one was checked
 * against `validateHookData` and the other was not, so a duration the hook
 * would refuse could still be submitted. A hook that describes itself does not
 * need a bespoke screen, and having one meant maintaining the declaration and
 * the form separately, which is the thing descriptors exist to stop.
 *
 * Two things are separated on purpose. The BOUNDS came from the descriptor and
 * are advice: they shape the control and catch a wrong value early. The
 * VERDICT comes from `validateHookData` on the chain, and it is the authority
 * — the same function the slot runs at attach. When they disagree the chain
 * wins, and the message says what the chain said.
 */
export function HookConfig({
  hookAddress,
  family,
  value,
  onChange,
  onVerdict,
}: {
  hookAddress: string;
  family: HookFamilySpec;
  /** Raw strings, one per field, in the field's own unit. */
  value: string[];
  onChange: (next: string[], encoded: `0x${string}` | null) => void;
  /** The chain's answer, for whoever owns the submit button. */
  onVerdict?: (ok: boolean) => void;
}) {
  const encoded = encodeHookData(family.fields, value);
  const check = useHookDataCheck(hookAddress, encoded);

  /**
   * Whether leaving this empty is allowed — asked, not assumed.
   *
   * A descriptor's bounds start at 1 because zero is not a short window. But
   * on a host where the rule is OPTIONAL, an empty word is exactly how a slot
   * says it wants none: AdLand carries the tenure rule and skips it when
   * `hookData` is zero. The bounds cannot express that and the hook should not
   * have to — so the empty word is put to the same function that judges every
   * other value, and the answer words the line below.
   */
  const zeroCheck = useHookDataCheck(hookAddress, ZERO_WORD, 0);

  const field = family.fields[0];
  const typed = value[0] ?? "";

  /**
   * The verdict, reported up.
   *
   * `settled` matters as much as `accepted`: while the debounce or the call is
   * still outstanding the honest answer is "not yet", and reporting `true`
   * there would arm the button for the moment between a keystroke and the
   * chain's reply.
   *
   * An empty field is judged by whether the ZERO word is accepted — which is
   * the difference between a hook that takes an optional window and one that
   * requires it, and neither the bounds nor this component can know which.
   *
   * Through a ref, and guarded on the value: the caller passes an inline
   * closure, so depending on its identity would run this on every render, and
   * what it does is write to a form — which renders again.
   */
  const settled = !check.checking && !zeroCheck.checking;
  const accepted = typed ? check.ok : zeroCheck.ok;
  const verdict = settled && accepted;

  const report = useRef(onVerdict);
  report.current = onVerdict;
  const last = useRef<boolean | null>(null);
  useEffect(() => {
    if (last.current === verdict) return;
    last.current = verdict;
    report.current?.(verdict);
  }, [verdict]);

  // More than one field means the hook packs its word, which nothing ships
  // yet. Said plainly rather than rendered wrongly.
  if (family.fields.length > 1)
    return (
      <p className="text-[10px] leading-snug text-amber-600 dark:text-amber-500">
        This hook packs {family.fields.length} values into its configuration.
        Set it by hand — this form only writes one.
      </p>
    );

  if (!field) return null;

  const isSeconds = field.unit === "seconds";
  const set = (next: string) =>
    onChange([next], encodeHookData(family.fields, [next]));

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor="hook-config" className="capitalize">
          {field.name}
        </Label>
        {field.bounded && (
          <span className="text-[10px] text-muted-foreground">
            {isSeconds
              ? `${describeSeconds(field.min)} – ${describeSeconds(field.max)}`
              : `${field.min.toString()} – ${field.max.toString()}`}
          </span>
        )}
      </div>

      {/* A unit the client understands earns a control a person can use.
          Driven by the DESCRIPTOR's `unit`, not by which hook this is — so
          every hook declaring seconds gets the same duration control, and one
          declaring something else gets the plain number. */}
      {isSeconds ? (
        <DurationInput seconds={typed} onChange={set} />
      ) : (
        <div className="flex items-center gap-2">
          <Input
            id="hook-config"
            value={typed}
            inputMode="numeric"
            placeholder={field.bounded ? field.min.toString() : "0"}
            onChange={(e) => set(e.target.value)}
            aria-invalid={check.reason ? true : undefined}
          />
          {field.unit && (
            <span className="shrink-0 text-xs text-muted-foreground">
              {field.unit}
            </span>
          )}
        </div>
      )}

      <Verdict
        {...check}
        empty={!typed}
        optional={zeroCheck.ok}
        optionalKnown={!zeroCheck.checking}
        unit={field.unit}
        value={typed}
      />
    </div>
  );
}

/**
 * Seconds, entered the way people say them.
 *
 * The value crossing the boundary is always SECONDS — that is what the hook's
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
 * hook address.
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
        id="hook-config"
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
  unit,
  value,
}: {
  checking: boolean;
  ok: boolean;
  reason: string | null;
  empty: boolean;
  optional: boolean;
  optionalKnown: boolean;
  unit: string;
  value: string;
}) {
  if (empty)
    return (
      <p className="text-[10px] text-muted-foreground">
        {!optionalKnown
          ? "Reading what this hook needs…"
          : optional
            ? "Optional — left empty, the hook runs without it."
            : "Required by this hook. The slot refuses an attach without it."}
      </p>
    );

  if (checking)
    return (
      <p className="flex items-center gap-1.5 text-[10px] text-blue-500">
        <Loader2 className="size-3 animate-spin" />
        Asking the hook…
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
        {unit === "seconds" ? describeSeconds(value) : value}, accepted by the
        hook.
      </p>
    );

  return null;
}
