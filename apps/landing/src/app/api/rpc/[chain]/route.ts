import { ALCHEMY_SUBDOMAINS, alchemyRpcUrl } from "@0xslots/config/transports";
import { NextResponse } from "next/server";

/**
 * The chain, reached through us rather than directly.
 *
 * ── The key does not belong in a browser ────────────────────────────────────
 *
 * Alchemy puts the key in the URL PATH, so any transport the browser builds
 * publishes it to every visitor. It was `NEXT_PUBLIC_ALCHEMY_API_KEY`, which is
 * inlined into the client bundle by definition — liftable from devtools by
 * anyone who loads the page, and spendable until somebody notices the bill and
 * rotates it. It is `ALCHEMY_API_KEY` now, read here and nowhere the browser
 * can see.
 *
 * ── A rate limit arrives disguised as a CORS error ──────────────────────────
 *
 * When Alchemy answers 429 it omits `Access-Control-Allow-Origin`, so a browser
 * reports "blocked by CORS policy" for what is actually an exhausted quota.
 * Same-origin requests have no preflight and no ACAO to lose, so the failure
 * that reaches the app is the real one.
 *
 * ── Something answers even when Alchemy will not ────────────────────────────
 *
 * A missing key or a 429 falls through to the chain's public endpoint. Slower
 * and rate-limited in its own right, but an explorer showing stale state is
 * better than one showing none, and it means a fork with no key configured
 * still runs.
 *
 * ── Why this is not an open RPC endpoint ────────────────────────────────────
 *
 * It is one, and that is the risk this route carries: an unauthenticated
 * JSON-RPC URL is a free node for whoever finds it, and a single `eth_getLogs`
 * backfill run through it spends a month of compute units in an afternoon. So
 * the method allowlist below is load-bearing, not hygiene. It admits the reads
 * the app actually makes and refuses the ones that are only worth stealing.
 */
export const dynamic = "force-dynamic";

/** Public endpoints, used when Alchemy has no key or will not answer. */
const PUBLIC_RPC: Record<number, string> = {
  1: "https://eth.llamarpc.com",
  8453: "https://mainnet.base.org",
  84532: "https://sepolia.base.org",
  11155111: "https://ethereum-sepolia-rpc.publicnode.com",
};

/**
 * What this route will forward.
 *
 * An allowlist rather than a blocklist: the cost of a method nobody thought
 * about is unbounded, and the cost of a missing one is a visible error that
 * takes a line to fix.
 *
 * `eth_getLogs` IS here, because the explorer's fallback table needs it — but
 * see the range guard below, which is what makes that safe.
 */
const ALLOWED_METHODS: ReadonlySet<string> = new Set([
  "eth_call",
  "eth_chainId",
  "eth_blockNumber",
  "eth_getBlockByNumber",
  "eth_getBalance",
  "eth_getCode",
  "eth_getLogs",
  "eth_getTransactionReceipt",
  "eth_getTransactionByHash",
  "eth_getTransactionCount",
  "eth_estimateGas",
  "eth_gasPrice",
  "eth_maxPriorityFeePerGas",
  "eth_feeHistory",
  "eth_sendRawTransaction",
]);

const KEY = process.env.ALCHEMY_API_KEY ?? process.env.ALCHEMY_KEY;

type RpcCall = { method?: unknown; params?: unknown };

/**
 * Whether one call is something we are willing to pay for.
 *
 * The `eth_getLogs` clause is the whole reason this function is not a one-line
 * set lookup. An unbounded range is the expensive shape — `fromBlock` absent
 * means genesis — and it is also the shape nobody legitimately needs here: the
 * app's own scan is bounded by the factory's deployment block. Refusing it
 * costs a correct caller nothing and costs a scraper the thing they came for.
 */
function isAllowed(
  call: RpcCall,
): { ok: true } | { ok: false; reason: string } {
  const method = call.method;
  if (typeof method !== "string" || !ALLOWED_METHODS.has(method)) {
    return {
      ok: false,
      reason: `${String(method)} is not forwarded by this endpoint.`,
    };
  }

  if (method === "eth_getLogs") {
    const filter = Array.isArray(call.params) ? call.params[0] : undefined;
    if (typeof filter !== "object" || filter === null)
      return { ok: false, reason: "eth_getLogs needs a filter object." };

    const { fromBlock } = filter as { fromBlock?: unknown };
    if (typeof fromBlock !== "string" || !/^0x[0-9a-f]+$/i.test(fromBlock)) {
      return {
        ok: false,
        reason:
          "eth_getLogs needs an explicit numeric fromBlock. An unbounded scan is not forwarded.",
      };
    }
  }

  return { ok: true };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ chain: string }> },
) {
  const { chain } = await params;
  const chainId = Number(chain);

  if (!Number.isInteger(chainId) || !ALCHEMY_SUBDOMAINS[chainId]) {
    return NextResponse.json(
      { error: `No RPC configured for chain ${chain}` },
      { status: 404 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Expected a JSON body." },
      { status: 400 },
    );
  }

  // viem batches, so a body is either one call or an array of them. Every
  // member has to pass — one disallowed call in a batch is a disallowed batch,
  // otherwise the allowlist is bypassed by wrapping.
  const calls = Array.isArray(body) ? body : [body];
  if (calls.length === 0 || calls.length > 100) {
    return NextResponse.json(
      { error: "Batch must hold between 1 and 100 calls." },
      { status: 400 },
    );
  }
  for (const call of calls) {
    const verdict = isAllowed(call as RpcCall);
    if (!verdict.ok)
      return NextResponse.json({ error: verdict.reason }, { status: 403 });
  }

  // Alchemy first where a key exists, the public tier second. A 429 is the
  // case this ordering is for: the whole point is that it keeps working.
  const alchemy = KEY ? alchemyRpcUrl(chainId, KEY) : undefined;
  const endpoints = [alchemy, PUBLIC_RPC[chainId]].filter(
    (url): url is string => !!url,
  );

  const payload = JSON.stringify(body);
  let last: Response | null = null;

  for (const url of endpoints) {
    try {
      const upstream = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: payload,
        cache: "no-store",
      });
      if (upstream.ok) {
        return new NextResponse(await upstream.text(), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "cache-control": "no-store",
          },
        });
      }
      last = upstream;
    } catch {
      // Network-level failure: try the next endpoint rather than giving up.
    }
  }

  return NextResponse.json(
    { error: "No upstream RPC answered.", status: last?.status ?? 502 },
    { status: 502 },
  );
}
