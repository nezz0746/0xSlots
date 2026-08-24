import { decodeAbiParameters, encodeAbiParameters } from "viem";
import { describe, expect, it } from "vitest";
import {
  assertSignatureUnchanged,
  fillOptionals,
  type JsonSchema,
  jsonSchemaToAbi,
  stripOptionals,
} from "./abi-schema";

/** What `z.toJSONSchema()` emits for adland's cast ad — copied from its output
 *  rather than paraphrased, so this test fails if that shape ever changes. */
const CAST: JsonSchema = {
  type: "object",
  properties: {
    data: {
      type: "object",
      properties: { hash: { type: "string", minLength: 1 } },
      required: ["hash"],
    },
    metadata: {
      type: "object",
      properties: {
        displayName: { type: "string" },
        username: { type: "string" },
        pfpUrl: { type: "string" },
        text: { type: "string" },
        timestamp: { type: "string" },
        image: { type: "string" },
      },
      required: ["text", "timestamp"],
    },
  },
  required: ["data", "metadata"],
};

describe("jsonSchemaToAbi", () => {
  it("turns a real ad model into one registrable line", () => {
    const { signature } = jsonSchemaToAbi(CAST);
    expect(signature).toBe(
      "(string hash) data," +
        "(string displayName,string username,string pfpUrl," +
        "string text,string timestamp,string image) metadata",
    );
  });

  // MAX_SCHEMA on the contract. A model that does not fit cannot be registered
  // at all, and the failure would land at the wallet rather than here.
  it("fits the contract's 512-byte schema limit", () => {
    const { signature } = jsonSchemaToAbi(CAST);
    expect(Buffer.byteLength(signature, "utf8")).toBeLessThanOrEqual(512);
  });

  it("names every optional whose absence it had to fake", () => {
    const { lossyOptionals } = jsonSchemaToAbi(CAST);
    expect(lossyOptionals).toEqual([
      "metadata.displayName",
      "metadata.username",
      "metadata.pfpUrl",
      "metadata.image",
    ]);
  });

  it("reads a lower bound at zero as unsigned, and nothing as signed", () => {
    const { signature } = jsonSchemaToAbi({
      type: "object",
      properties: {
        chainId: { type: "integer", exclusiveMinimum: 0 },
        delta: { type: "integer" },
      },
      required: ["chainId", "delta"],
    });
    expect(signature).toBe("uint256 chainId,int256 delta");
  });

  it("takes an explicit type where JSON Schema cannot express one", () => {
    const { signature } = jsonSchemaToAbi(
      {
        type: "object",
        properties: { token: { type: "string" } },
        required: ["token"],
      },
      { overrides: { token: "address" } },
    );
    expect(signature).toBe("address token");
  });

  it("keeps a string enum as a string rather than an index", () => {
    const { signature } = jsonSchemaToAbi({
      type: "object",
      properties: { kind: { type: "string", enum: ["cast", "link"] } },
      required: ["kind"],
    });
    expect(signature).toBe("string kind");
  });
});

/**
 * The refusals.
 *
 * Each of these has an obvious mapping that is wrong in a way nobody would
 * notice until they read a decoded value and believed it. A registered service
 * cannot be edited or removed, so the only place to catch them is here.
 */
describe("what it refuses", () => {
  const reject =
    (props: JsonSchema["properties"], required: string[] = []) =>
    () =>
      jsonSchemaToAbi({ type: "object", properties: props, required });

  it("refuses a float, which has no ABI type", () => {
    expect(reject({ ratio: { type: "number" } }, ["ratio"])).toThrow(/double/);
  });

  it("refuses an optional integer, because zero is a real value", () => {
    // The exact case in adland's token ad: `decimals: z.number().optional()`.
    // Encoded as uint256, a token with 0 decimals and a token whose decimals
    // were never fetched produce identical bytes.
    expect(reject({ decimals: { type: "integer" } })).toThrow(
      /absent and zero become the same/,
    );
  });

  it("refuses an optional bool for the same reason", () => {
    expect(reject({ pinned: { type: "boolean" } })).toThrow(
      /absent and zero become the same/,
    );
  });

  it("refuses a third level, past the default budget of two", () => {
    expect(
      reject(
        {
          a: {
            type: "object",
            required: ["b"],
            properties: {
              b: {
                type: "object",
                required: ["c"],
                properties: {
                  c: { type: "object", properties: { d: { type: "string" } } },
                },
              },
            },
          },
        },
        ["a"],
      ),
    ).toThrow(/3 levels deep, past the limit of 2/);
  });

  it("refuses a union, which the ABI cannot say", () => {
    expect(reject({ either: {} }, ["either"])).toThrow(/one of these/);
  });
});

