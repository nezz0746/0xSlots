// ──────────────────────────────────────────
// RPC endpoints
//
// Two ways in, checked in order:
//
//   1. PONDER_RPC_URL_BASE / PONDER_RPC_URL_BASE_SEPOLIA — a complete URL.
//      Preferred for a deployment: paste what the provider gave you and no
//      secret has to be reassembled here.
//   2. COINBASE_API_KEY, else ALCHEMY_API_KEY (or ALCHEMY_KEY, which is what
//      turbo.json and the rest of the repo use) — the URL is built around it.
//
// Missing credentials used to resolve to `.../v2/` and fail on every request
// with "Must be authenticated!", eight retries per chain, forever. That reads
// like a provider outage rather than an unset variable, so it now throws at
// boot naming the variables involved.
//
// ── Endpoints go to ponder as URLs, never as a viem Transport ────────────────
//
// `chain.rpc` takes `string | string[] | Transport`, and the three are not
// equivalent. From ponder/dist/esm/rpc/index.js, a URL (or a list of them)
// becomes one tracked *bucket* per endpoint:
//
//   * per-provider adaptive rate limiting, starting at 20 rps and moving with
//     the provider's own answers (`maxRequestsPerSecond` is deprecated —
//     "Handled automatically instead")
//   * deactivation with exponential backoff on 429 or timeout, and
//     reactivation afterwards
//   * selection by `expectedLatency`, which divides total latency by the
//     SUCCESSFUL count — so a provider that errors is scored worse and drifts
//     out of rotation, while 10% epsilon exploration keeps re-testing it
//   * a fresh bucket per retry, up to 9, so one provider's refusal is a retry
//     rather than a dead end
//   * the provider's hostname in every log line
//
// A viem Transport gets none of that. It is wrapped as a single bucket named
// `custom_transport` and ponder treats the whole pool as one provider, which
// is exactly what `loadBalance()` used to hand it here. That is what turned a
// blocked endpoint into a stalled sync — see PUBLIC_RPCS below.
// ──────────────────────────────────────────

const ALCHEMY_KEY =
  process.env.ALCHEMY_API_KEY ?? process.env.ALCHEMY_KEY ?? "";

/**
 * Coinbase Developer Platform, and the one that wins when both are set.
 *
 * The key rides in the URL path — it is CDP's *client* key, the one their docs
 * describe as safe in frontend code — so it needs no header support and slots
 * into the same URL list as everything else. Documented ceiling is 7,500 BU per
 * 5 seconds per project, and CDP documents no eth_getLogs limits at all, which
 * is not the same as having none: the address-list ceiling that publicnode
 * enforces below was undocumented too. Verify before trusting it as the only
 * provider on a chain (see the probe recipe in PUBLIC_RPCS).
 */
const COINBASE_KEY = process.env.COINBASE_API_KEY ?? "";

/**
 * Per-chain path segment for each paid provider.
 *
 * `coinbase` is OPTIONAL, and that is what adding Ethereum Sepolia forced.
 * CDP is a Base-first product; a chain it does not serve has no path to put
 * here, and inventing one would have built a URL that 404s for whoever had
 * COINBASE_API_KEY set — a chain that syncs everywhere except on the machines
 * with the better key. Absent means "fall through to Alchemy", which
 * `rpcPool` does explicitly below.
 */
export type PoolLabel = "base" | "base_sepolia" | "sepolia";

const PAID_ENDPOINTS: Record<
  PoolLabel,
  { alchemy: string; coinbase?: string }
> = {
  base: { alchemy: "base-mainnet", coinbase: "base" },
  base_sepolia: { alchemy: "base-sepolia", coinbase: "base-sepolia" },
  sepolia: { alchemy: "eth-sepolia" },
};

// ALCHEMY_RPS is gone with the `rateLimit()` wrapper it configured. Capping
// Alchemy never reduced the bill anyway — the credits a backfill costs are set
// by how many requests the data needs, not by how fast they are sent — and the
// wrapper forced the single-bucket path above. Ponder now rate-limits each
// provider on its own evidence, and Alchemy's 429s are what tell it to slow
// down.

