import {
  type AbiParameter,
  decodeAbiParameters,
  type Hex,
  parseAbiParameters,
} from "viem";

/**
 * Reading a payload back through the schema the chain stored beside it.
 *
 * This is the whole argument for SlotData in about forty lines: the bytes and
 * the signature that describes them both live on chain, so anything with an RPC
 * can render a write from an application it has never heard of. Nothing here
 * knows what `creative.v1` is.
 *
 * ── A successful decode is NOT proof the schema is right ─────────────────────
 *
 * The tempting mental model is that `abi.decode` throws whenever the schema is
 * wrong, so anything that comes back is trustworthy. It does not, and measured
 * against the seeded payloads it fails in the quiet direction:
 *
 *   schema "string uri"     → "ipfs://bafkrei…"   correct
 *   schema "uint256 wrong"  → 32                  NO THROW, and 32 is the ABI
 *                                                 head — the offset word of the
 *                                                 string it was actually given
 *
 * Dynamic types carry lengths and offsets, so a mismatch usually runs off the
 * end of the buffer and throws. A fixed-size type reads 32 bytes from wherever
 * it lands and returns whatever was there. So `ok: true` means "these bytes are
 * consistent with that signature", never "that signature is correct" — the only
 * thing that can vouch for the pairing is the registrar, and registration is
 * permissionless by design.
 *
 * Which is why the UI keeps the raw hex reachable on every row rather than
 * hiding it once a decode succeeds.
 */

export type DecodedField = {
  /** The parameter's name, or its index when the signature left it unnamed. */
  label: string;
  type: string;
  value: unknown;
};

export type DecodeResult =
  | { ok: true; fields: DecodedField[] }
  | { ok: false; reason: string };

/** Parse a schema, or explain why it cannot be parsed. */
export function parseSchema(schema: string): AbiParameter[] | null {
  try {
    return [...parseAbiParameters(schema)];
  } catch {
    return null;
  }
}

export function decodePayload(schema: string, data: Hex): DecodeResult {
  const params = parseSchema(schema);
  if (!params) {
    return {
      ok: false,
      // Distinguished from a decode failure on purpose. This one is the
      // registrar's mistake and is permanent — the service is unusable for
      // everybody. A decode failure is only this payload's problem.
      reason: "The registered schema is not a readable ABI signature.",
    };
  }

  try {
    const values = decodeAbiParameters(params, data);
    return {
      ok: true,
      fields: params.map((p, i) => ({
        label: p.name || `[${i}]`,
        type: p.type,
        value: values[i],
      })),
    };
  } catch {
    return { ok: false, reason: "These bytes do not match the schema." };
  }
}

/**
 * One decoded value as text.
 *
 * Not `JSON.stringify` alone: a `uint256` arrives as a bigint, which
 * `JSON.stringify` throws on rather than skipping — so the one type most likely
 * to appear in a payload would take the whole row down with it.
 */
export function formatValue(value: unknown): string {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) return value.map(formatValue).join(", ");
  if (value === null || value === undefined) return "";
  return JSON.stringify(value, (_key, v) =>
    typeof v === "bigint" ? v.toString() : v,
  );
}

/**
 * Whether a record is the one the slot's current tenant published.
 *
 * A tenancy ends with a single increment on chain, leaving the previous
 * tenant's rows exactly where they were — so "latest row for this slot" and
 * "live" are different questions, and only this one is the useful one. An
 * absent tenancy means nothing was ever written, which cannot be stale.
 */
export function isLive(record: {
  generation: string;
  tenancyRef?: { generation: string } | null;
}): boolean {
  if (!record.tenancyRef) return true;
  return record.generation === record.tenancyRef.generation;
}