describe("round trip", () => {
  it("survives encode and decode with the optionals present", () => {
    const schema = jsonSchemaToAbi(CAST);
    const value = {
      data: { hash: "0xabc" },
      metadata: {
        displayName: "Nezz",
        username: "nezzar",
        pfpUrl: "https://example.test/a.png",
        text: "hello",
        timestamp: "1700000000000",
        image: "https://example.test/b.png",
      },
    };

    const bytes = encodeAbiParameters(
      schema.params,
      Object.values(fillOptionals(schema, value)) as never[],
    );
    const decoded = decodeAbiParameters(schema.params, bytes);
    const back = stripOptionals(schema, {
      data: decoded[0],
      metadata: decoded[1],
    } as Record<string, unknown>);

    expect(back).toEqual(value);
  });

  it("brings an absent optional back as absent", () => {
    const schema = jsonSchemaToAbi(CAST);
    const value = {
      data: { hash: "0xabc" },
      metadata: { text: "hello", timestamp: "1700000000000" },
    };

    const bytes = encodeAbiParameters(
      schema.params,
      Object.values(fillOptionals(schema, value)) as never[],
    );
    const decoded = decodeAbiParameters(schema.params, bytes);
    const back = stripOptionals(schema, {
      data: decoded[0],
      metadata: decoded[1],
    } as Record<string, unknown>) as typeof value;

    expect(back.metadata).toEqual({
      displayName: undefined,
      username: undefined,
      pfpUrl: undefined,
      text: "hello",
      timestamp: "1700000000000",
      image: undefined,
    });
  });

  /**
   * The one thing the round trip does NOT preserve, proven rather than
   * described. An optional field written as an empty string comes back
   * undefined, because the encoding gives the two the same bytes — which is
   * why `lossyOptionals` exists and why it names paths instead of counting.
   */
  it("cannot tell an empty optional string from an absent one", () => {
    const schema = jsonSchemaToAbi(CAST);
    const value = {
      data: { hash: "0xabc" },
      metadata: {
        displayName: "",
        text: "hello",
        timestamp: "1700000000000",
      },
    };

    const bytes = encodeAbiParameters(
      schema.params,
      Object.values(fillOptionals(schema, value)) as never[],
    );
    const decoded = decodeAbiParameters(schema.params, bytes);
    const back = stripOptionals(schema, {
      data: decoded[0],
      metadata: decoded[1],
    } as Record<string, unknown>) as typeof value;

    expect(back.metadata.displayName).toBeUndefined();
    expect(schema.lossyOptionals).toContain("metadata.displayName");
  });

  // A required empty string is NOT optional, so it must survive untouched.
  it("keeps a required empty string as an empty string", () => {
    const schema = jsonSchemaToAbi(CAST);
    const back = stripOptionals(schema, {
      data: { hash: "" },
      metadata: { text: "", timestamp: "0" },
    }) as { data: { hash: string } };
    expect(back.data.hash).toBe("");
  });
});

describe("nullable", () => {
  it("folds a nullable into an optional rather than refusing the union", () => {
    const { signature, lossyOptionals } = jsonSchemaToAbi({
      type: "object",
      properties: {
        username: { anyOf: [{ type: "string" }, { type: "null" }] },
      },
      required: ["username"],
    });
    expect(signature).toBe("string username");
    // Required in the model, but nullable — so absence is still representable
    // and still collapses to "".
    expect(lossyOptionals).toContain("username");
  });

  it("still refuses a union of two real types", () => {
    expect(() =>
      jsonSchemaToAbi({
        type: "object",
        properties: {
          either: { anyOf: [{ type: "string" }, { type: "integer" }] },
        },
        required: ["either"],
      }),
    ).toThrow(/one of these/);
  });

  it("refuses a nullable integer, since absent and zero still collide", () => {
    expect(() =>
      jsonSchemaToAbi({
        type: "object",
        properties: { fid: { anyOf: [{ type: "integer" }, { type: "null" }] } },
        required: ["fid"],
      }),
    ).toThrow(/absent and zero become the same/);
  });
});

