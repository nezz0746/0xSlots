import { NextResponse } from "next/server";

/**
 * Read IPFS content through this server rather than from the browser.
 *
 * Two reasons, and the first is the one that bites immediately.
 *
 * CORS. Reading a token's metadata means `fetch`, and a public gateway does
 * not reliably send `Access-Control-Allow-Origin` — so the request fails in
 * the browser while the identical URL returns 200 from a terminal. The failure
 * surfaced as the generated plate, which is indistinguishable from a
 * collection that simply has no art. An `<img src>` is unaffected, which is
 * why the picture would have appeared if anything had got as far as rendering
 * one.
 *
 * Freshness. A public gateway has to locate freshly pinned content over the
 * DHT before it can serve it, which takes minutes. Économe's own node holds
 * the pins, so pointing `IPFS_GATEWAY` at it makes a just-uploaded collection
 * appear at once.
 */
const GATEWAY =
  process.env.IPFS_GATEWAY ??
  process.env.NEXT_PUBLIC_IPFS_GATEWAY ??
  "https://ipfs.io/ipfs/";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  if (!path?.length)
    return NextResponse.json({ error: "no path" }, { status: 400 });

  // A CID and whatever sits under it. Rejected rather than forwarded when it
  // does not look like one: this route must not become an open proxy.
  const [cid, ...rest] = path;
  if (!/^[a-zA-Z0-9]{46,}$/.test(cid ?? ""))
    return NextResponse.json({ error: "not a cid" }, { status: 400 });

  const url = `${GATEWAY.replace(/\/$/, "")}/${[cid, ...rest].map(encodeURIComponent).join("/")}`;

  const res = await fetch(url, {
    headers: { accept: "*/*" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok)
    return NextResponse.json({ error: "not found" }, { status: res.status });

  return new NextResponse(res.body, {
    status: 200,
    headers: {
      "content-type":
        res.headers.get("content-type") ?? "application/octet-stream",
      // Content-addressed: it can never change under this URL.
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
