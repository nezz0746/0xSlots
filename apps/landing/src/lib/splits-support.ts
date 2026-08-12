import { SlotsChain } from "@0xslots/sdk";

/**
 * Whether 0xSplits can be asked about this chain.
 *
 * `useSplitsClient` builds a read client eagerly and throws
 * `Unsupported chain: <id>` for anything outside its own deployment list — so
 * on a local anvil the whole provider tree fails to mount, not just the splits
 * feature. Guarding at the call site keeps that a missing capability rather
 * than a crashed page.
 */
export function splitsSupported(chainId: number): boolean {
  return chainId !== SlotsChain.ANVIL;
}