/**
 * Public endpoints — OPT-IN, via PONDER_PUBLIC_RPCS=1, and never the whole
 * pool on their own.
 *
 * Most of them refuse the one method that matters. Measured 2026-08-20 with
 * this indexer's own filter shape — 50 factory-derived addresses, 23 topic0s,
 * against a window at the chain tip:
 *
 *   mainnet.base.org                  ok
 *   base.drpc.org                     ok
 *   base-rpc.publicnode.com           -32602 "Request blocked" (HTTP 403)
 *   base-sepolia-rpc.publicnode.com   -32602 "Request blocked" (HTTP 403)
 *   base-sepolia.gateway.tenderly.co  ok at 25, 1k and 10k-block windows
 *   base-sepolia.drpc.org             408 "Request timeout on the free tier",
 *                                     intermittently — 1k ok, 25 and 10k not
 *   base.api.onfinality.io/public     -32029, needs an API key (earlier)
 *   api.zan.top/base-mainnet          -32012, unregistered (earlier)
 *
 * Mixed into the pool they once produced 48 errors and zero progress, because
 * `loadBalance()` is round-robin with no failover — @ponder/utils hands the
 * request to `transports[index++]` and returns whatever comes back, error
 * included. Handing ponder the URLs instead (see above) makes a refusal cost
 * one retry against a different bucket, so a bad member degrades throughput
 * rather than stopping the sync. That is what makes them safe to keep here —
 * as a cheap tier UNDER a provider that answers everything, not as a
 * replacement for one.
 *
 * ── What publicnode actually refuses ─────────────────────────────────────────
 *
 * Both base-sepolia rows here were publicnode (wss and https are one
 * provider), and on 2026-08-20 production had it rejecting every log query the
 * indexer makes: -32602, "Details: Request blocked", over a 25-block window at
 * the tip (0x2b9c5f8 -> 0x2b9c610) carrying 50 addresses.
 *
 * Bisecting the request shows the limit is the ADDRESS LIST, and nothing else:
 *
 *   1..9 addresses    ok          23 topic0s      ok
 *   10+ addresses     blocked     10,000 blocks   ok
 *
 * So the span rules out an archive-depth limit and ponder's "use
 * ethGetLogsBlockRange" tip with it — no block range is small enough, because
 * the range was never the problem. Ponder batches factory children ~50 at a
 * time, so every log query the `Slot` source emits is over the line, on BOTH
 * chains: base-rpc.publicnode.com blocks the same shape.
 *
 * publicnode stays in the base pool, where two other members answer the heavy
 * method and it still serves the block polling that is most of the volume. It
 * is gone from base-sepolia, where it was the entire pool and there was
 * nothing to absorb the refusal.
 *
 * Coinbase's https://sepolia.base.org is excluded for a different reason: its
 * eth_getLogs is broken for some contracts, which is a wrong answer rather
 * than an error.
 *
 * ── Vetting a candidate ──────────────────────────────────────────────────────
 *
 * Reachability proves nothing here; every endpoint above answers
 * eth_blockNumber. Ask it for the shape this indexer actually sends — a long
 * address list — and compare a 25-block window against a 10,000-block one:
 *
 *   ADDRS=$(printf '"0x%040d",%.0s' 1 $(seq 1 49))"0x$(printf '%040d' 50)"
 *   curl -s "$URL" -H 'content-type: application/json' --data @- <<JSON | head -c 300
 *   {"jsonrpc":"2.0","id":1,"method":"eth_getLogs","params":[{"address":[$ADDRS],
 *    "fromBlock":"0x2b9c5f8","toBlock":"0x2b9c610"}]}
 *   JSON
 *
 * A JSON-RPC error, an HTTP 403 or a timeout all disqualify it. Anything that
 * only fails on the wide window is a rate-limit story, not a capability one.
 */
const PUBLIC_RPCS: Record<string, string[]> = {
  base: [
    "wss://base-rpc.publicnode.com",
    "wss://base.drpc.org",
    "https://mainnet.base.org",
  ],
  // Tenderly is the one free base-sepolia endpoint that answered the real
  // filter shape at every window size tried. One provider's worth of evidence
  // from one afternoon, so it is a cheap tier under Alchemy, not a substitute
  // for it. base-sepolia.drpc.org is deliberately absent: its free tier timed
  // out on two of the three windows, which is a slow stall rather than a fast
  // error.
  base_sepolia: ["https://base-sepolia.gateway.tenderly.co"],
  // Vetted with the recipe above on 2026-09-07, 50 addresses at the tip:
  //
  //   sepolia.gateway.tenderly.co        ok at 25 and 10,000 blocks
  //   ethereum-sepolia-rpc.publicnode.com  -32602 "Request blocked", at BOTH
  //                                        window sizes — the same address-list
  //                                        ceiling it enforces on base
  //   sepolia.drpc.org                     no response
  //
  // So the same single-member tier as base-sepolia, for the same reason.
  sepolia: ["https://sepolia.gateway.tenderly.co"],
};

