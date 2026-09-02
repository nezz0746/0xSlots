// The Slots protocol, for TypeScript.
//
// ── V1 is gone from here ────────────────────────────────────────────────────
//
// This root used to be the RETIRED protocol's surface — its ABIs, its
// addresses, its feed and policy modules — while the live one hid behind a
// `/slots` subpath. Both exported a `slotAbi`, a `slotFactoryAbi` and a
// `slotCollectiveAbi`, and they were not compatible.
//
// That collision was not theoretical. Three pages in the app imported
// `slotCollectiveAbi` from here and called it against a V2 collective: 14
// functions where the contract has 41, one of which (`UTILITY_MANAGER_ROLE`)
// does not exist on the deployed contract at all. It reverted, and nothing in
// the import named the reason.
//
// The V1 Solidity is still in `apps/contracts/src/v1` — it is deployed and it
// is somebody's money. What is gone is the TypeScript that spoke to it.
import type { Chain } from "viem";
import { anvil, base, baseSepolia } from "viem/chains";
import { slotFactoryAddress } from "./slots";

/** Every ABI, address and helper for the live protocol. */
export * from "./slots";

const CHAIN_MAP: Record<number, Chain> = {
  [anvil.id]: anvil,
  [base.id]: base,
  [baseSepolia.id]: baseSepolia,
};

/**
 * Chains where the protocol is actually deployed.
 *
 * Derived from `slotFactoryAddress` — the hook-based factory — and not from
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
/**
 * Local first, then testnets, then mainnets.
 *
 * Ordered deliberately, because the order decides `DEFAULT_CHAIN` and the
 * default is what a developer gets before touching anything. This used to fall
 * out of `Object.keys`, which sorts integer-like keys ASCENDING — so the moment
 * the protocol was deployed to Base, 8453 sorted ahead of 31337 and every local
 * run silently defaulted to mainnet. Nothing in the diff said so; the deployment
 * did it.
 */
const rank = (c: Chain) => (c.id === anvil.id ? 0 : c.id === baseSepolia.id ? 1 : 2);

export const CHAINS = Object.keys(slotFactoryAddress)
  .map((id) => CHAIN_MAP[Number(id)])
  .filter((c): c is Chain => c !== undefined)
  .filter((c) => c.id !== anvil.id || process.env.NODE_ENV === "development")
  .sort((a, b) => rank(a) - rank(b));

/**
 * Default chain — the least consequential one that is deployed.
 *
 * Anvil in development, a testnet otherwise. Never a mainnet by accident.
 */
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
  return Boolean(slotFactoryAddress[chainId]);
}
