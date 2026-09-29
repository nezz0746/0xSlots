"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  type Abi,
  type AbiParameter,
  type Address,
  decodeAbiParameters,
  encodeAbiParameters,
  type Hex,
  hexToString,
  isAddress,
  isHex,
  parseAbiItem,
  size,
  stringToHex,
  zeroAddress,
} from "viem";
import { usePublicClient, useReadContract } from "wagmi";
import { useChain } from "@/context/chain";

/**
 * A module's own account of what it needs, turned into a form.
 *
 * `metadata()` answers with one JSON document. Its `settings` half is a JSON
 * Schema 2020-12 — the format `react-jsonschema-form`, JSONForms and AJV all
 * read — so nothing here is a format this protocol invented, and a module that
 * would rather use one of those libraries passes `settings` to it untouched.
 *
 * What the protocol adds is a handful of `x-` keywords, which a validator
 * ignores:
 *
 *   - `x-abi` — an ORDERED `AbiParameter[]`, because ABI encoding is positional
 *     and `properties` is a JSON object, which is not. `abi.encode` of those
 *     values IS the slot's `settings`.
 *   - `x-optional` — whether a slot may attach this module configuring nothing.
 *   - `x-semantic`, `x-unit`, `x-minimum`, `x-maximum`, `x-enum-labels` — what a
 *     value means, what to call it, and what it may be.
 *
 * Every value is a string. A `uint64` bound does not survive `JSON.parse` as a
 * number, and a form that quietly rounds its own maximum is a form that is
 * right up until the transaction reverts.
 *
 * Nothing here knows what a minimum tenure is. A module nobody has written a UI
 * for renders the same way, which is the point of asking the chain instead of
 * shipping a table.
 */

const describedModuleAbi = [
  {
    type: "function",
    name: "metadata",
    stateMutability: "pure",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "validateSettings",
    stateMutability: "view",
    inputs: [{ name: "settings", type: "bytes" }],
    outputs: [],
  },
] as const satisfies Abi;

/**
 * The check's ABI: the interface above, plus the errors the module itself
 * lists in its metadata.
 *
 * A revert only carries four bytes and its arguments; the NAME lives in an ABI.
 * The module publishes its own refusals beside its settings, so a check against
 * a module this app has never heard of still names and words the refusal. A
 * module that lists none still checks correctly; only the wording degrades,
 * and {readReason} says the selector rather than pretending to know.
 */
export function checkAbiFor(refusals: Refusal[]): Abi {
  return [...describedModuleAbi, ...refusals.map((r) => r.item)];
}

/**
 * Empty settings.
 *
 * Put to `validateSettings` like any other value, because whether a module can
 * be attached without configuration is the module's answer and not a rule a
 * client can infer: the same tenure rule is REQUIRED on the standalone module and
 * OPTIONAL on AdLand, and each says so in its own schema.
 */
export const EMPTY_SETTINGS = "0x" as const;

/** One property of the config schema, paired with its `x-abi` entry. */
export interface ModuleField {
  /** The property name, which is also the `x-abi` name. */
  name: string;
  /** What it encodes as. */
  param: AbiParameter;
  title: string;
  description: string;
  unit: string;
  /** Decimal strings, or empty. Strings because a `uint64` is not a JS number. */
  min: string;
  max: string;
  /** A value's meaning, when the module tags one — `"minimum-tenure"`. */
  semantic: string;
  /** How the value is typed and read — `"bytes32-string"`. */
  format: string;
  /** In value order, when the field is an enumeration. */
  enumLabels: string[];
}

export interface ModuleSettingsSpec {
  title: string;
  fields: ModuleField[];
  /** Whether a slot may attach this module with no configuration at all. */
  optional: boolean;
  /** The schema as published, for a module that wants to drive its own form. */
  schema: Record<string, unknown>;
  /** How `validateSettings` may refuse, from the document's `errors`. */
  refusals: Refusal[];
}

/** One way a module's `validateSettings` refuses, as the module words it. */
export interface Refusal {
  item: AbiError;
  /** `{0}`, `{1}` are the error's arguments. */
  message: string;
  /** The unit every argument is in. */
  unit: string;
}

export interface ModuleDefinition {
  title: string;
  description: string;
  docs: string;
  /** Absent for a module that takes no settings. */
  settings?: ModuleSettingsSpec;
}

