import { SlotsChain } from "@0xslots/sdk";

/**
 * Optional per-chain override for the subgraph endpoint.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * By default the SDK reads the decentralized network through
 * `gateway.thegraph.com`, which serves whichever deployment INDEXERS have
 * allocated to. A freshly published version is not queried there until an
 * indexer picks it up and syncs it from `startBlock` — hours for these
 * subgraphs — and until then the gateway answers
 * `subgraph not found: no allocations`.
 *
 * Subgraph Studio serves a deployment the moment it finishes indexing, with no
 * allocation involved. Pointing at Studio is therefore how you exercise a
 * mapping change before the network catches up.
 *
 * ── The endpoints ───────────────────────────────────────────────────────────
 * The URL shape is stable, but `version/latest` follows whatever was deployed
 * to Studio most recently — it is a moving target, not a pin. Studio is also
 * rate-limited and meant for development, so this is a local tool rather than
 * something to ship pointed at.
 *
 * The slugs come from `packages/subgraph/config/<network>.json` → `studioName`,
 * and they are NOT symmetrical: `0-xslots-base` but `0-x-slots-base-sepolia`.
 * Copy them from that file rather than inferring the pattern.
 *
 *   NEXT_PUBLIC_SUBGRAPH_URL_BASE=https://api.studio.thegraph.com/query/958/0-xslots-base/version/latest
 *   NEXT_PUBLIC_SUBGRAPH_URL_BASE_SEPOLIA=https://api.studio.thegraph.com/query/958/0-x-slots-base-sepolia/version/latest
 *
 * Unset either one and that chain falls back to the gateway, so this can be
 * turned on per chain.
 *
 * @see https://thegraph.com/docs/en/subgraphs/developing/deploying/using-subgraph-studio/
 */

// Referenced literally, never through a computed key: Next.js inlines
// `process.env.NEXT_PUBLIC_*` at build time by static analysis, and a dynamic
// lookup resolves to undefined in the browser bundle.
const OVERRIDES: Partial<Record<SlotsChain, string | undefined>> = {
  [SlotsChain.BASE]: process.env.NEXT_PUBLIC_SUBGRAPH_URL_BASE,
  [SlotsChain.BASE_SEPOLIA]: process.env.NEXT_PUBLIC_SUBGRAPH_URL_BASE_SEPOLIA,
};

let warned = false;

/**
 * The subgraph URL to use for `chainId`, or `undefined` to let the SDK pick.
 *
 * Returning `undefined` rather than the gateway URL keeps the default in one
 * place — the SDK's own `SUBGRAPH_URLS` — so this never drifts from it.
 */
export function subgraphUrlFor(chainId: SlotsChain): string | undefined {
  const url = OVERRIDES[chainId];
  if (!url) return undefined;

  // Loud on purpose. Querying somewhere other than the gateway changes which
  // data the whole app sees, and silently reading a different source is the
  // kind of thing that costs an hour when the numbers look wrong.
  if (!warned && process.env.NODE_ENV !== "production") {
    warned = true;
    console.warn(
      `[subgraph] Overridden for chain ${chainId}: ${url}\n` +
        "Not the decentralized network — unset NEXT_PUBLIC_SUBGRAPH_URL_* to go back.",
    );
  }

  return url;
}
