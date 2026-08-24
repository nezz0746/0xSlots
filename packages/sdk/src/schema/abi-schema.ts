import { type AbiParameter, parseAbiParameters } from "viem";
import { SlotsError } from "../errors";

/**
 * A model you already have, turned into a schema a slot can hold.
 *
 * The input is JSON Schema, not Zod. Zod 4 emits it with `z.toJSONSchema()`, so
 * a caller with a Zod model is one call away — and taking the interchange format
 * instead of the library means this has no dependency on it, no opinion about
 * which version you are on, and works for anyone whose models are written in
 * something else entirely. Which is the same reason the schema lives on chain
 * as a string: the point is not to make OUR stack easy.
 *
 * ── Depth is a budget ────────────────────────────────────────────────────────
 *
 * `maxDepth` counts how many composites a value sits inside. A top-level field
 * is depth 0; the members of an object at the top are depth 1; the members of an
 * object inside THAT are depth 2. Arrays do not spend from the budget on their
 * own — `string[]` is as flat as `string` — but an array of objects puts those
 * objects' members one level down, the same as a plain object would.
 *
 * The default is 2, which is what `{ data, metadata }` models need once their
 * metadata has any structure of its own.
 *
 * The ABI imposes no limit here; viem will parse tuples nested as deep as you
 * like. The budget is about legibility: a signature is stored as text and read
 * by strangers with no access to your repo, and every level of parentheses
 * costs some of the "anyone can decode this" that putting it on chain bought.
 *
 * ── What this deliberately refuses ───────────────────────────────────────────
 *
 * Every refusal below is a case where a plausible mapping exists and is WRONG in
 * a way that would not surface until someone read a decoded value and believed
 * it. The registry is permissionless and a service cannot be edited or removed,
 * so a bad mapping is permanent — better to fail here than to be discovered by
 * whoever decodes it in a year.
 */

export type AbiSchemaField = {
  /** Property name, which becomes the ABI parameter name. */
  name: string;
  /** The ABI type, e.g. `string`, `uint256`, `string[]`, or `tuple`. */
  type: string;
  /** True when the source model did not require it. See `fillOptionals`. */
  optional: boolean;
  /** Present for objects and arrays of objects. */
  components?: AbiSchemaField[];
};

export type AbiSchema = {
  /** The string to register on chain, e.g. `"string text,string[] medias"`. */
  signature: string;
  /** The same thing parsed, for encoding and decoding. */
  params: AbiParameter[];
  fields: AbiSchemaField[];
  /**
   * Field paths whose absence is encoded as a zero value and cannot be told
   * apart from a genuine empty string on the way back. Never empty silently —
   * read it, and if a path here matters, make it required in the model.
   */
  lossyOptionals: string[];
};

/**
 * The subset of JSON Schema this reads, plus room for the rest.
 *
 * The index signature is not laziness. `z.toJSONSchema()` emits `$schema`,
 * `additionalProperties`, `minLength`, `format`, `description` and more
 * depending on the model, and a closed type would reject a perfectly valid
 * document for carrying a keyword this happens not to consult. Declaring the
 * keywords that are actually read and accepting the others keeps the checking
 * where it is useful.
 */
export type JsonSchema = {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: unknown[];
  anyOf?: JsonSchema[];
  minimum?: number;
  exclusiveMinimum?: number;
  const?: unknown;
  [keyword: string]: unknown;
};

export type ToAbiSchemaOptions = {
  /**
   * How many composites deep a value may sit. Default 2. See the note above on
   * what counts — arrays are free, objects are not.
   */
  maxDepth?: number;
  /**
   * Force an ABI type for a field, by path (`"address"`, `"metadata.author"`).
   *
   * The escape hatch for everything JSON Schema cannot say. An Ethereum address
   * is a `string` with a regex to Zod and to JSON Schema, and guessing `address`
   * from a pattern would be right until the day someone's regex differed by a
   * character — so it is stated instead of inferred.
   */
  overrides?: Record<string, string>;
};

