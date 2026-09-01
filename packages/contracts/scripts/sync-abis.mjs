#!/usr/bin/env node
/**
 * Regenerate the Slots ABIs from the forge build output.
 *
 *   node scripts/sync-abis.mjs           # write
 *   node scripts/sync-abis.mjs --check   # exit 1 if anything is stale
 *
 * These files used to be produced by hand, one ad-hoc script at a time, and
 * they drifted silently: `version()` was added to five contracts and reached
 * none of the ABIs, so the explorer read "unreadable" for every version and a
 * testnet deploy shipped on top of it. Nothing compared the committed ABI to
 * the compiled one, so there was no moment at which that could have surfaced.
 * `--check` is that moment.
 *
 * Only `src/abis/slots/*` is generated. The flat `src/abis/*.ts` files belong
 * to the retired protocol and are hand-maintained; this script must not touch
 * them.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, "..");
const REPO = join(PKG, "..", "..");
const OUT = join(REPO, "apps/contracts/out");

/**
 * Keyed on the EXACT source path, never a contract name or a path prefix.
 * `src/v1/` holds same-named `Slot`, `SlotFactory` and `OfferBook` contracts,
 * so a name lookup would resolve to whichever artifact the glob happened to
 * reach first — and the retired protocol's ABI against the live schema is a
 * filter that silently matches nothing.
 */
const CONTRACTS = [
  { source: "src/Slot.sol",                              name: "Slot",                     out: "slot" },
  { source: "src/SlotFactory.sol",                       name: "SlotFactory",              out: "slotFactory" },
  { source: "src/hooks/CompositeHook.sol",               name: "CompositeHook",            out: "compositeHook" },
  { source: "src/hooks/MinimumTenureHook.sol",           name: "MinimumTenureHook",        out: "minimumTenureHook" },
  { source: "src/hooks/MinimumTenureHookFactory.sol",    name: "MinimumTenureHookFactory", out: "minimumTenureHookFactory" },
  { source: "src/periphery/book/OfferBook.sol",          name: "OfferBook",                out: "offerBook" },
  { source: "src/periphery/SlotTaker.sol",               name: "SlotTaker",                out: "slotTaker" },
  { source: "src/collectives/SlotCollective.sol",        name: "SlotCollective",           out: "slotCollective" },
  { source: "src/collectives/SlotCollectiveFactory.sol", name: "SlotCollectiveFactory",    out: "slotCollectiveFactory" },
];

/**
 * The indexer keeps its own copies so it does not depend on the built package.
 * They are copies, so they drift — both collective ABIs were an entry behind
 * when this script was written. Mirrored here rather than trusted.
 */
const PONDER_MIRRORS = [
  { out: "slot",                  file: "Slot",                  export: "SlotAbi" },
  { out: "slotFactory",           file: "SlotFactory",           export: "SlotFactoryAbi" },
  { out: "slotCollective",        file: "SlotCollective",        export: "SlotCollectiveAbi" },
  { out: "slotCollectiveFactory", file: "SlotCollectiveFactory", export: "SlotCollectiveFactoryAbi" },
];

function walk(dir) {
  const found = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) found.push(...walk(p));
    else if (e.endsWith(".json")) found.push(p);
  }
  return found;
}

let artifacts;
function findArtifact({ source, name }) {
  artifacts ??= walk(OUT);
  const hits = [];
  for (const p of artifacts) {
    if (!p.endsWith(`/${name}.json`)) continue;
    let a;
    try {
      a = JSON.parse(readFileSync(p, "utf8"));
    } catch {
      continue;
    }
    const targets = a?.metadata?.settings?.compilationTarget ?? {};
    // Exact source AND exact contract name: `src/Slot.sol` declares more than
    // one contract, and only one of them is the target.
    if (targets[source] === name) hits.push(a.abi);
  }
  if (hits.length === 0) {
    throw new Error(
      `no artifact for ${name} at ${source}\n` +
        `  run \`forge build\` in apps/contracts first`,
    );
  }
  return hits[0];
}

/** One canonical rendering, so `--check` compares content and not whitespace. */
function render(body, exportName, header) {
  const json = JSON.stringify(body, null, 2)
    .split("\n")
    .map((l, i) => (i === 0 || !l.trim() ? l : "  " + l))
    .join("\n");
  return `${header}\nexport const ${exportName} = ${json} as const;\n`;
}

const check = process.argv.includes("--check");
const stale = [];

function emit(path, contents) {
  let current = null;
  try {
    current = readFileSync(path, "utf8");
  } catch {}
  if (current === contents) return false;
  if (check) {
    stale.push(relative(REPO, path));
    return true;
  }
  writeFileSync(path, contents);
  return true;
}

let wrote = 0;
for (const c of CONTRACTS) {
  const abi = findArtifact(c);
  const path = join(PKG, "src/abis/slots", `${c.out}.ts`);
  const text = render(
    abi,
    `${c.out}Abi`,
    `// Generated from ${c.source} by scripts/sync-abis.mjs. Do not edit.`,
  );
  if (emit(path, text)) wrote++;
}

for (const m of PONDER_MIRRORS) {
  const src = readFileSync(join(PKG, "src/abis/slots", `${m.out}.ts`), "utf8");
  const abi = JSON.parse(src.slice(src.indexOf("["), src.lastIndexOf("]") + 1));
  const path = join(REPO, "packages/ponder/abis", `${m.file}.ts`);
  const text = render(
    abi,
    m.export,
    `// Mirrored from packages/contracts/src/abis/slots/${m.out}.ts\n` +
      `// by packages/contracts/scripts/sync-abis.mjs. Do not edit.`,
  );
  if (emit(path, text)) wrote++;
}

if (check) {
  if (stale.length) {
    console.error("ABIs are stale — these do not match the compiled contracts:");
    for (const f of stale) console.error(`  ${f}`);
    console.error("\nRegenerate with:  pnpm --filter @0xslots/contracts sync-abis");
    process.exit(1);
  }
  console.log(`ABIs up to date (${CONTRACTS.length} contracts, ${PONDER_MIRRORS.length} mirrors)`);
} else {
  console.log(
    wrote === 0
      ? `ABIs already up to date (${CONTRACTS.length} contracts, ${PONDER_MIRRORS.length} mirrors)`
      : `wrote ${wrote} file(s)`,
  );
}
