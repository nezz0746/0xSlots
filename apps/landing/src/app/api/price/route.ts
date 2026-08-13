import { unstable_cache } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";

/**
 * USD spot prices, proxied from Alchemy's Prices API.
 *
 * ── Why a route rather than calling from the browser ────────────────────────
 * The key the app already has is `NEXT_PUBLIC_ALCHEMY_API_KEY`, which the
 * bundler inlines — calling a billable pricing endpoint with it from the client
 * would put that key on every viewer's machine AND bill one upstream request
 * per keystroke, since the price sits beside a field people type in. Here it is
 * one request per token per revalidation window, shared by every visitor, with
 * the key read server-side.
 *
 * Prefers a server-only `ALCHEMY_API_KEY` when set, falling back to the public
 * one so this works with today's configuration and improves the moment a
 * server-side var exists.
 */
const API_KEY =
  process.env.ALCHEMY_API_KEY ?? process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

const PRICES_BASE = "https://api.g.alchemy.com/prices/v1";

/**
 * Only Base has prices worth showing.
 *
 * Testnet tokens are worthless by construction and the local anvil token is
 * invented, so a dollar figure there would be actively misleading rather than
 * merely absent.
 */
const BASE_CHAIN_ID = 8453;
const ALCHEMY_NETWORK = "base-mainnet";

/** The native-ETH sentinel — not a contract, so it needs the by-symbol path. */
const NATIVE = "0x0000000000000000000000000000000000000000";

/**
 * Kept short. A price beside an input wants to be roughly current, and the
 * whole point of caching here is to decouple upstream calls from keystrokes —
 * not to serve a stale figure for long.
 */
const REVALIDATE = 60;

type AlchemyPrice = { currency: string; value: string };
type AlchemyRow = {
  symbol?: string;
  address?: string;
  prices?: AlchemyPrice[];
  error?: unknown;
};

function usdOf(row: AlchemyRow | undefined): number | null {
  const usd = row?.prices?.find((p) => p.currency.toLowerCase() === "usd");
  if (!usd) return null;
  const n = Number(usd.value);
  return Number.isFinite(n) ? n : null;
}

/**
 * One cache entry per distinct token set.
 *
 * Keyed on the sorted address list, so two callers asking for the same tokens
 * in a different order share an entry rather than each warming their own.
 */
const fetchPrices = unstable_cache(
  async (addresses: string[]): Promise<Record<string, number>> => {
    if (!API_KEY || addresses.length === 0) return {};

    const out: Record<string, number> = {};
    const wantsNative = addresses.includes(NATIVE);
    const erc20 = addresses.filter((a) => a !== NATIVE);

    // Native ETH first — it has no contract address to look up.
    if (wantsNative) {
      const res = await fetch(
        `${PRICES_BASE}/${API_KEY}/tokens/by-symbol?symbols=ETH`,
        { headers: { accept: "application/json" } },
      );
      if (res.ok) {
        const body = (await res.json()) as { data?: AlchemyRow[] };
        const price = usdOf(body.data?.[0]);
        if (price !== null) out[NATIVE] = price;
      }
    }

    if (erc20.length > 0) {
      const res = await fetch(`${PRICES_BASE}/${API_KEY}/tokens/by-address`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          addresses: erc20.map((address) => ({
            network: ALCHEMY_NETWORK,
            address,
          })),
        }),
      });
      if (res.ok) {
        const body = (await res.json()) as { data?: AlchemyRow[] };
        for (const row of body.data ?? []) {
          const price = usdOf(row);
          if (row.address && price !== null) {
            out[row.address.toLowerCase()] = price;
          }
        }
      }
    }

    return out;
  },
  ["alchemy-prices"],
  { revalidate: REVALIDATE, tags: ["alchemy-prices"] },
);

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const chainId = Number(params.get("chainId"));

  // Not an error — the caller asked about a chain we have no prices for, and
  // an empty map is the honest answer. The hook renders nothing on `{}`.
  if (chainId !== BASE_CHAIN_ID) {
    return NextResponse.json({ prices: {} });
  }

  const addresses = [
    ...new Set(
      (params.get("tokens") ?? "")
        .split(",")
        .map((a) => a.trim().toLowerCase())
        .filter((a) => /^0x[0-9a-f]{40}$/.test(a)),
    ),
  ].sort();

  if (addresses.length === 0) return NextResponse.json({ prices: {} });

  try {
    const prices = await fetchPrices(addresses);
    return NextResponse.json({ prices });
  } catch {
    // A missing price degrades to no dollar figure. It must never take the buy
    // form down with it, so this is deliberately swallowed rather than 500'd.
    return NextResponse.json({ prices: {} });
  }
}