/** Scalars that have an unambiguous "absent" encoding: their zero value is not
 *  a meaningful member of the domain, or is close enough to it to be safe. */
const ZERO_IS_ABSENT = new Set(["string", "bytes"]);

export function jsonSchemaToAbi(
  schema: JsonSchema,
  options: ToAbiSchemaOptions = {},
): AbiSchema {
  if (schema.type !== "object" || !schema.properties) {
    throw new SlotsError(
      "schema",
      "The top level must be an object — a service describes a set of named fields.",
    );
  }

  const maxDepth = options.maxDepth ?? 2;
  const lossyOptionals: string[] = [];
  const required = new Set(schema.required ?? []);

  const fields = Object.entries(schema.properties).map(([name, prop]) =>
    convert(name, prop, {
      path: name,
      optional: !required.has(name),
      depth: 0,
      maxDepth,
      options,
      lossyOptionals,
    }),
  );

  const signature = fields.map(render).join(",");

  // Parsed rather than trusted. This function builds the string, so a bug here
  // would otherwise ship a signature that registers fine and decodes nothing —
  // and registration is permanent.
  let params: AbiParameter[];
  try {
    params = [...parseAbiParameters(signature)];
  } catch {
    throw new SlotsError(
      "schema",
      `Produced an unparseable signature: "${signature}". This is a bug in jsonSchemaToAbi.`,
    );
  }

  return { signature, params, fields, lossyOptionals };
}

type Ctx = {
  path: string;
  optional: boolean;
  /** How many composites this value already sits inside. */
  depth: number;
  maxDepth: number;
  options: ToAbiSchemaOptions;
  lossyOptionals: string[];
};

function convert(name: string, rawProp: JsonSchema, ctx: Ctx): AbiSchemaField {
  /*
   * `null` is absence spelled differently, so it is folded into optional.
   *
   * Zod emits `.nullable()` as `anyOf: [T, null]`, which is a union — and this
   * refuses unions, because the ABI has no way to say "one of these". But a
   * union with `null` is the one union that is not really a choice of types: it
   * is T, plus the absence of T, which is exactly what optional already means
   * here. Both end up as the zero value, so treating them the same is honest
   * rather than convenient. A union of two REAL types still throws below.
   */
  const nullable =
    rawProp.anyOf?.length === 2 && rawProp.anyOf.some((b) => b.type === "null");
  const prop = nullable
    ? (rawProp.anyOf?.find((b) => b.type !== "null") as JsonSchema)
    : rawProp;
  if (nullable) ctx = { ...ctx, optional: true };

  const override = ctx.options.overrides?.[ctx.path];
  if (override) {
    noteOptional(override, ctx);
    return { name, type: override, optional: ctx.optional };
  }

  const type = Array.isArray(prop.type) ? prop.type[0] : prop.type;

  if (type === "object") {
    if (ctx.depth + 1 > ctx.maxDepth) {
      throw new SlotsError(
        "schema",
        `"${ctx.path}" would put its fields ${ctx.depth + 1} levels deep, past the limit of ${ctx.maxDepth}. Flatten it, raise \`maxDepth\`, or give the inner shape its own service.`,
      );
    }
    if (!prop.properties) {
      throw new SlotsError(
        "schema",
        `"${ctx.path}" is an object with no properties. An empty tuple encodes nothing.`,
      );
    }
    const innerRequired = new Set(prop.required ?? []);
    const components = Object.entries(prop.properties).map(([n, p]) =>
      convert(n, p, {
        ...ctx,
        path: `${ctx.path}.${n}`,
        optional: !innerRequired.has(n),
        depth: ctx.depth + 1,
      }),
    );
    // A tuple's own absence cannot be encoded — there is no null tuple — so an
    // optional object is silently always present, with its fields at their zero
    // values. Said out loud rather than left to be discovered.
    if (ctx.optional) ctx.lossyOptionals.push(ctx.path);
    return { name, type: "tuple", optional: ctx.optional, components };
  }

  if (type === "array") {
    if (!prop.items) {
      throw new SlotsError(
        "schema",
        `"${ctx.path}" is an array with no declared item type.`,
      );
    }
    // The item is converted at the ARRAY'S OWN depth, not one below it. An
    // array is a repetition of a shape rather than a shape of its own, so
    // `string[]` is exactly as flat as `string`; only the objects inside one
    // spend from the budget, and they spend it themselves.
    const item = convert(name, prop.items, {
      ...ctx,
      path: `${ctx.path}[]`,
      optional: false,
    });
    // An empty array is a natural "absent", so this one is not lossy.
    return {
      name,
      type: `${item.type}[]`,
      optional: ctx.optional,
      ...(item.components ? { components: item.components } : {}),
    };
  }

  const scalar = scalarType(prop, type, ctx);
  noteOptional(scalar, ctx);
  return { name, type: scalar, optional: ctx.optional };
}

