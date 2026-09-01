// Unified client (read + write)

export type { SellOrder } from "./client";
export {
  type BuyParams,
  type ChainStatus,
  type CreateSlotParams,
  type CreateSlotsParams,
  createSlotsClient,
  DEFAULT_API_URL,
  API_URLS,
  apiUrlFor,
  type IndexerMeta,
  LOCAL_API_URL,
  SELL_ORDER_TYPES,
  type SlotConfig,
  type SlotInitParams,
  SlotsChain,
  SlotsClient,
  type SlotsClientConfig,
  UpdateKind,
} from "./client";
// Errors
export { SlotsError } from "./errors";
// Re-export generated types and SDK
export * from "./generated/graphql";
export { FeedModuleClient } from "./modules/feed";
// Modules
export { MetadataModuleClient } from "./modules/metadata";
// Occupancy policies — resolve an address into human-readable terms, plus
// accessors over the hand-vouched list. See ./policies.
//
// The raw VOUCHED_POLICIES record is deliberately NOT exported: it is keyed by
// lowercase address and carries a chainId that every caller must respect, and
// both are easy to get wrong by hand. Go through the accessors.
export {
  formatDuration,
  getVouchedPolicy,
  type PolicyImpact,
  type PolicyKindId,
  type ResolvedPolicy,
  resolvePolicy,
  searchVouchedPolicies,
  type VouchedPolicy,
  type VouchedPolicyEntry,
  vouchedPoliciesForChain,
} from "./policies";
// Tokens
export {
  CHAIN_TOKENS,
  getChainTokens,
  getDefaultToken,
  getFaucetToken,
  isNativeCurrency,
  NATIVE_CURRENCY,
  NATIVE_CURRENCY_ADDRESS,
  type TokenInfo,
} from "./tokens";

export type { SlotsEnvironment } from "./client";