const USE_PUBLIC_RPCS = process.env.PONDER_PUBLIC_RPCS === "1";

/**
 * Names the providers actually in play, key redacted.
 *
 * The previous build logged the flag alone, so attributing a stalled sync to
 * its endpoint took a production log dump. Hostnames are safe to print; the
 * Alchemy URL's path is the credential.
 */
const announce = (label: string, urls: string[]) => {
  const hosts = urls.map((u) => {
    try {
      return new URL(u).hostname;
    } catch {
      return "<unparseable url>";
    }
  });
  console.log(`[rpc] ${label}: ${hosts.join(", ")}`);
};

/**
 * The endpoint list for a chain, as URLs for ponder to manage.
 *
 *   1. PONDER_RPC_URL_<CHAIN> — comma-separated, and the complete answer when
 *      set. Nothing else is added, so a deployment can pin exactly what it
 *      wants.
 *   2. Otherwise Alchemy, plus the public tier when PONDER_PUBLIC_RPCS=1.
 *
 * The paid endpoint — Coinbase if its key is set, else Alchemy — goes FIRST.
 * Order is not priority: ponder scores buckets by observed latency, so this
 * only decides who serves the opening requests before there is any evidence to
 * score. Starting on the provider that answers everything is the difference
 * between a sync that begins and one that spends its first minute discovering
 * which members are refusing it.
 *
 * ── Spending Alchemy only on the backfill ────────────────────────────────────
 *
 * Ponder has no per-phase endpoint app, so this cannot be expressed in config.
 * It is an operational sequence instead: deploy with Alchemy alone, let the
 * historical sync finish, then set PONDER_PUBLIC_RPCS=1 and redeploy.
 *
 * What that saves is narrower than it first looks. The RPC cache lives in its
 * own `ponder_sync` schema, keyed by chain rather than by app, so a new app
 * schema replays cached ranges from Postgres instead of the provider — but the
 * indexing functions still re-run, and any source or range that was not cached
 * before (a newly added contract, an earlier startBlock) is real RPC work at
 * whatever endpoints are configured at that moment. Verify with
 * `select count(*) from ponder_sync.logs`.
 */
export function rpcPool(
  label: PoolLabel,
  explicit: string | undefined,
): string[] {
  const explicitUrls = (explicit ?? "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
  if (explicitUrls.length > 0) {
    announce(`${label} (explicit)`, explicitUrls);
    return explicitUrls;
  }

  // Coinbase REPLACES Alchemy rather than outranking it, because ordering here
  // buys less than it looks like it does: ponder picks buckets by observed
  // latency, so a pool of [coinbase, alchemy] converges on whichever answers
  // faster, not on the one named first. Exclusivity is the only way to say
  // "use Coinbase" and have it hold. To run both as peers instead, make this
  // an `if` and drop the `else`.
  const pool: string[] = [];
  const paid = PAID_ENDPOINTS[label];
  if (COINBASE_KEY && paid.coinbase) {
    pool.push(
      `https://api.developer.coinbase.com/rpc/v1/${paid.coinbase}/${COINBASE_KEY}`,
    );
  } else if (ALCHEMY_KEY) {
    pool.push(`https://${paid.alchemy}.g.alchemy.com/v2/${ALCHEMY_KEY}`);
  }
  if (USE_PUBLIC_RPCS) {
    pool.push(...(PUBLIC_RPCS[label] ?? []));
  }

  if (pool.length === 0) {
    // Coinbase is named only where it can actually serve this chain. It was
    // named unconditionally, which meant a chain CDP does not carry told you
    // to set the key you had already set.
    const keys = paid.coinbase
      ? "COINBASE_API_KEY, or ALCHEMY_API_KEY"
      : `ALCHEMY_API_KEY (CDP does not serve ${label})`;
    throw new Error(
      `No RPC endpoint for ${label}. Set PONDER_RPC_URL_${label.toUpperCase()} ` +
        `to a URL (or a comma-separated list), or ${keys} ` +
        `(ALCHEMY_KEY is also accepted). ` +
        `PONDER_PUBLIC_RPCS=1 adds this chain's public tier, where it has one.`,
    );
  }
  announce(label, pool);
  return pool;
}
