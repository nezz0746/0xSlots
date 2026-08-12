import type { Chain } from "viem";
import { anvil, base, baseSepolia } from "viem/chains";

/**
 * All chains for the app: DEFAULT_CHAIN first, then remaining protocol chains.
 * ENS resolution uses a standalone mainnet client (see apps/landing/src/lib/ens.ts).
 */
const isDev = process.env.NODE_ENV === "development";

/**
 * Anvil is appended in development only, and last so it never becomes the
 * default. It has no Alchemy subdomain, so `alchemyTransport` falls through to
 * `http()` and viem uses the chain's own default RPC — http://127.0.0.1:8545,
 * which is exactly where `pnpm dev:local` puts it.
 */
export const appChains = (isDev ? [base, baseSepolia, anvil] : [base, baseSepolia]) as [
  Chain,
  ...Chain[],
];
