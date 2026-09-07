"use client";

import { adLandAbi, minimumTenureHookAbi } from "@0xslots/contracts/slots";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  type Abi,
  type AbiParameter,
  type Address,
  decodeAbiParameters,
  encodeAbiParameters,
  isAddress,
  parseAbiParameters,
} from "viem";
import { usePublicClient, useReadContracts } from "wagmi";
import { useChain } from "@/context/chain";

/**
 * A hook's own account of what it needs, turned into a form.
 *
 * Every hook that implements `IDescribedHook` publishes, per family:
 *
 *   - `signature` — an ABI type list, `"uint256 window"`. Plain, so viem's
 *     `parseAbiParameters` reads it with nothing written for this protocol.
 *   - `data` — `abi.encode(HookBounds[])`: what to call each value, what unit
 *     to show it in, and what range the contract will actually accept.
 *
 * The bounds matter because they are built from the hook's OWN constants —
 * `MAX_TENURE` and not a literal — so a form rendered from them cannot offer a
 * value the transaction will refuse. A schema published off-chain drifts; this
 * one is the same source the check reads.
 *
 * Nothing here knows what minimum tenure is. A hook nobody has written a UI
 * for renders the same way, which is the point of asking the chain instead of
 * shipping a table.
 */

const describedHookAbi = [
  {
    type: "function",
    name: "descriptors",
    stateMutability: "pure",
    inputs: [],
    outputs: [
      {
        type: "tuple[]",
        components: [
          { name: "family", type: "bytes32" },
          { name: "version", type: "uint32" },
          { name: "signature", type: "string" },
          { name: "data", type: "bytes" },
          { name: "metadataURI", type: "string" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "validateHookData",
    stateMutability: "view",
    inputs: [{ name: "data", type: "bytes32" }],
    outputs: [],
  },
] as const satisfies Abi;

/**
 * The same surface, plus every custom error this app has a definition for.
 *
 * A revert only carries four bytes and its arguments; the NAME lives in an ABI.
 * So a check made against the bare interface above can say that a hook refused
 * a value but not why — `TenureTooLong(31536000)` arrives as an unnamed
 * selector. Folding in the errors of the hooks shipped with the app is what
 * turns that back into a sentence.
 *
 * A hook nobody ships a definition for still checks correctly; it is only the
 * wording that degrades, and {readReason} says the selector rather than
 * pretending to know.
 */
const checkAbi: Abi = [
  ...describedHookAbi,
  ...[...adLandAbi, ...minimumTenureHookAbi].filter(
    (f): f is Extract<(typeof adLandAbi)[number], { type: "error" }> =>
      f.type === "error",
  ),
];

/** Mirrors `HookBounds` in `IDescribedHook.sol`. */
const boundsAbi = parseAbiParameters(
  "(string name, string unit, bool bounded, uint256 min, uint256 max)[]",
);

/**
 * An empty configuration word.
 *
 * Put to `validateHookData` like any other value, because whether a hook can
 * be attached without configuration is the hook's answer and not a rule a
 * client can infer: the same tenure rule is REQUIRED on the standalone hook
 * and OPTIONAL on AdLand, and the published bounds say the same thing in both.
 */
export const ZERO_WORD =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

export interface HookFieldSpec {
  /** From the signature. What the value IS. */
  param: AbiParameter;
  /** From the bounds. What it MEANS. */
  name: string;
  unit: string;
  bounded: boolean;
  min: bigint;
  max: bigint;
}

export interface HookFamilySpec {
  family: `0x${string}`;
  version: number;
  signature: string;
  metadataURI: string;
  fields: HookFieldSpec[];
}

/**
 * What a hook says it can be configured with.
 *
 * A hook may implement no descriptors at all, which is legal and common — the
 * result is simply no families, and the caller falls back to whatever it did
 * before. A hook that lies is also legal: `Slot` never reads this, so nothing
 * safety-relevant hangs off it. The honest phrasing for a UI is "this hook
 * says it takes a window".
 */
export function useHookSchema(address: string) {
  const { chainId } = useChain();
  const valid = isAddress(address);

  const { data, isLoading } = useReadContracts({
    query: {
      enabled: valid,
      retry: false,
      staleTime: Number.POSITIVE_INFINITY,
    },
    contracts: valid
      ? [
          {
            address: address as Address,
            abi: describedHookAbi,
            functionName: "descriptors",
            chainId,
          },
        ]
      : [],
  });

  const raw = data?.[0]?.result;
  const families: HookFamilySpec[] = [];

  for (const d of raw ?? []) {
    // No signature is a family that takes no configuration — creatives, say.
    if (!d.signature) continue;
    try {
      const params = parseAbiParameters(d.signature);
      const [bounds] = decodeAbiParameters(boundsAbi, d.data);
      families.push({
        family: d.family,
        version: d.version,
        signature: d.signature,
        metadataURI: d.metadataURI,
        fields: params.map((param, i) => ({
          param,
          name: bounds[i]?.name || param.name || `field ${i}`,
          unit: bounds[i]?.unit ?? "",
          bounded: bounds[i]?.bounded ?? false,
          min: bounds[i]?.min ?? 0n,
          max: bounds[i]?.max ?? 0n,
        })),
      });
    } catch {
      // A malformed signature or bounds is a hook describing itself badly.
      // Skipped rather than thrown: the rest of the form still works, and the
      // slot's own `validateHookData` remains the authority on what attaches.
    }
  }

  return { families, isLoading: valid && isLoading };
}

/**
 * The word a set of form values encodes to.
 *
 * One field fills the slot's whole `bytes32`, which is every hook shipped so
 * far. More than one has to be packed — standard ABI encoding pads each value
 * to 32 bytes, so two would need 64 — and packing is left unimplemented rather
 * than guessed at: a hook that does it will say so in its signature, and this
 * returns null until the encoding is written to match.
 */
export function encodeHookData(
  fields: HookFieldSpec[],
  values: string[],
): `0x${string}` | null {
  if (fields.length === 0) return null;
  if (fields.length > 1) return null;

  const field = fields[0];
  if (!field) return null;
  const value = values[0]?.trim();
  if (!value) return null;

  try {
    const parsed = field.param.type.startsWith("uint")
      ? BigInt(value)
      : (value as unknown);
    const encoded = encodeAbiParameters([field.param], [parsed]);
    // A full word already; `bytes32` is the same 32 bytes.
    return encoded.length === 66 ? (encoded as `0x${string}`) : null;
  } catch {
    return null;
  }
}

/**
 * The hook's own verdict on a value, before anything is attached.
 *
 * `validateHookData` is a `view` that reverts with a named, parameterised
 * error — `TenureTooLong(31536000)`, `TenureNotConfigured()`. Simulating it is
 * how a form shows the real reason rather than a guess, and it is the same
 * function the slot calls at attach, so agreeing with it here means agreeing
 * with it there.
 *
 * Debounced, because it is one RPC call per keystroke otherwise.
 */
export function useHookDataCheck(
  address: string,
  hookData: `0x${string}` | null,
  delayMs = 350,
) {
  const { chainId } = useChain();
  const client = usePublicClient({ chainId });
  const [settled, setSettled] = useState<`0x${string}` | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSettled(hookData), delayMs);
    return () => clearTimeout(t);
  }, [hookData, delayMs]);

  const enabled = isAddress(address) && settled !== null && !!client;

  /**
   * A plain read, not a simulation.
   *
   * `useSimulateContract` refuses to run without a connected wallet — its
   * query is gated on a connector — and a disabled query reports no error,
   * which read as "accepted by the hook" for a value the chain would refuse.
   * The check now runs against the public client, so it is right before anyone
   * connects, which is when a creator is filling this in.
   *
   * `validateHookData` returns nothing, so the query resolves to `true` rather
   * than to the call's own `undefined` — which react-query treats as a failure.
   */
  const { data, error, isLoading } = useQuery({
    queryKey: ["hook-data-check", chainId, address, settled],
    enabled,
    retry: false,
    queryFn: async () => {
      if (!client) throw new Error("No client for this chain.");
      await client.readContract({
        address: address as Address,
        abi: checkAbi,
        functionName: "validateHookData",
        args: [settled],
      });
      return true as const;
    },
  });

  return {
    // Only once the debounce has caught up, so the message never describes a
    // value the field no longer holds.
    checking: enabled && (isLoading || settled !== hookData),
    ok: data === true && settled === hookData,
    reason: error ? readReason(error) : null,
  };
}

/**
 * The revert, said the way a person would.
 *
 * viem puts the custom error's name and arguments on the simulation error, so
 * the message can name the limit the contract actually enforces instead of
 * repeating a bound the form was told about.
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
    return `Too long. The most this hook allows is ${describeSeconds(args[0])}.`;
  if (name) return `${name}${args.length ? ` (${args.join(", ")})` : ""}`;

  // No definition for it, so the selector is the honest answer — the check
  // still ran, and the hook still said no.
  const raw = e.cause?.data;
  if (typeof raw === "string")
    return `This hook refuses that value (${raw.slice(0, 10)}).`;
  return e.shortMessage ?? "This hook refuses that value.";
}

/** Seconds as something readable, for a bound that arrived as a number. */
export function describeSeconds(value: unknown): string {
  const n = typeof value === "bigint" ? Number(value) : Number(value ?? 0);
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
