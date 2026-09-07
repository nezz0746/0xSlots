import "server-only";

/**
 * Économe IPFS, reachable only from the server.
 *
 * The API key is a bearer credential for an account that can write to the
 * cluster, so it must never reach a browser — a `NEXT_PUBLIC_` variable is
 * inlined into the client bundle and handed to every visitor. Uploads
 * therefore go through the route handlers beside this file, which is the same
 * shape Économe's own dashboard uses: the browser posts to us, we add the key.
 *
 * `server-only` makes that a build error rather than a code review.
 */
const BASE = process.env.ECONOME_IPFS_URL;
const KEY = process.env.ECONOME_IPFS_KEY;

export class NotConfigured extends Error {
  constructor() {
    super("Économe IPFS is not configured on this deployment.");
  }
}

/** One call against the ingest API, with the key attached here and nowhere else. */
export async function econome(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  if (!BASE || !KEY) throw new NotConfigured();
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...init.headers, authorization: `Bearer ${KEY}` },
    // Uploads are the point; nothing here is worth a cache.
    cache: "no-store",
  });
}

export const ipfsConfigured = () => Boolean(BASE && KEY);

/**
 * A folder name Économe will accept, derived from the collection.
 *
 * Scoped by address rather than by the collection's name: two people may both
 * call a collection "Editions", and the folder namespace is shared across
 * everything this key has ever uploaded.
 */
export function folderFor(collection: string): string {
  return `slotmarket-${collection.toLowerCase()}`;
}
