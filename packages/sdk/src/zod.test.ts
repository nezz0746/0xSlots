import { describe, expect, it } from "vitest";
import { z } from "zod";
import { assertZodSignatureUnchanged, fromZodToSlotDataSchema } from "./zod";

/** adland's cast ad, reproduced from its source. */
const castData = z.object({ hash: z.string().nonempty() });
const castMetadata = z.object({
  displayName: z.string().optional(),
  username: z.string().optional(),
  pfpUrl: z.string().optional(),
  text: z.string(),
  timestamp: z.string(),
  image: z.string().optional(),
});

const CAST_SIGNATURE =
  "(string hash) data,(string displayName,string username,string pfpUrl," +
  "string text,string timestamp,string image) metadata";

describe("fromZodToSlotDataSchema", () => {
  it("turns a real ad model into one registrable line", () => {
    const { signature } = fromZodToSlotDataSchema(
      z.object({ data: castData, metadata: castMetadata }),
    );
    expect(signature).toBe(CAST_SIGNATURE);
  });

  it("names the optionals whose absence it had to fake", () => {
    const { lossyOptionals } = fromZodToSlotDataSchema(
      z.object({ data: castData, metadata: castMetadata }),
    );
    expect(lossyOptionals).toEqual([
      "metadata.displayName",
      "metadata.username",
      "metadata.pfpUrl",
      "metadata.image",
    ]);
  });

  it("takes an object inside an object at the default depth", () => {
    const { signature } = fromZodToSlotDataSchema(
      z.object({
        metadata: z.object({
          title: z.string(),
          creator: z.object({
            fid: z.number().int().nonnegative(),
            username: z.string().nullable().optional(),
          }),
        }),
      }),
    );
    expect(signature).toBe(
      "(string title,(uint256 fid,string username) creator) metadata",
    );
  });

  it("handles an array of objects", () => {
    const { signature } = fromZodToSlotDataSchema(
      z.object({
        medias: z.array(z.object({ url: z.string(), mime: z.string() })),
      }),
    );
    expect(signature).toBe("(string url,string mime)[] medias");
  });

  /**
   * Zod's input and output views differ wherever a `.default()` is involved:
   * on the output side the field is always present and reads as required. The
   * values being encoded are what the app holds BEFORE writing, so the input
   * view is the correct one — and a defaulted field stays optional here.
   */
  it("reads the input view, so a default does not become required", () => {
    const { signature, lossyOptionals } = fromZodToSlotDataSchema(
      z.object({ tag: z.string().default("none") }),
    );
    expect(signature).toBe("string tag");
    expect(lossyOptionals).toContain("tag");
  });

  it("still refuses a float, through the wrapper", () => {
    expect(() =>
      fromZodToSlotDataSchema(z.object({ ratio: z.number() })),
    ).toThrow(/double/);
  });

  it("still refuses an optional integer, through the wrapper", () => {
    expect(() =>
      fromZodToSlotDataSchema(
        z.object({ decimals: z.number().int().optional() }),
      ),
    ).toThrow(/absent and zero become the same/);
  });
});

describe("assertZodSignatureUnchanged", () => {
  const model = z.object({ data: castData, metadata: castMetadata });

  it("passes while the model matches what was registered", () => {
    expect(() =>
      assertZodSignatureUnchanged(CAST_SIGNATURE, model),
    ).not.toThrow();
  });

  // The failure it exists for: same types, different order. Still decodes,
  // returns every displayName as a username, throws nothing.
  it("catches a reorder of two same-typed fields", () => {
    const reordered = z.object({
      data: castData,
      metadata: z.object({
        username: z.string().optional(),
        displayName: z.string().optional(),
        pfpUrl: z.string().optional(),
        text: z.string(),
        timestamp: z.string(),
        image: z.string().optional(),
      }),
    });
    expect(() =>
      assertZodSignatureUnchanged(CAST_SIGNATURE, reordered),
    ).toThrow(/no longer matches/);
  });
});

/**
 * Types Zod can hold but the ABI cannot, refused by name rather than by
 * producing something that encodes and means nothing.
 */
describe("unrepresentable types", () => {
  it.each([
    ["any", z.any()],
    ["unknown", z.unknown()],
    ["a union of two real types", z.union([z.string(), z.number().int()])],
    ["a record with dynamic keys", z.record(z.string(), z.string())],
  ])("refuses %s", (_label, field) => {
    expect(() => fromZodToSlotDataSchema(z.object({ x: field }))).toThrow();
  });

  it("names the field it could not encode", () => {
    expect(() =>
      fromZodToSlotDataSchema(z.object({ payload: z.any() })),
    ).toThrow(/"payload"/);
  });
});
