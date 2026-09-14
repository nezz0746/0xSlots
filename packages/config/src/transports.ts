import { createPublicClient, http, type Transport } from "viem";
import { appChains } from "./chains";

/** Alchemy subdomain by chain ID */
export const ALCHEMY_SUBDOMAINS: Record<number, string> = {
  1: "eth-mainnet",
  10: "opt-mainnet",
  8453: "base-mainnet",
  42161: "arb-mainnet",
  11155111: "eth-sepolia",
  84532: "base-sepolia",
};

/** Build an Alchemy RPC URL for a given chain */
export function alchemyRpcUrl(
  chainId: number,
  apiKey: string,
): string | undefined {
  const sub = ALCHEMY_SUBDOMAINS[chainId];
  return sub ? `https://${sub}.g.alchemy.com/v2/${apiKey}` : undefined;
}

/** Create an HTTP transport for a chain, falling back to public RPC if no Alchemy subdomain exists */
export function alchemyTransport(chainId: number, apiKey?: string): Transport {
  if (!apiKey) return http();
  const url = alchemyRpcUrl(chainId, apiKey);
  return url ? http(url) : http();
}

/** Create a transport map for multiple chains */
export function alchemyTransports(
  chainIds: number[],
  apiKey?: string,
): Record<number, Transport> {
  return Object.fromEntries(
    chainIds.map((id) => [id, alchemyTransport(id, apiKey)]),
  );
}

// ──────────────────────────────────────────
// Proxied transports — what the BROWSER should use
//
// Alchemy puts the key in the URL PATH, so any transport built in the browser
// publishes it to every visitor. That is what `NEXT_PUBLIC_ALCHEMY_API_KEY`
// meant: a billable credential inlined into the client bundle, liftable by
// anyone who opens devtools, and spendable until it is rotated. A key that
// leaves the server has no rate limit you control and no way to attribute the
// spend.
//
// So the browser talks to our own origin and the server holds the key. Two
// further things fall out of it, both of which had cost real time:
//
//   * A 429 from Alchemy omits `Access-Control-Allow-Origin`, so an exhausted
//     quota reaches the browser as "blocked by CORS policy" — a failure that
//     sends you looking at origins and allowlists. Same-origin requests have
//     no ACAO to lose, so the app sees the real error.
//   * The route can fall through to a public endpoint, so a missing key
//     degrades instead of failing.
//
// See `apps/landing/src/app/api/rpc/[chain]/route.ts` for the server half.
// ──────────────────────────────────────────

/** Where the browser reaches our RPC proxy for a chain. */
export function proxyRpcPath(chainId: number): string {
  return `/api/rpc/${chainId}`;
}

/**
 * A transport for one chain, routed by where the code is running.
 *
 * On the SERVER a relative URL has no origin to resolve against, so this goes
 * straight to Alchemy with the server-side key — which is safe there and skips
 * a pointless hop through our own route. In the BROWSER it goes to the proxy.
 *
 * A chain with no Alchemy subdomain — anvil — is reached directly in both
 * cases: it is on this machine, there is no key to protect, and a proxy would
 * only add a hop.
 */
export function proxyTransport(chainId: number): Transport {
  if (!ALCHEMY_SUBDOMAINS[chainId]) return http(undefined, { batch: true });

  // `"window" in globalThis` rather than `typeof window`: this package is
  // consumed by the API too, where there is no DOM lib to name `window` from.
  if (!("window" in globalThis)) {
    const serverKey =
      process.env.ALCHEMY_API_KEY ?? process.env.ALCHEMY_KEY ?? "";
    const url = serverKey ? alchemyRpcUrl(chainId, serverKey) : undefined;
    return http(url, { batch: true });
  }

  return http(proxyRpcPath(chainId), { batch: true });
}

/**
 * Transport map for multiple chains, all proxied.
 *
 * `batch: true` is not incidental. Every one of these reads is issued by a
 * React component, so a table of twenty slots asks twenty questions in the same
 * tick; batching coalesces them into one `aggregate3` round trip. It is not a
 * cache — every answer is fresh — it just stops the app paying per question
 * for questions it asked simultaneously.
 */
export function proxyTransports(chainIds: number[]): Record<number, Transport> {
  return Object.fromEntries(chainIds.map((id) => [id, proxyTransport(id)]));
}

export function getChainClient(chainId: number, alchemyKey: string) {
  return createPublicClient({
    chain: appChains.find((c) => c.id === chainId),
    transport: alchemyTransport(chainId, alchemyKey),
  });
}
