// Chain and endpoint identity for the Slots SDK.
//
// Split out of `client.ts`, which paired these with a GraphQL client for the
// RETIRED protocol's schema. That client is gone. These are not V1: every
// consumer needs `SlotsChain` and an endpoint regardless of which protocol it
// speaks to.

// ─── Chain Config ─────────────────────────────────────────────────────────────

export enum SlotsChain {
  BASE = 8453,
  BASE_SEPOLIA = 84532,
  /** Local anvil — see `pnpm dev:local` at the repo root. */
  ANVIL = 31337,
}

/**
 * Which deployment of the indexer to read.
 *
 * Not a chain. ONE url serves every chain — that is the shape change that
 * matters most in the move off the subgraph: a subgraph is one deployment per
 * network, so the SDK used to carry a `Record<SlotsChain, string>` and pick by
 * chain. Ponder indexes every chain into one database, so the chain is a
 * `where: { chainId }` filter on the query — see `withChain`.
 *
 * What DOES vary is which instance you are pointed at, and that tracks the
 * branch rather than the chain: `development` follows `develop` and indexes
 * whatever has just been deployed to a testnet, `production` follows `main`.
 * Naming it an environment says that out loud; a bare URL override said
 * nothing and had to be remembered per deployment.
 */
export type SlotsEnvironment = "production" | "development";

export const API_URLS: Record<SlotsEnvironment, string> = {
  production: "https://0xslots-production.up.railway.app/graphql",
  development: "https://0xslots-dev.up.railway.app/graphql",
};

/**
 * The default read endpoint.
 *
 * Production, deliberately: a consumer who says nothing should get the stable
 * instance. Development is opt-in, because pointing at it by accident means
 * reading a database that is rebuilt whenever a testnet is redeployed.
 */
export const DEFAULT_API_URL = API_URLS.production;

/** Resolve an environment to its endpoint. */
export function apiUrlFor(env: SlotsEnvironment = "production"): string {
  return API_URLS[env];
}

/** The local indexer `pnpm dev:local` starts, for chain 31337. */
export const LOCAL_API_URL = "http://localhost:42069/graphql";