function scalarType(
  prop: JsonSchema,
  type: string | undefined,
  ctx: Ctx,
): string {
  if (type === "string") return "string";
  if (type === "boolean") return "bool";

  if (type === "integer") {
    // `.positive()` and `.nonnegative()` reach JSON Schema as a lower bound, and
    // a lower bound at or above zero is the only evidence available that a field
    // is unsigned. Absent one, signed — an int256 holds every uint255 value, so
    // guessing signed costs a bit of range, while guessing unsigned turns a
    // negative into an astronomically large positive.
    const min = prop.minimum ?? prop.exclusiveMinimum;
    return typeof min === "number" && min >= 0 ? "uint256" : "int256";
  }

  if (type === "number") {
    throw new SlotsError(
      "schema",
      `"${ctx.path}" is a number, which in JavaScript is a double and has no ABI equivalent. Mark it as an integer (Zod: \`.int()\`) if it is one, or carry it as a string.`,
    );
  }

  if (prop.enum) {
    // Only string enums, and they stay strings rather than becoming an index.
    // An index is smaller and is the obvious encoding, and it is also how a
    // service breaks forever the first time someone inserts a variant in the
    // middle: every payload written before the edit silently means something
    // else. The string costs bytes and cannot do that.
    if (prop.enum.every((v) => typeof v === "string")) return "string";
    throw new SlotsError(
      "schema",
      `"${ctx.path}" is an enum of non-strings, which has no stable encoding.`,
    );
  }

  if (type === "null" || type === undefined) {
    throw new SlotsError(
      "schema",
      `"${ctx.path}" has no usable type. Unions, \`null\`, \`any\` and \`unknown\` cannot be encoded — the ABI has no way to say "one of these".`,
    );
  }

  throw new SlotsError(
    "schema",
    `"${ctx.path}" has unsupported type "${type}".`,
  );
}

function noteOptional(type: string, ctx: Ctx) {
  if (!ctx.optional) return;
  const base = type.replace(/\[\]$/, "");
  if (ZERO_IS_ABSENT.has(base) || type.endsWith("[]")) {
    ctx.lossyOptionals.push(ctx.path);
    return;
  }
  // The refusal that matters most. `decimals: z.number().optional()` encoded as
  // uint256 makes absent indistinguishable from 0 — and 0 decimals is a real
  // token. Same for a bool, where absent and false collapse.
  throw new SlotsError(
    "schema",
    `"${ctx.path}" is an optional ${type}, and zero is a legitimate value for it — encoded, absent and zero become the same payload. Give it a default, or make it required.`,
  );
}

function render(field: AbiSchemaField): string {
  if (field.components) {
    const inner = field.components.map(render).join(",");
    // `tuple` and `tuple[]` differ only in the suffix, which viem wants OUTSIDE
    // the parentheses: `(string a)[] xs`, never `(string a)[] `-less or
    // `tuple[] xs`.
    const suffix = field.type.endsWith("[]") ? "[]" : "";
    return `(${inner})${suffix} ${field.name}`;
  }
  return `${field.type} ${field.name}`;
}

/**
 * Replace every absent optional with its zero value, ready to encode.
 *
 * Needed because `encodeAbiParameters` throws on `undefined` rather than
 * treating it as empty — correctly, since the ABI has no absent and guessing
 * would be the encoder inventing data.
 */
