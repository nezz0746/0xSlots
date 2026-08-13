import { SlotsChain } from "@0xslots/sdk";

/**
 * Whether `@adland/react` can render a live ad for this chain.
 *
 * Its `<Ad slot=...>` builds a read client in a `useMemo` and throws
 * `Unsupported chain: <id>` outside its own base / base-sepolia map, taking the
 * whole page down rather than the ad.
 *
 * The library looks configurable but is not: `AdlandProvider` destructures a
 * fixed set of keys — endpoint, gateway, rpcUrl, chainId, consent, onEvent,
 * baseLinkUrl — and `chains` is not among them, so a `chains` prop is silently
 * dropped and `createReadClient` always falls back to its default map. Guarding
 * at the render site is therefore the only fix available from outside the
 * package.
 *
 * `<Ad data=...>` is unaffected: the client is only built when `slot` is set.
 */
export function adlandSupported(chainId: number): boolean {
  return chainId !== SlotsChain.ANVIL;
}