describe("assertSignatureUnchanged", () => {
  const PINNED =
    "(string hash) data,(string displayName,string username,string pfpUrl," +
    "string text,string timestamp,string image) metadata";

  it("passes while the model still matches what was registered", () => {
    expect(() => assertSignatureUnchanged(PINNED, CAST)).not.toThrow();
  });

  /**
   * The failure this exists for. Swapping two strings is a source edit nobody
   * would flag, produces bytes that still decode, and silently returns every
   * display name as a username. Only a pinned comparison catches it.
   */
  it("catches a reorder of two same-typed fields", () => {
    const reordered = structuredClone(CAST);
    const m = reordered.properties?.metadata;
    if (!m?.properties) throw new Error("fixture");
    m.properties = {
      username: m.properties.username,
      displayName: m.properties.displayName,
      pfpUrl: m.properties.pfpUrl,
      text: m.properties.text,
      timestamp: m.properties.timestamp,
      image: m.properties.image,
    };
    expect(() => assertSignatureUnchanged(PINNED, reordered)).toThrow(
      /no longer matches/,
    );
  });

  it("catches an added field", () => {
    const grown = structuredClone(CAST);
    const props = grown.properties?.metadata?.properties;
    if (!props) throw new Error("fixture");
    props.channel = { type: "string" };
    expect(() => assertSignatureUnchanged(PINNED, grown)).toThrow(
      /no longer matches/,
    );
  });
});

/**
 * Two levels, which is what a `{ data, metadata }` model needs the moment its
 * metadata has any structure of its own — adland's miniapp ad carries a
 * `creator` object inside its metadata and could not be expressed at one.
 */
describe("depth", () => {
  const MINIAPP: JsonSchema = {
    type: "object",
    required: ["data", "metadata"],
    properties: {
      data: {
        type: "object",
        required: ["url"],
        properties: { url: { type: "string" } },
      },
      metadata: {
        type: "object",
        required: ["title"],
        properties: {
          title: { type: "string" },
          creator: {
            type: "object",
            required: ["fid"],
            properties: {
              fid: { type: "integer", minimum: 0 },
              username: { type: "string" },
            },
          },
        },
      },
    },
  };

  it("accepts an object inside an object", () => {
    const { signature } = jsonSchemaToAbi(MINIAPP);
    expect(signature).toBe(
      "(string url) data,(string title,(uint256 fid,string username) creator) metadata",
    );
  });

  it("can be tightened back to one level", () => {
    expect(() => jsonSchemaToAbi(MINIAPP, { maxDepth: 1 })).toThrow(
      /2 levels deep, past the limit of 1/,
    );
  });

  // An array repeats a shape rather than being one, so it costs nothing on its
  // own — `string[]` is as flat as `string`, and this stays inside a budget of 1.
  it("does not charge the budget for an array of scalars", () => {
    const { signature } = jsonSchemaToAbi(
      {
        type: "object",
        required: ["medias"],
        properties: { medias: { type: "array", items: { type: "string" } } },
      },
      { maxDepth: 1 },
    );
    expect(signature).toBe("string[] medias");
  });

  it("charges only for the objects inside an array", () => {
    const schema = jsonSchemaToAbi({
      type: "object",
      required: ["medias"],
      properties: {
        medias: {
          type: "array",
          items: {
            type: "object",
            required: ["url", "mime"],
            properties: { url: { type: "string" }, mime: { type: "string" } },
          },
        },
      },
    });
    expect(schema.signature).toBe("(string url,string mime)[] medias");
  });

  it("round-trips an array of objects", () => {
    const schema = jsonSchemaToAbi({
      type: "object",
      required: ["medias"],
      properties: {
        medias: {
          type: "array",
          items: {
            type: "object",
            required: ["url"],
            properties: { url: { type: "string" }, alt: { type: "string" } },
          },
        },
      },
    });
    const value = {
      medias: [{ url: "ipfs://a" }, { url: "ipfs://b", alt: "b" }],
    };
    const bytes = encodeAbiParameters(
      schema.params,
      Object.values(fillOptionals(schema, value)) as never[],
    );
    const decoded = decodeAbiParameters(schema.params, bytes);
    expect(stripOptionals(schema, { medias: decoded[0] })).toEqual({
      medias: [
        { url: "ipfs://a", alt: undefined },
        { url: "ipfs://b", alt: "b" },
      ],
    });
  });
});
