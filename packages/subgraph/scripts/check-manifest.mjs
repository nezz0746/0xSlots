#!/usr/bin/env node
/**
 * Fail if `subgraph.yaml` still contains an unsubstituted mustache placeholder.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * A YAML formatter rewrote `network: {{network}}` in the template to
 * `network: { { network } }` — it read the double braces as a nested flow
 * mapping and helpfully spaced it out. Mustache only matches `{{name}}`, so
 * every one of those placeholders passed through verbatim.
 *
 * Nothing caught it. `graph codegen` and `graph build` both succeeded, the
 * whole subgraph was uploaded to IPFS, and it failed only at the Studio API
 * with `Specified network is not supported` — which does not mention the
 * manifest, the template, or the placeholder that was actually the problem.
 *
 * The `address: "{{factoryAddress}}"` placeholders survived the same formatter
 * because they were quoted, which is why `network` is quoted in the template
 * now. `startBlock` cannot be: the manifest schema wants a number there. So
 * this check is the backstop for that one, and for whatever the next formatter
 * decides to improve.
 */
import { readFileSync } from "node:fs";

const FILE = "subgraph.yaml";
const source = readFileSync(FILE, "utf8");

// Both the intact form and the spaced-out form a formatter may leave behind.
const LEFTOVER = /\{\s*\{[^}]*\}\s*\}/g;

const offenders = source
  .split("\n")
  .map((line, i) => ({ line, number: i + 1 }))
  .filter(({ line }) => LEFTOVER.test(line));

if (offenders.length > 0) {
  console.error(
    `\n✖ ${FILE} has ${offenders.length} unsubstituted placeholder(s):\n`,
  );
  for (const { line, number } of offenders) {
    console.error(`  ${String(number).padStart(4)} | ${line.trim()}`);
  }
  console.error(
    "\nmustache matches {{name}} exactly. If a placeholder reads { { name } },\n" +
      "a YAML formatter has reflowed subgraph.template.yaml — restore the braces\n" +
      "there, do not edit subgraph.yaml (it is generated).\n",
  );
  process.exit(1);
}

console.log(`✔ ${FILE}: all placeholders substituted`);
