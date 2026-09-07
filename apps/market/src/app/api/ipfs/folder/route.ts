import { NextResponse } from "next/server";

import { econome, folderFor, NotConfigured } from "@/lib/econome";

/**
 * Open a folder for a collection's art.
 *
 * Named after the collection's ADDRESS, not its title: the folder namespace is
 * shared across everything this key has uploaded, and two people will
 * eventually both call a collection "Editions".
 *
 * Idempotent from the caller's side — an existing folder is returned rather
 * than treated as an error, so a creator who uploads a second batch a week
 * later lands in the same place.
 */
export async function POST(request: Request) {
  let collection: string;
  try {
    ({ collection } = await request.json());
    if (
      typeof collection !== "string" ||
      !/^0x[0-9a-fA-F]{40}$/.test(collection)
    )
      throw new Error("bad address");
  } catch {
    return NextResponse.json(
      { error: "expected a collection address" },
      { status: 400 },
    );
  }

  const name = folderFor(collection);
  try {
    const made = await econome("/folders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, tags: ["slotmarket"] }),
    });
    if (made.ok) return NextResponse.json(await made.json());

    // Already there: read it back rather than failing a second upload.
    const existing = await econome(`/folders/${name}`);
    if (existing.ok) return NextResponse.json(await existing.json());

    return NextResponse.json(
      { error: await made.text() },
      { status: made.status },
    );
  } catch (e) {
    if (e instanceof NotConfigured)
      return NextResponse.json({ error: e.message }, { status: 501 });
    throw e;
  }
}