/**
 * What a module says it is.
 *
 * A module may implement nothing, revert, or answer with something that is not
 * JSON — all legal, and all the same answer here: `null`, and the caller falls
 * back to the scopes, which still say whether the module may refuse a buy. A
 * module that lies is legal too: `Slot` never reads this, so nothing
 * safety-relevant hangs off it. The honest phrasing for a UI is "this module says
 * it takes a window".
 */
export function useModuleDefinition(address: string) {
  const { chainId } = useChain();
  const valid = isAddress(address);

  const { data, isLoading } = useReadContract({
    address: valid ? (address as Address) : undefined,
    abi: describedModuleAbi,
    functionName: "metadata",
    chainId,
    query: {
      enabled: valid,
      retry: false,
      // Fixed by the module's code, so it only changes if the module itself does —
      // at which point the address, and this key, change with it.
      staleTime: Number.POSITIVE_INFINITY,
    },
  });

  // Parsed once per answer, so every consumer sees the same objects across
  // renders and can key effects on them.
  const definition = useMemo(
    () => (data ? parseDefinition(data) : null),
    [data],
  );
  return { definition, isLoading: valid && isLoading };
}

/** The document, or `null` for anything that is not one. */
export function parseDefinition(raw: string): ModuleDefinition | null {
  try {
    const d = JSON.parse(raw) as Record<string, never>;
    const out: ModuleDefinition = {
      title: str(d.title),
      description: str(d.description),
      docs: str(d.docs),
    };

    const c = d.settings as Record<string, never> | undefined;
    if (!c) return out;

    // An entry whose signature does not parse is dropped, not fatal: it only
    // costs the wording of that one refusal.
    const refusals: Refusal[] = [];
    for (const e of (Array.isArray(d.errors) ? d.errors : []) as Record<
      string,
      never
    >[]) {
      try {
        const item = parseAbiItem(`error ${str(e.signature)}`) as AbiError;
        if (item.type !== "error") continue;
        refusals.push({
          item,
          message: str(e.message),
          unit: str(e["x-unit"]),
        });
      } catch {}
    }

    // `x-abi` carries the order, so it drives: a property nobody encodes is not
    // a field, whatever `properties` says.
    const abi = (c["x-abi"] ?? []) as { name: string; type: string }[];
    const props = (c.properties ?? {}) as Record<string, Record<string, never>>;

    out.settings = {
      title: str(c.title) || out.title,
      optional: c["x-optional"] === true,
      schema: c as unknown as Record<string, unknown>,
      refusals,
      fields: abi.map((p) => {
        const s = props[p.name] ?? ({} as Record<string, never>);
        return {
          name: p.name,
          param: { name: p.name, type: p.type } as AbiParameter,
          title: str(s.title) || p.name,
          description: str(s.description),
          unit: str(s["x-unit"]),
          min: str(s["x-minimum"]),
          max: str(s["x-maximum"]),
          semantic: str(s["x-semantic"]),
          format: str(s["x-format"]),
          enumLabels: Array.isArray(s["x-enum-labels"])
            ? (s["x-enum-labels"] as string[])
            : [],
        };
      }),
    };
    return out;
  } catch {
    // Malformed is a module describing itself badly. The module's own
    // `validateSettings` remains the authority on what attaches.
    return null;
  }
}

type AbiError = Extract<Abi[number], { type: "error" }>;

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** `x-semantic` values this app gives a dedicated rendering. */
export const SEMANTIC = {
  tenure: "minimum-tenure",
} as const;

/** `x-format` values this app types and reads. */
export const FORMAT = {
  /** Text, packed left-aligned into 32 bytes. */
  bytes32String: "bytes32-string",
} as const;

const isInteger = (type: string) =>
  type.startsWith("uint") || type.startsWith("int");

/**
 * What a field starts at before anybody types.
 *
 * An enumeration starts at its first value, because a `<select>` always SHOWS
 * one and a form value that disagrees with what is on screen is a form that
 * cannot be submitted for no visible reason. On a module whose settings are
 * optional every field is optional too, so a number starts at its minimum.
 * Anything else starts blank, and the module's own check says why that is not
 * enough.
 */
export function defaultValue(field: ModuleField, optional: boolean): string {
  if (field.enumLabels.length > 0) return field.min || "0";
  if (optional && isInteger(field.param.type)) return field.min || "0";
  return "";
}

export function defaultValues(
  config: ModuleSettingsSpec,
): Record<string, string> {
  return Object.fromEntries(
    config.fields.map((f) => [f.name, defaultValue(f, config.optional)]),
  );
}

/**
 * Whether a blank field can still be encoded: as the zero value of its type,
 * which is what "not set" means on-chain. Always for a `bytes32` or an
 * address; for a number only when the module's settings are optional.
 */
