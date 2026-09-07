import { NextResponse } from "next/server";

import { econome, NotConfigured } from "@/lib/econome";

/**
 * One batch of files into a folder.
 *
 * The browser sends the multipart body already shaped — `file` and `path`
 * fields one-to-one — and this forwards it with the key attached. Streaming
 * the body through rather than parsing it keeps large batches off this
 * process's heap.
 *
 * `commit` is the caller's to decide and is the whole reason batching works
 * here: staged batches return `rootCid: null` and cost one MFS write, and the
 * last batch commits, which pins the new root and unpins the stale one. A
 * commit per batch would republish the folder N times and give every batch but
 * the last a root nobody wants.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const commit = new URL(request.url).searchParams.get("commit") !== "false";

  const contentType = request.headers.get("content-type");
  if (!contentType?.includes("multipart/form-data"))
    return NextResponse.json({ error: "expected multipart" }, { status: 400 });

  try {
    const res = await econome(
      `/folders/${encodeURIComponent(name)}/files?commit=${commit}`,
      {
        method: "POST",
        headers: { "content-type": contentType },
        body: request.body,
        // Required by undici whenever a stream is the body.
        duplex: "half",
      } as RequestInit & { duplex: "half" },
    );
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    if (e instanceof NotConfigured)
      return NextResponse.json({ error: e.message }, { status: 501 });
    throw e;
  }
}
