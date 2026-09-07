import { indexerUrl } from "./chains";

/**
 * One GraphQL call against the ponder instance.
 *
 * Deliberately tiny: this app reads four things, and a client library for four
 * queries is more surface than the queries themselves. Errors are thrown rather
 * than returned so react-query's own retry and error states do the work.
 */
export async function query<T>(
  chainId: number,
  document: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(indexerUrl(chainId), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: document, variables }),
  });
  if (!res.ok) throw new Error(`indexer ${res.status}`);

  const json = (await res.json()) as {
    data?: T;
    errors?: { message: string }[];
  };
  if (json.errors?.length) throw new Error(json.errors[0]!.message);
  if (!json.data) throw new Error("indexer returned no data");
  return json.data;
}

export interface IndexedCollection {
  id: `0x${string}`;
  chainId: number;
  name: string | null;
  symbol: string | null;
  maxSupply: string;
  totalMinted: number;
  currency: `0x${string}`;
  recipient: `0x${string}`;
  taxBps: string | null;
  minDepositSeconds: string | null;
  manager: `0x${string}` | null;
  owner: `0x${string}` | null;
  baseURI: string | null;
  createdAt: string;
}

export interface IndexedToken {
  id: string;
  tokenId: string;
  slot: `0x${string}`;
  owner: `0x${string}`;
  minter: `0x${string}`;
  mintedAt: string;
}
