import { slotBoundNftFactoryAddress } from "@0xslots/contracts/slots";
import type { Address } from "viem";
import { anvil, base, baseSepolia } from "viem/chains";

/**
 * The chains this marketplace serves.
 *
 * Base Sepolia today, Base as soon as the protocol is broadcast there. Both are
 * listed rather than one, because "add the chain later" reliably means finding
 * every place a chain id was assumed — the factory lookup below is the only
 * thing that needs to change, and it comes from the generated addresses.
 *
 * Anvil is included in development only. It is where the protocol currently
 * runs, so a build with no testnet deployment still has somewhere to point.
 */
export const CHAINS = [baseSepolia, base, anvil] as const;

export type SupportedChainId = (typeof CHAINS)[number]["id"];

export const DEFAULT_CHAIN_ID: SupportedChainId =
  process.env.NODE_ENV === "production" ? baseSepolia.id : anvil.id;

/**
 * The collection factory on a chain, or `undefined` where it is not deployed.
 *
 * Read from the generated address map rather than a constant here: the map is
 * written by the deploy, so a chain the protocol has not reached yet is
 * absent — which is the honest answer, and lets the UI say so instead of
 * pointing a wallet at nothing.
 */
export function factoryFor(chainId: number): Address | undefined {
  return (slotBoundNftFactoryAddress as Record<number, Address>)[chainId];
}

export function chainName(chainId: number): string {
  return CHAINS.find((c) => c.id === chainId)?.name ?? `chain ${chainId}`;
}

/** Where the indexer for `chainId` lives. */
export function indexerUrl(chainId: number): string {
  if (chainId === anvil.id)
    return process.env.NEXT_PUBLIC_INDEXER_LOCAL ?? "http://localhost:42069";
  return process.env.NEXT_PUBLIC_INDEXER ?? "http://localhost:42069";
}
