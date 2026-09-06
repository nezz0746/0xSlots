import { slotBoundNftFactoryAddress } from "@0xslots/contracts/slots";
import { apiUrlFor, LOCAL_API_URL, type SlotsEnvironment } from "@0xslots/sdk";
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

/** Whether this market serves the chain at all. */
export function isSupported(chainId: number): boolean {
  return CHAINS.some((c) => c.id === chainId);
}

export function chainName(chainId: number): string {
  return CHAINS.find((c) => c.id === chainId)?.name ?? `chain ${chainId}`;
}

/**
 * Which indexer instance this build reads.
 *
 * The same rule the explorer uses, and it has to be: one ponder database holds
 * every chain, so both apps read one endpoint and a build that picks a
 * different one is reading a different protocol.
 *
 * A build that says nothing gets DEVELOPMENT rather than production, because
 * the production instance still serves the retired protocol — it has no
 * `collections` field at all, so every query here would fail GraphQL
 * validation and look like a slow network rather than the wrong database.
 */
const ENVIRONMENT: SlotsEnvironment =
  process.env.NEXT_PUBLIC_SLOTS_ENV === "production"
    ? "production"
    : process.env.NEXT_PUBLIC_SLOTS_ENV === "development"
      ? "development"
      : process.env.NODE_ENV === "production"
        ? "production"
        : "development";

/**
 * Where the indexer for `chainId` lives.
 *
 * Anvil is the one chain that only ever exists on the machine running
 * `pnpm dev:local`. Every other chain is served by the deployed instance —
 * this used to fall back to localhost for those too, which meant selecting
 * Base Sepolia queried the local anvil database and got an empty list, with
 * nothing on screen saying the collections were somewhere else entirely.
 */
export function indexerUrl(chainId: number): string {
  if (chainId === anvil.id)
    return process.env.NEXT_PUBLIC_INDEXER_LOCAL ?? LOCAL_API_URL;
  return process.env.NEXT_PUBLIC_PONDER_URL || apiUrlFor(ENVIRONMENT);
}
