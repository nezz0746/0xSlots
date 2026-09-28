"use client";

import { AlertCircle, Check, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Hex } from "viem";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  defaultValues,
  describeSeconds,
  describeSettings,
  EMPTY_SETTINGS,
  encodeSettings,
  isFilled,
  type ModuleField,
  type ModuleSettingsSpec,
  FORMAT,
  type SettingsEntry,
  useSettingsCheck,
} from "@/hooks/use-module-schema";
import { TIME_MULTIPLIERS, type TimeUnit, timeUnits } from "../sections";

/**
 * The form a module asked for.
 *
 * Nothing here knows what a minimum tenure is. Every control, its units, its
 * bounds and its error text come from the JSON Schema the module published — so a
 * module nobody has written a UI for gets a working form, and a module that changes
 * its limits changes this form without anyone editing it.
 *
 * Two things are separated on purpose. The BOUNDS came from the schema and are
 * advice: they shape the control and catch a wrong value early. The VERDICT
 * comes from `validateSettings` on the chain, and it is the authority — the
 * same function the slot runs at attach. When they disagree the chain wins, and
 * the message says what the chain said. That split matters more now that every
 * value travels as a string: a range on a string is not something a schema
 * validator will enforce for you.
 */
export function ModuleSettings({
  moduleAddress,
  config,
  values,
  onChange,
  onVerdict,
}: {
  moduleAddress: string;
  config: ModuleSettingsSpec;
  /** Raw strings by field name, each in that field's own unit. */
  values: Record<string, string>;
  onChange: (next: Record<string, string>, settings: Hex | null) => void;
  /** The chain's answer, for whoever owns the submit button. */
  onVerdict?: (ok: boolean) => void;
}) {
  // What is on screen: the module's defaults, overlaid with what was typed.
  // A select always shows a value, so the form has to hold that value too.
  const shown = { ...defaultValues(config), ...values };
  const filled = isFilled(config, shown);
  const encoded = filled ? encodeSettings(config, shown) : null;
  const check = useSettingsCheck(moduleAddress, encoded, {
    refusals: config.refusals,
  });

  /**
   * The defaults, reported up once per module.
   *
   * Without this the caller holds no settings until somebody edits a field,
   * so a form showing "Open" and a minimum tenure of 0 would submit empty
   * bytes that only happen to mean the same thing — and a module whose
   * defaults are not zero would be attached with settings nobody saw.
   */
  const reported = useRef<string | null>(null);
  const change = useRef(onChange);
  change.current = onChange;
  useEffect(() => {
    if (reported.current === moduleAddress) return;
    reported.current = moduleAddress;
    change.current(shown, encoded);
  }, [moduleAddress, shown, encoded]);

  /**
   * Whether leaving this empty is allowed — asked, not assumed.
   *
   * The schema says so in `x-optional`, but the module is asked anyway, because
   * empty settings are judged by the same function that judges every other
   * value and its answer is the one the slot will act on. AdLand carries the
   * tenure rule and skips it when the settings are empty; the standalone module
   * refuses.
   */
  const zeroCheck = useSettingsCheck(moduleAddress, EMPTY_SETTINGS, {
    refusals: config.refusals,
    delayMs: 0,
  });

  /**
   * The verdict, reported up.
   *
   * `settled` matters as much as `accepted`: while the debounce or the call is
   * still outstanding the honest answer is "not yet", and reporting `true`
   * there would arm the button for the moment between a keystroke and the
   * chain's reply.
   *
   * An empty form is judged by whether EMPTY settings are accepted — the
   * difference between a module that takes an optional configuration and one that
   * requires it.
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
    const merged = { ...shown, [name]: next };
    onChange(
      merged,
      isFilled(config, merged) ? encodeSettings(config, merged) : null,
    );
  };

  return (
    <div className="space-y-3">
      {config.fields.map((field) => (
        <FieldControl
          key={field.name}
          field={field}
          value={shown[field.name] ?? ""}
          onChange={(next) => set(field.name, next)}
          invalid={!!check.reason}
        />
      ))}

      <Verdict
        {...check}
        reason={
          filled && !encoded
            ? "A value does not fit its type — a number, a 0x address, or a name of at most 32 bytes."
            : check.reason
        }
        empty={!filled}
        optional={zeroCheck.ok}
        optionalKnown={!zeroCheck.checking}
        entries={encoded ? describeSettings(config, encoded) : null}
      />
    </div>
  );
}

/**
 * One value, rendered as whatever the schema said it is.
 *
 * The control is chosen from the DESCRIPTION, never from which module this is —
 * so every module declaring seconds gets the same duration picker, every module
 * declaring labels gets the same select, and anything else gets a plain box.
 */
function FieldControl({
  field,
  value,
  onChange,
  invalid,
}: {
  field: ModuleField;
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
      ) : field.format === FORMAT.bytes32String ? (
        <Input
          id={`app-${field.name}`}
          value={value}
          placeholder="none — or text, up to 32 bytes"
          maxLength={32}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid ? true : undefined}
        />
      ) : (
        <Input
          id={`app-${field.name}`}
          value={value}
          placeholder={field.param.type.startsWith("uint") ? "0" : "0x…"}
          inputMode={
            field.param.type.startsWith("uint") ? "numeric" : undefined
          }
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
 * Seconds, entered the way people say them.
 *
 * The value crossing the boundary is always SECONDS — that is what the module's
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
 * module address.
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
        id="module-settings"
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
  entries,
}: {
  checking: boolean;
  ok: boolean;
  reason: string | null;
  empty: boolean;
  optional: boolean;
  optionalKnown: boolean;
  entries: SettingsEntry[] | null;
}) {
  if (empty)
    return (
      <p className="text-[10px] text-muted-foreground">
        {!optionalKnown
          ? "Reading what this module needs…"
          : optional
            ? "Optional — left empty, the module runs without it."
            : "Required by this module. The slot refuses an attach without it."}
      </p>
    );

  if (checking)
    return (
      <p className="flex items-center gap-1.5 text-[10px] text-blue-500">
        <Loader2 className="size-3 animate-spin" />
        Asking the module…
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
        {(entries ?? [])
          .map((e) => `${e.title}: ${e.display || "none"}`)
          .join(" · ")}{" "}
        — accepted by the module.
      </p>
    );

  return null;
}
