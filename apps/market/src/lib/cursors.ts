/**
 * Cursors that say what a thing does.
 *
 * Built here rather than written into CSS so the SVG can be read and encoded
 * once. A hand-escaped data URI in a stylesheet is a class of bug nobody ever
 * finds: a malformed one does not throw, it silently falls back, and the page
 * looks exactly as if you had never written it.
 *
 * Every value ends in a native keyword after the comma, so a browser that
 * refuses the image still gets the affordance. Text and inputs are left
 * entirely alone — a custom cursor over a text field reads as broken software,
 * not as personality.
 */
function cursor(svg: string, x: number, y: number, fallback: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg.trim())}") ${x} ${y}, ${fallback}`;
}

/* Outlined in ink so it survives landing on a pale work as well as on the
   page. An orange-on-orange arrow disappears over exactly the thumbnails this
   cursor exists to point at. */
const ARROW = `
<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26">
  <path d="M4 2.5 L19.5 12 L12.6 13.6 L9.2 20.2 Z"
        fill="#ff6b2c" stroke="#0e1116" stroke-width="1.5" stroke-linejoin="round"/>
</svg>`;

const PLUS = `
<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26">
  <circle cx="13" cy="13" r="10" fill="#ff6b2c" stroke="#0e1116" stroke-width="1.5"/>
  <path d="M13 8.5v9M8.5 13h9" stroke="#0e1116" stroke-width="2" stroke-linecap="round"/>
</svg>`;

export const CURSOR = {
  /** A work, or a band, you can open. Hotspot at the arrow's own tip. */
  take: cursor(ARROW, 4, 2, "pointer"),
  /** A place in the run nobody has taken. Hotspot at the centre of the disc. */
  mint: cursor(PLUS, 13, 13, "pointer"),
  /** Art tiles in the create form. Native — the OS ones are better than any
      hand-drawn hand, and this is the one gesture people already know. */
  grab: "grab",
  grabbing: "grabbing",
} as const;
