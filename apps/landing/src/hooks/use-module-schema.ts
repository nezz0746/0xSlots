"use client";

import { adLandAbi, minimumTenureModuleAbi } from "@0xslots/contracts/slots";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  type Abi,
  type AbiParameter,
  type Address,
  encodeAbiParameters,
  type Hex,
  isAddress,
  keccak256,
} from "viem";
import { usePublicClient, useReadContract } from "wagmi";
import { useChain } from "@/context/chain";

/**
 * A module's own account of what it needs, turned into a form.
 *
 * `definition()` answers with one JSON document. Its `settings` half is a JSON
 * Schema 2020-12 — the format `react-jsonschema-form`, JSONForms and AJV all
 * read — so nothing here is a format this protocol invented, and a module that
 * would rather use one of those libraries passes `settings` to it untouched.
 *
 * What the protocol adds is a handful of `x-` keywords, which a validator
 * ignores:
 *
 *   - `x-abi` — an ORDERED `AbiParameter[]`, because ABI encoding is positional
 *     and `properties` is a JSON object, which is not.
 *   - `x-settings-encoding` — whether the encoded bytes ARE the slot's word, or
 *     have to be registered with the module and the returned id attached instead.
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
    name: "definition",
    stateMutability: "pure",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "checkSettings",
    stateMutability: "view",
    inputs: [{ name: "settings", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "areSettingsRegistered",
    stateMutability: "view",
    inputs: [{ name: "id", type: "bytes32" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "registerSettings",
    stateMutability: "nonpayable",
    inputs: [{ name: "settings", type: "bytes" }],
    outputs: [{ type: "bytes32" }],
  },
] as const satisfies Abi;

/**
 * The same surface, plus every custom error this app has a definition for.
 *
 * A revert only carries four bytes and its arguments; the NAME lives in an ABI.
 * So a check made against the bare interface above can say that a module refused
 * a value but not why — `TenureTooLong(31536000)` arrives as an unnamed
 * selector. Folding in the errors of the modules shipped with the app is what
 * turns that back into a sentence.
 *
 * A module nobody ships a definition for still checks correctly; it is only the
 * wording that degrades, and {readReason} says the selector rather than
 * pretending to know.
 */
const checkAbi: Abi = [
  ...describedModuleAbi,
  ...[...adLandAbi, ...minimumTenureModuleAbi].filter(
    (f): f is Extract<(typeof adLandAbi)[number], { type: "error" }> =>
      f.type === "error",
  ),
];

/**
 * An empty configuration word.
 *
 * Put to `checkSettings` like any other value, because whether a module can
 * be attached without configuration is the module's answer and not a rule a
 * client can infer: the same tenure rule is REQUIRED on the standalone module and
 * OPTIONAL on AdLand, and each says so in its own schema.
 */
export const ZERO_WORD =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

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
  /** In value order, when the field is an enumeration. */
  enumLabels: string[];
}

export interface ModuleSettingsSpec {
  title: string;
  fields: ModuleField[];
  /** Whether the encoded bytes are registered and the slot's word is their id. */
  registered: boolean;
  /** Whether a slot may attach this module with no configuration at all. */
  optional: boolean;
  /** The schema as published, for a module that wants to drive its own form. */
  schema: Record<string, unknown>;
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
    functionName: "definition",
    chainId,
    query: {
      enabled: valid,
      retry: false,
      // Fixed by the module's code, so it only changes if the module itself does —
      // at which point the address, and this key, change with it.
      staleTime: Number.POSITIVE_INFINITY,
    },
  });

  return {
    definition: data ? parseDefinition(data) : null,
    isLoading: valid && isLoading,
  };
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

    // `x-abi` carries the order, so it drives: a property nobody encodes is not
    // a field, whatever `properties` says.
    const abi = (c["x-abi"] ?? []) as { name: string; type: string }[];
    const props = (c.properties ?? {}) as Record<string, Record<string, never>>;

    out.settings = {
      title: str(c.title) || out.title,
      registered: c["x-settings-encoding"] === "registered",
      optional: c["x-optional"] === true,
      schema: c as unknown as Record<string, unknown>,
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
          enumLabels: Array.isArray(s["x-enum-labels"])
            ? (s["x-enum-labels"] as string[])
            : [],
        };
      }),
    };
    return out;
  } catch {
    // Malformed is a module describing itself badly. The module's own
    // `checkSettings` remains the authority on what attaches.
    return null;
  }
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