export function fillOptionals(
  schema: AbiSchema,
  value: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of schema.fields) {
    out[field.name] = fillField(field, value?.[field.name]);
  }
  return out;
}

function fillField(field: AbiSchemaField, value: unknown): unknown {
  if (field.components && field.type.endsWith("[]")) {
    // Each element is filled on its own — an element's optional members are as
    // absent-able as a top-level field's, and an unfilled one would throw at
    // encode time rather than here.
    return ((value ?? []) as unknown[]).map((el) =>
      fillField({ ...field, type: "tuple" }, el),
    );
  }
  if (field.components) {
    const inner = (value ?? {}) as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const c of field.components) out[c.name] = fillField(c, inner[c.name]);
    return out;
  }
  if (value !== undefined && value !== null) return value;
  return zeroValue(field.type);
}

function zeroValue(type: string): unknown {
  if (type.endsWith("[]")) return [];
  if (type === "string") return "";
  if (type === "bool") return false;
  if (type === "address") return "0x0000000000000000000000000000000000000000";
  if (type.startsWith("bytes")) return "0x";
  return 0n;
}

/**
 * The inverse: zero values back to `undefined`, for the fields that were
 * declared optional.
 *
 * This is where the round trip is lossy, and only here. A field that was
 * genuinely written as `""` comes back as `undefined`, because the encoding
 * gave the two the same bytes. Only ever applied to fields the model itself
 * marked optional, so a required string that is empty survives as `""`.
 */
export function stripOptionals(
  schema: AbiSchema,
  decoded: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of schema.fields) {
    out[field.name] = stripField(field, decoded?.[field.name]);
  }
  return out;
}

function stripField(field: AbiSchemaField, value: unknown): unknown {
  if (field.components && field.type.endsWith("[]")) {
    // The ELEMENTS are never optional — only the array is. An element that came
    // back is an element that was written, so it is stripped on its own terms
    // and the array's optionality is decided once, below.
    const els = ((value ?? []) as unknown[]).map((el) =>
      stripField({ ...field, type: "tuple", optional: false }, el),
    );
    return field.optional && els.length === 0 ? undefined : els;
  }
  if (field.components) {
    const inner = (value ?? {}) as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const c of field.components)
      out[c.name] = stripField(c, inner[c.name]);
    return out;
  }
  if (!field.optional) return value;
  if (value === "" || (Array.isArray(value) && value.length === 0)) {
    return undefined;
  }
  return value;
}

/**
 * Fail when a model has drifted from the signature already registered for it.
 *
 * The one guard this whole file needs, and the reason it is worth building at
 * all rather than deriving a signature at the call site each time.
 *
 * A service cannot be edited or removed once registered. A Zod model in a repo
 * changes constantly — and ABI encoding is POSITIONAL while an object is keyed,
 * so reordering two fields of the same type is a source edit that no reviewer
 * would question and that silently repoints every payload ever written. Worse,
 * swapping two strings produces bytes that still decode, so nothing throws;
 * `displayName` simply starts coming back as `username`.
 *
 * So the derived signature is pinned as a constant next to the model, and this
 * runs in the test suite. Adding a field to the END is the only safe edit, and
 * even that needs a NEW service — the old payloads have no room for it.
 *
 * @param pinned The signature actually registered on chain.
 */
export function assertSignatureUnchanged(
  pinned: string,
  schema: JsonSchema,
  options: ToAbiSchemaOptions = {},
): void {
  const { signature } = jsonSchemaToAbi(schema, options);
  if (signature === pinned) return;
  throw new SlotsError(
    "schema",
    `The model no longer matches its registered service.\n` +
      `  registered: ${pinned}\n` +
      `  derived:    ${signature}\n` +
      `A registered service is permanent, so the model must change back — or ` +
      `this needs a new service and a new id. Reordering fields is the ` +
      `dangerous case: same types in a different order still decode, so the ` +
      `values come back in the wrong fields with nothing thrown.`,
  );
}
