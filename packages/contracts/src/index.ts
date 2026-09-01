// Main entry point for @0xslots/contracts

import type { Chain } from "viem";
import { anvil, base, baseSepolia } from "viem/chains";
import { slotFactoryAddress } from "./addresses";
import { slotsFactoryAddress } from "./slots";

// Re-export ABIs
export {
  batchCollectorAbi,
  erc721SlotsAbi,
  slotAbi,
  slotFactoryAbi,
} from "./abis";
export { feedModuleAbi } from "./abis/feed-module";
export { offerBookAbi } from "./abis/offerBook";
export { feedRouterAbi } from "./abis/feed-router";
export { feedSocialGroupAbi } from "./abis/feed-social-group";
export { metadataModuleAbi } from "./abis/metadata-module";
export { minimumPricePolicyAbi } from "./abis/minimumPricePolicy";
export { minimumPricePolicyFactoryAbi } from "./abis/minimumPricePolicyFactory";
export { minimumTenurePolicyFactoryAbi } from "./abis/minimumTenurePolicyFactory";
export { policyFactoryAbi } from "./abis/policyFactory";
export { slotCollectiveAbi } from "./abis/slotCollective";
export { slotCollectiveFactoryAbi } from "./abis/slotCollectiveFactory";
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
  offerBookAddress,
  MINIMUM_TENURE_POLICY_FACTORY,
  POLICY_FACTORIES,
  publisherUrdAddress,
  type SupportedChainId,
  slotCollectiveFactoryAddress,
  slotFactoryAddress,
  urdFactoryAddress,
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
 * Chains where the protocol is actually deployed.
 *
 * Derived from `slotsFactoryAddress` — the hook-based factory — and not from
 * the retired `slotFactoryAddress`, which is what it read before. That is the
 * whole bug: the selector offered every chain the OLD protocol reached, so
 * picking one loaded an explorer against a factory that does not exist there
 * and rendered an empty page. A chain nobody can use should not be in the
 * list; it is not a disabled option, it is a wrong one.
 *
 * Anvil is offered only in development. `NODE_ENV` is inlined by the bundler,
 * so a production build drops it at compile time rather than shipping a chain
 * option that resolves to nobody's localhost.
 */
export const CHAINS = Object.keys(slotsFactoryAddress)
  .map((id) => CHAIN_MAP[Number(id)])
  .filter((c): c is Chain => c !== undefined)
  .filter((c) => c.id !== anvil.id || process.env.NODE_ENV === "development");

/** Default chain — first chain with a deployed contract */
export const DEFAULT_CHAIN = CHAINS[0] ?? baseSepolia;

/**
 * Whether the protocol is deployed on `chainId`.
 *
 * For the cases a list cannot express: a wallet already connected to a chain
 * the protocol has never been deployed on. The selector will not offer it, but
 * the wallet can still be sitting on it, and the honest thing is to say so
 * rather than render an explorer with nothing in it.
 */
export function isDeployedOn(chainId: number): boolean {
  return Boolean(slotsFactoryAddress[chainId]);
}