/**
 * The word a set of form values encodes to.
 *
 * Two steps, because a slot holds 32 bytes and a configuration may be larger.
 * The values are encoded against `x-abi` — one call, in the order that array
 * gives — and then either the encoding IS the word, or the word is its
 * `keccak256` and the bytes have to be registered with the module first.
 *
 * The id is computed here rather than read back from a transaction: it is the
 * hash of the same bytes the module hashes, so a configuration somebody already
 * registered needs no transaction at all.
 */
export function encodeSettings(
  config: ModuleSettingsSpec,
  values: Record<string, string>,
): { encoded: Hex; word: Hex } | null {
  if (config.fields.length === 0) return null;
  try {
    const args = config.fields.map((f) => {
      const raw = (values[f.name] ?? "").trim();
      if (!raw) throw new Error(`${f.name} is empty`);
      return f.param.type.startsWith("uint") || f.param.type.startsWith("int")
        ? BigInt(raw)
        : (raw as unknown);
    });
    const encoded = encodeAbiParameters(
      config.fields.map((f) => f.param),
      args,
    );
    return {
      encoded,
      word: config.registered ? keccak256(encoded) : (encoded as Hex),
    };
  } catch {
    return null;
  }
}

/**
 * Whether the module already holds the bytes this word stands for.
 *
 * Registration is permissionless and idempotent — the same bytes always hash to
 * the same id — so a configuration somebody else already registered costs
 * nothing, and the form skips straight to attaching it.
 */
export function useSettingsRegistered(
  address: string,
  word: Hex | null,
  enabled: boolean,
) {
  const { chainId } = useChain();
  const { data, isLoading, refetch } = useReadContract({
    address: isAddress(address) ? (address as Address) : undefined,
    abi: describedModuleAbi,
    functionName: "areSettingsRegistered",
    args: word ? [word] : undefined,
    chainId,
    query: { enabled: enabled && isAddress(address) && !!word, retry: false },
  });
  return { registered: data === true, isLoading, refetch };
}

/** The write a form sends when the bytes are not registered yet. */
export const settingsStoreAbi = describedModuleAbi;

/**
 * The module's own verdict on a word, before anything is attached.
 *
 * `checkSettings` is a `view` that reverts with a named, parameterised
 * error — `TenureTooLong(31536000)`, `UnknownSettings(0x…)`. Reading it is how
 * a form shows the real reason rather than a guess, and it is the same function
 * the slot calls at attach, so agreeing with it here means agreeing with it
 * there.
 *
 * Debounced, because it is one RPC call per keystroke otherwise.
 */
export function useSettingsCheck(
  address: string,
  settings: Hex | null,
  delayMs = 350,
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
   * `checkSettings` returns nothing, so the query resolves to `true` rather
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
        abi: checkAbi,
        functionName: "checkSettings",
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
    reason: error ? readReason(error) : null,
  };
}

/**
 * The revert, said the way a person would.
 *
 * viem puts the custom error's name and arguments on the error, so the message
 * can name the limit the contract actually enforces instead of repeating a
 * bound the form was told about.
 */
function readReason(error: unknown): string {
  const e = error as {
    cause?: {
      data?: string | { errorName?: string; args?: readonly unknown[] };
    };
    shortMessage?: string;
  };
  const decoded = typeof e.cause?.data === "object" ? e.cause.data : undefined;
  const name = decoded?.errorName;
  const args = decoded?.args ?? [];

  if (name === "TenureNotConfigured") return "Set a window above zero.";
  if (name === "TenureTooLong")
    return `Too long. The most this module allows is ${describeSeconds(args[0])}.`;
  if (name === "UnknownSettings")
    return "This module has not been given these values yet.";
  if (name) return `${name}${args.length ? ` (${args.join(", ")})` : ""}`;

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
