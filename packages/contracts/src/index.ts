// Main entry point for @0xslots/contracts

import type { Chain } from "viem";
import { anvil, base, baseSepolia } from "viem/chains";
import { slotFactoryAddress } from "./addresses";

// Re-export ABIs
export {
  batchCollectorAbi,
  erc721SlotsAbi,
  slotAbi,
  slotFactoryAbi,
} from "./abis";
export { feedModuleAbi } from "./abis/feed-module";
export { feedRouterAbi } from "./abis/feed-router";
export { feedSocialGroupAbi } from "./abis/feed-social-group";
export { metadataModuleAbi } from "./abis/metadata-module";
export { minimumPricePolicyAbi } from "./abis/minimumPricePolicy";
export { minimumPricePolicyFactoryAbi } from "./abis/minimumPricePolicyFactory";
export { minimumTenurePolicyFactoryAbi } from "./abis/minimumTenurePolicyFactory";
export { policyFactoryAbi } from "./abis/policyFactory";
// Re-export addresses and utilities
export {
  batchCollectorAddress,
  erc721SlotsAddress,
  feedHubAddress,
  feedModuleAddress,
  feedRouterAddress,
  feedSocialGroupAddress,
  getSlotsHubAddress,
  getSupportedChainIds,
  isSlotsHubDeployed,
  MINIMUM_PRICE_POLICY_FACTORY,
  MINIMUM_TENURE_POLICY_FACTORY,
  POLICY_FACTORIES,
  type SupportedChainId,
  slotFactoryAddress,
} from "./addresses";
// Re-export feed events
export { FEED_EVENT_TYPES, FeedEventType, feedEvent } from "./events";

/** Viem chain objects for known 0xSlots networks — add here when deploying to new chains */
const CHAIN_MAP: Record<number, Chain> = {
  [baseSepolia.id]: baseSepolia,
  [base.id]: base,
  [anvil.id]: anvil,
};

/**
 * Chains with deployed 0xSlots contracts (derived from slotFactoryAddress).
 *
 * Anvil is offered only in development. `NODE_ENV` is inlined by the bundler,
 * so a production build drops it at compile time rather than shipping a chain
 * option that resolves to nobody's localhost.
 */
export const CHAINS = Object.keys(slotFactoryAddress)
  .map((id) => CHAIN_MAP[Number(id)])
  .filter((c): c is Chain => c !== undefined)
  .filter((c) => c.id !== anvil.id || process.env.NODE_ENV === "development");

/** Default chain — first chain with a deployed contract */
export const DEFAULT_CHAIN = CHAINS[0] ?? baseSepolia;
