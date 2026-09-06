import { NextResponse } from "next/server";

import { econome, NotConfigured } from "@/lib/econome";

/** A folder's current root CID and what is in it. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  try {
    const res = await econome(`/folders/${encodeURIComponent(name)}`);
    if (!res.ok)
      return NextResponse.json(
        { error: await res.text() },
        { status: res.status },
      );
    return NextResponse.json(await res.json());
  } catch (e) {
    if (e instanceof NotConfigured)
      return NextResponse.json({ error: e.message }, { status: 501 });
    throw e;
  }
}
