"use client";

import { useCallback, useState } from "react";

/** Files per request. Small enough that progress moves, large enough to be cheap. */
const BATCH = 8;

export type UploadPhase =
  | { kind: "idle" }
  | { kind: "opening" }
  | {
      kind: "sending";
      done: number;
      total: number;
      batch: number;
      batches: number;
    }
  /** Images are up; writing the metadata document each token resolves to. */
  | { kind: "describing"; total: number }
  | { kind: "committing"; total: number }
  | { kind: "done"; rootCid: string; total: number }
  | { kind: "failed"; message: string; done: number; total: number };

/**
 * Files to a collection's IPFS folder, in batches, with honest progress.
 *
 * ── Why files and not bytes ──────────────────────────────────────────────
 *
 * A byte-level bar would need upload progress from the request itself, which
 * `fetch` does not report; the usual workaround is to fake it on a timer. The
 * API answers per batch with what it added, so counting files is a number the
 * server actually confirmed. It also matches what the creator is thinking
 * about — works, not megabytes.
 *
 * ── Why committing is its own phase ──────────────────────────────────────
 *
 * The last batch pins the new root and unpins the previous one, which takes
 * noticeably longer than the batches before it. Folded into the bar it reads
 * as a hang at 100%; named, it reads as the thing it is.
 */
export function useIpfsUpload() {
  const [phase, setPhase] = useState<UploadPhase>({ kind: "idle" });

  const reset = useCallback(() => setPhase({ kind: "idle" }), []);

  /**
   * @param startAt The token id the first file becomes. `tokenURI` is the base
   *   plus the id with nothing between, so each file is stored under its
   *   number and nothing else — a second upload continues the run rather than
   *   overwriting it.
   */
  const upload = useCallback(
    async (
      collection: string,
      files: File[],
      startAt = 1,
      collectionName = "",
    ): Promise<string | null> => {
      const total = files.length;
      if (total === 0) return null;

      try {
        setPhase({ kind: "opening" });
        const opened = await fetch("/api/ipfs/folder", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ collection }),
        });
        if (!opened.ok) throw new Error(await message(opened));
        const { name } = (await opened.json()) as { name: string };

        const batches = Math.ceil(total / BATCH);
        let done = 0;
        let rootCid: string | null = null;

        /**
         * Images first, under `art/`, and nothing committed yet.
         *
         * Their own CIDs come back per file, which is what lets the metadata
         * below point at them: an image's content address does not depend on
         * the folder it sits in, so there is no waiting for a root that only
         * exists after the commit.
         */
        const art: { tokenId: number; cid: string; type: string }[] = [];

        for (let b = 0; b < batches; b++) {
          const slice = files.slice(b * BATCH, b * BATCH + BATCH);
          setPhase({ kind: "sending", done, total, batch: b + 1, batches });

          const form = new FormData();
          slice.forEach((file, i) => {
            form.append("file", file);
            form.append("path", `art/${startAt + done + i}${extension(file)}`);
          });

          const res = await fetch(
            `/api/ipfs/folder/${encodeURIComponent(name)}/files?commit=false`,
            { method: "POST", body: form },
          );
          if (!res.ok) throw new Error(await message(res));

          const body = (await res.json()) as {
            added: { path: string; cid: string }[];
          };
          body.added.forEach((added, i) => {
            art.push({
              tokenId: startAt + done + i,
              cid: added.cid,
              type: slice[i]?.type ?? "",
            });
          });
          done += body.added.length;
        }

        /**
         * Then a metadata document per token, at the bare number.
         *
         * `tokenURI` is the base plus the id, and ERC-721 says what sits there
         * is JSON naming an image — not the image. Uploading the picture alone
         * renders here, because this app now reads both, and renders nowhere
         * else: every other marketplace parses that response as JSON and gives
         * up.
         */
        setPhase({ kind: "describing", total });
        const docs = art.map((entry) => ({
          path: String(entry.tokenId),
          file: new File(
            [
              JSON.stringify({
                name: collectionName
                  ? `${collectionName} No. ${entry.tokenId}`
                  : `No. ${entry.tokenId}`,
                image: `ipfs://${entry.cid}`,
              }),
            ],
            String(entry.tokenId),
            { type: "application/json" },
          ),
        }));

        const docBatches = Math.ceil(docs.length / BATCH);
        for (let b = 0; b < docBatches; b++) {
          const slice = docs.slice(b * BATCH, b * BATCH + BATCH);
          const last = b === docBatches - 1;
          if (last) setPhase({ kind: "committing", total });

          const form = new FormData();
          for (const doc of slice) {
            form.append("file", doc.file);
            form.append("path", doc.path);
          }

          const res = await fetch(
            `/api/ipfs/folder/${encodeURIComponent(name)}/files?commit=${last}`,
            { method: "POST", body: form },
          );
          if (!res.ok) throw new Error(await message(res));
          const body = (await res.json()) as { rootCid: string | null };
          rootCid = body.rootCid ?? rootCid;
        }

        if (!rootCid) throw new Error("The folder committed without a root.");
        setPhase({ kind: "done", rootCid, total });
        return rootCid;
      } catch (e) {
        setPhase({
          kind: "failed",
          message: e instanceof Error ? e.message : String(e),
          done: 0,
          total,
        });
        return null;
      }
    },
    [],
  );

  return { phase, upload, reset };
}

/** Keeps the stored image recognisable; the metadata points at it by CID. */
function extension(file: File): string {
  const fromName = file.name.match(/\.[a-z0-9]+$/i)?.[0];
  if (fromName) return fromName.toLowerCase();
  const sub = file.type.split("/")[1];
  return sub ? `.${sub.split("+")[0]}` : "";
}

/** The API answers with JSON where it can and text where it cannot. */
async function message(res: Response): Promise<string> {
  const raw = await res.text();
  try {
    const parsed = JSON.parse(raw) as { error?: string };
    return parsed.error ?? raw;
  } catch {
    return raw || `Upload failed (${res.status})`;
  }
}
