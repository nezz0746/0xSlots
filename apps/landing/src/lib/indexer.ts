import { DEFAULT_API_URL, LOCAL_API_URL, SlotsChain } from "@0xslots/sdk";

/**
 * Where to read indexed data from.
 *
 * One endpoint for every chain. The subgraph was one deployment per network, so
 * the app used to pick a URL by chain AND offer a network/Studio switch on top;
 * ponder indexes every chain into one database, so the chain is a query filter
 * and there is nothing left to choose. That is why `SubgraphSourceProvider` and
 * its sidebar switch are gone rather than ported.
 *
 * Local dev is the one exception: `pnpm dev:local` runs an indexer against
 * anvil on 42069, and chain 31337 only ever exists there.
 */
export function indexerUrlFor(chainId: number): string {
  // 31337 only ever exists on the machine running `pnpm dev:local`.
  if (chainId === SlotsChain.ANVIL) return LOCAL_API_URL;
  // The deployed indexer serves base and base-sepolia from one database; the
  // env var is an escape hatch for pointing a branch at a different instance.
  return process.env.NEXT_PUBLIC_PONDER_URL || DEFAULT_API_URL;
}

export const INDEXER_API_KEY = process.env.NEXT_PUBLIC_PONDER_API_KEY;