function blankIsZero(field: ModuleField, optional: boolean): boolean {
  const t = field.param.type;
  if (t === "address" || /^bytes\d+$/.test(t)) return true;
  return optional && isInteger(t);
}

export function isFilled(
  config: ModuleSettingsSpec,
  values: Record<string, string>,
): boolean {
  return config.fields.every(
    (f) =>
      (values[f.name] ?? "").trim() !== "" || blankIsZero(f, config.optional),
  );
}

/** One form value as the argument its ABI type takes. Throws when it is not one. */
function toArg(field: ModuleField, raw: string, optional: boolean): unknown {
  const t = field.param.type;
  if (!raw) {
    if (!blankIsZero(field, optional))
      throw new Error(`${field.name} is empty`);
    if (t === "address") return zeroAddress;
    if (t.startsWith("bytes")) return `0x${"00".repeat(Number(t.slice(5)))}`;
    return 0n;
  }
  if (isInteger(t)) return BigInt(raw);
  // A registry name is typed as text and packed, left-aligned, into 32 bytes.
  // A full 32-byte hex value is taken as it is.
  if (field.format === FORMAT.bytes32String && t === "bytes32") {
    if (isHex(raw) && size(raw) === 32) return raw;
    if (new TextEncoder().encode(raw).length > 32)
      throw new Error("longer than 32 bytes");
    return stringToHex(raw, { size: 32 });
  }
  return raw;
}

/**
 * The settings a set of form values encodes to: `abi.encode` against `x-abi`,
 * in the order that array gives. The slot stores exactly these bytes.
 */
export function encodeSettings(
  config: ModuleSettingsSpec,
  values: Record<string, string>,
): Hex | null {
  if (config.fields.length === 0) return null;
  try {
    const args = config.fields.map((f) =>
      toArg(f, (values[f.name] ?? "").trim(), config.optional),
    );
    return encodeAbiParameters(
      config.fields.map((f) => f.param),
      args,
    );
  } catch {
    return null;
  }
}

/** One configured value, labelled and formatted from the module's own schema. */
export interface SettingsEntry {
  name: string;
  title: string;
  description: string;
  /** Formatted for a reader; empty when the value is its type's zero. */
  display: string;
}

/**
 * A slot's settings, read back through the schema that produced them.
 *
 * Empty settings on an optional module decode as the defaults — every value
 * zero — because that is what the module reads them as. `null` when the bytes
 * do not decode against `x-abi`, which a reader should show as "unreadable"
 * rather than guess at.
 */
export function describeSettings(
  config: ModuleSettingsSpec,
  settings: Hex,
): SettingsEntry[] | null {
  try {
    const values =
      settings === "0x" || size(settings) === 0
        ? config.fields.map((f) => toArg(f, "", true))
        : decodeAbiParameters(
            config.fields.map((f) => f.param),
            settings,
          );
    return config.fields.map((f, i) => ({
      name: f.name,
      title: f.title,
      description: f.description,
      display: formatValue(f, values[i]),
    }));
  } catch {
    return null;
  }
}

function formatValue(field: ModuleField, value: unknown): string {
  if (field.enumLabels.length > 0) {
    const label = field.enumLabels[Number(value)];
    return label ?? String(value);
  }
  if (field.unit === "seconds") {
    const text = describeSeconds(value);
    return text === "none" ? "" : text;
  }
  if (typeof value === "bigint") return value === 0n ? "" : value.toString();
  if (typeof value === "string" && /^0x0*$/.test(value)) return "";
  if (field.format === FORMAT.bytes32String && typeof value === "string") {
    const text = hexToString(value as Hex, { size: 32 }).replace(/\0+$/, "");
    // A key that is not printable text is shown as the hex it is.
    return /^[\x20-\x7e]+$/.test(text) ? text : value;
  }
  return String(value);
}

/**
 * The module's own verdict on some settings, before anything is attached.
 *
 * `validateSettings` is a `view` that reverts with a named, parameterised
 * error — `TenureTooLong(31536000)`, `MalformedSettings()`. Reading it is how
 * a form shows the real reason rather than a guess, and it is the same function
 * the slot calls at attach, so agreeing with it here means agreeing with it
 * there.
 *
 * Debounced, because it is one RPC call per keystroke otherwise.
 */
