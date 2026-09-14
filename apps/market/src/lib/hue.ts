/**
 * A collection's own colour.
 *
 * Chrome only — rails, figures, badges, hover. Never behind or around a work:
 * six saturated hues competing with the art is the exact failure the generated
 * plates were deleted for, and putting them back as a tint behind the pictures
 * would be the same mistake with a smaller radius.
 *
 * Taken from the address rather than a stored field, so a collection is the
 * same colour on every device and in every session with nothing to migrate.
 * That determinism is the one property worth keeping from `Plate`.
 */
export type Hue = {
  name: string;
  /** Text-safe on white — 4.5:1 or better. Use for figures and labels. */
  ink: string;
  /** A ground, for a band or a callout. */
  wash: string;
  /** Fills and rules only. Never text. */
  rule: string;
};

const HUES: Hue[] = [
  { name: "orange", ink: "#c2410c", wash: "#fff4ee", rule: "#ff6b2c" },
  { name: "violet", ink: "#6d28d9", wash: "#f6f2ff", rule: "#7c3aed" },
  { name: "sky", ink: "#0e7490", wash: "#effafd", rule: "#0891b2" },
  { name: "lime", ink: "#4d7c0f", wash: "#f4fbe8", rule: "#65a30d" },
  { name: "madder", ink: "#be123c", wash: "#fff1f4", rule: "#e11d48" },
  { name: "teal", ink: "#0f766e", wash: "#effcfa", rule: "#0d9488" },
];

/**
 * The hue for an address.
 *
 * The first byte rather than a hash: addresses are already uniformly
 * distributed, so anything more elaborate buys nothing and costs a dependency.
 */
export function hueFor(address: string): Hue {
  const byte = Number.parseInt(address.slice(2, 4), 16);
  const index = (Number.isNaN(byte) ? 0 : byte) % HUES.length;
  // Non-null: `index` is a modulo of the array's own length.
  return HUES[index] as Hue;
}
