import {
  apiUrlFor,
  LOCAL_API_URL,
  SlotsChain,
  type SlotsEnvironment,
} from "@0xslots/sdk";

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
/**
 * Which indexer instance this build reads.
 *
 * `NEXT_PUBLIC_SLOTS_ENV=development` on the deployment that tracks `develop`,
 * unset everywhere else. One word rather than a URL, so the two deployments
 * cannot drift apart by someone updating one and forgetting the other — the
 * endpoints live in the SDK, next to the code that knows what they serve.
 *
 * Defaults to production: a build that says nothing gets the stable instance,
 * because pointing at development by accident means reading a database that is
 * rebuilt whenever a testnet is redeployed.
 */
const ENVIRONMENT: SlotsEnvironment =
  process.env.NEXT_PUBLIC_SLOTS_ENV === "development"
    ? "development"
    : "production";

export function indexerUrlFor(chainId: number): string {
  // 31337 only ever exists on the machine running `pnpm dev:local`.
  if (chainId === SlotsChain.ANVIL) return LOCAL_API_URL;
  // One endpoint serves every chain; the environment picks which instance.
  // `NEXT_PUBLIC_PONDER_URL` still wins, for pointing a branch at a one-off.
  return process.env.NEXT_PUBLIC_PONDER_URL || apiUrlFor(ENVIRONMENT);
}

// There is deliberately no INDEXER_API_KEY here. Ponder serves the GraphQL API
// unauthenticated, and a `NEXT_PUBLIC_` key is inlined into the client bundle —
// so it was a credential handed to every visitor in exchange for nothing.

/**
 * How the indexer classifies an address.
 *
 * Mirrors `accountType` in `packages/ponder/ponder.schema.ts`. It used to come
 * from the SDK's graphql-codegen output, which was generated against the
 * RETIRED protocol's schema — the same file this app already avoids for slot
 * types, for the same reason.
 */
export type AccountType = "EOA" | "CONTRACT" | "DELEGATED" | "SPLIT";