export function useSettingsCheck(
  address: string,
  settings: Hex | null,
  {
    refusals = [],
    delayMs = 350,
  }: {
    /** The module's own refusals, so a revert can be named and worded. */
    refusals?: Refusal[];
    delayMs?: number;
  } = {},
) {
  const { chainId } = useChain();
  const client = usePublicClient({ chainId });
  const [settled, setSettled] = useState<Hex | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSettled(settings), delayMs);
    return () => clearTimeout(t);
  }, [settings, delayMs]);

  const enabled = isAddress(address) && settled !== null && !!client;

  /**
   * A plain read, not a simulation.
   *
   * `useSimulateContract` refuses to run without a connected wallet — its query
   * is gated on a connector — and a disabled query reports no error, which read
   * as "accepted by the module" for a value the chain would refuse. The check runs
   * against the public client, so it is right before anyone connects, which is
   * when a creator is filling this in.
   *
   * `validateSettings` returns nothing, so the query resolves to `true` rather
   * than to the call's own `undefined` — which react-query treats as a failure.
   */
  const { data, error, isLoading } = useQuery({
    queryKey: ["app-data-check", chainId, address, settled],
    enabled,
    retry: false,
    queryFn: async () => {
      if (!client) throw new Error("No client for this chain.");
      await client.readContract({
        address: address as Address,
        abi: checkAbiFor(refusals),
        functionName: "validateSettings",
        args: [settled as Hex],
      });
      return true as const;
    },
  });

  return {
    // Only once the debounce has caught up, so the message never describes a
    // value the field no longer holds.
    checking: enabled && (isLoading || settled !== settings),
    ok: data === true && settled === settings,
    reason: error ? readReason(error, refusals) : null,
  };
}

/**
 * The revert, said the way a person would.
 *
 * viem puts the custom error's name and arguments on the error, so the message
 * can name the limit the contract actually enforces instead of repeating a
 * bound the form was told about.
 */
export function readReason(error: unknown, refusals: Refusal[]): string {
  const e = error as {
    cause?: {
      data?: string | { errorName?: string; args?: readonly unknown[] };
    };
    shortMessage?: string;
  };
  const decoded = typeof e.cause?.data === "object" ? e.cause.data : undefined;
  const name = decoded?.errorName;
  const args = decoded?.args ?? [];

  const refusal = refusals.find((r) => r.item.name === name);
  const shown = args.map((a) =>
    refusal?.unit === "seconds" ? describeSeconds(a) : String(a),
  );
  // The module's own sentence, with its arguments put in their unit.
  if (refusal?.message)
    return refusal.message.replace(
      /\{(\d+)\}/g,
      (_, i) => shown[Number(i)] ?? "",
    );
  if (name) return `${name}${shown.length ? ` (${shown.join(", ")})` : ""}`;

  // No definition for it, so the selector is the honest answer — the check
  // still ran, and the module still said no.
  const raw = e.cause?.data;
  if (typeof raw === "string")
    return `This module refuses that value (${raw.slice(0, 10)}).`;
  return e.shortMessage ?? "This module refuses that value.";
}

/** Seconds as something readable, for a bound that arrived as a string. */
export function describeSeconds(value: unknown): string {
  const n =
    typeof value === "bigint" ? Number(value) : Number(String(value ?? 0));
  if (!Number.isFinite(n) || n <= 0) return "none";
  const day = 86_400;
  if (n % (365 * day) === 0) return plural(n / (365 * day), "year");
  if (n % (30 * day) === 0) return plural(n / (30 * day), "month");
  if (n % (7 * day) === 0) return plural(n / (7 * day), "week");
  if (n % day === 0) return plural(n / day, "day");
  if (n % 3600 === 0) return plural(n / 3600, "hour");
  if (n % 60 === 0) return plural(n / 60, "minute");
  return plural(n, "second");
}

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;

/**
 * A module and its configuration as one line, in the module's own words:
 * "AdLand · Minimum tenure 7 days · Moderation Every".
 *
 * `null` when there is no module or it describes nothing, so a caller falls
 * back to whatever label it already had.
 */
export function useModuleSummary(
  module: string | undefined,
  settings: Hex | undefined,
): string | null {
  const attached = !!module && module !== zeroAddress;
  const { definition } = useModuleDefinition(attached ? module : "");
  return useMemo(() => {
    if (!attached || !definition?.title) return null;
    const config = definition.settings;
    const entries =
      config?.fields.length && settings
        ? (describeSettings(config, settings) ?? [])
        : [];
    return [
      definition.title,
      ...entries.map((e) => `${e.title} ${e.display || "none"}`),
    ].join(" · ");
  }, [attached, definition, settings]);
}
