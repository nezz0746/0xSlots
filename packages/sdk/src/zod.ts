import { z } from "zod";
import {
  type AbiSchema,
  assertSignatureUnchanged,
  type JsonSchema,
  jsonSchemaToAbi,
  type ToAbiSchemaOptions,
} from "./schema/abi-schema";

/**
 * A Zod model, turned into a schema a slot can hold.
 *
 * ── Why this is its own entry point ──────────────────────────────────────────
 *
 * `import { fromZodToSlotDataSchema } from "@0xslots/sdk/zod"`, never from the
 * package root. Zod is an OPTIONAL peer dependency here, and it has to be,
 * because `z.toJSONSchema` landed in Zod 4 and plenty of consumers are still on
 * 3 — this repo's own landing app among them. Importing this from the root
 * would make the whole SDK unusable for them over a function they never call.
 *
 * Everything below is a thin wrapper over `jsonSchemaToAbi`, which takes JSON
 * Schema and is exported from the root with no dependency at all. That split is
 * deliberate: JSON Schema is the interchange format, so the real work stays
 * usable by anyone whose models are written in something other than Zod — which
 * is the same reason the schema lives on chain as a string rather than in a file
 * you have to ask us for.
 */

/**
 * @param schema Any Zod object schema. `z.object({ data, metadata })` is the
 *   usual shape for an ad-style model — see `maxDepth` in `ToAbiSchemaOptions`
 *   for what nesting costs.
 *
 * @example
 * const { signature } = fromZodToSlotDataSchema(
 *   z.object({ data: castAd.data, metadata: castAd.metadata }),
 * );
 * // "(string hash) data,(string displayName,…,string image) metadata"
 */
export function fromZodToSlotDataSchema(
  schema: z.ZodType,
  options: ToAbiSchemaOptions = {},
): AbiSchema {
  return jsonSchemaToAbi(toJson(schema), options);
}

/**
 * The drift guard, for callers holding a Zod model rather than JSON Schema.
 *
 * Pin the signature next to the model and call this in a test. A registered
 * service is permanent and ABI encoding is positional, so swapping two
 * same-typed fields is a source edit that still decodes and silently returns
 * every value in the wrong field. Nothing else catches that.
 */
export function assertZodSignatureUnchanged(
  pinned: string,
  schema: z.ZodType,
  options: ToAbiSchemaOptions = {},
): void {
  assertSignatureUnchanged(pinned, toJson(schema), options);
}

function toJson(schema: z.ZodType) {
  if (typeof z.toJSONSchema !== "function") {
    throw new Error(
      "@0xslots/sdk/zod needs Zod 4 — `z.toJSONSchema` does not exist on 3.x. " +
        "Upgrade zod, or call `jsonSchemaToAbi` from the package root with a " +
        "JSON Schema document you produce yourself.",
    );
  }
  /*
   * `io: "input"` matters and is not the default.
   *
   * Zod distinguishes a schema's input from its output, and they differ wherever
   * a `.default()` or a `.transform()` is involved: on the OUTPUT side a
   * defaulted field is always present, so it reads as required. The values being
   * encoded here are what the application holds before it writes — the input —
   * and taking the output view would quietly mark defaulted fields required and
   * change the signature.
   */
  const json = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" });

  /*
   * Cast, because Zod types a subschema as `object | boolean`.
   *
   * JSON Schema really does allow a bare `true` or `false` in place of a
   * subschema — `true` accepts anything, `false` accepts nothing — and Zod's
   * types are faithful to that. `JsonSchema` here is not, deliberately: a
   * boolean subschema describes no shape, so there is nothing to encode either
   * way, and widening the type would push a `typeof prop === "boolean"` check
   * into every branch that reads a keyword.
   *
   * It degrades correctly rather than crashing. Reading `.type` off a boolean
   * yields `undefined`, which is the same path an untyped schema takes, and the
   * caller gets the "no usable type" refusal naming the field.
   */
  return json as JsonSchema;
}
