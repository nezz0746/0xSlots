// The Slots SDK.
//
// ── V1 is gone from here ────────────────────────────────────────────────────
//
// This root used to export a GraphQL client for the RETIRED protocol's schema,
// plus its feed and metadata modules and its policy resolvers. It also exported
// a `createSlotsClient` and a `SlotsClient` — the SAME names the live protocol
// uses under `/slots`, for a completely different object: 68 query methods
// against an old indexer, where the live one has 48 that talk to contracts.
//
// Importing the wrong one type-checked. The root now IS the live protocol.
export * from "./slots";

// Chain and endpoint identity. Not protocol-specific.
export {
  API_URLS,
  DEFAULT_API_URL,
  LOCAL_API_URL,
  SlotsChain,
  apiUrlFor,
  type SlotsEnvironment,
} from "./chains";

export { SlotsError } from "./errors";

export {
  CHAIN_TOKENS,
  getChainTokens,
  getFaucetToken,
  type TokenInfo,
} from "./tokens";

export { NATIVE_CURRENCY_ADDRESS, isNativeCurrency } from "./native";
export { NATIVE_CURRENCY } from "./tokens";
