// Entry point for the hook-based Slots protocol.
//
// A SEPARATE subpath rather than more names on the root, because both protocols
// have a `slotAbi` and a `slotFactoryAbi` and they are not compatible. Merging
// them would force a rename on one side, and the side that gets renamed is the
// one every existing import already uses. `@0xslots/contracts/slots` keeps the
// obvious names for the protocol that survives and costs the old one nothing.
export {
  compositeHookAbi,
  minimumTenureHookAbi,
  minimumTenureHookFactoryAbi,
  // Discovery for signed sell orders — the count, the board, and the best bid
  // as a ready `(SellOrder, signature)` pair.
  offerBookAbi,
  slotAbi,
  slotFactoryAbi,
  // Evict-and-take, composed from OUTSIDE the slot. `liquidateAndTake` was a
  // core entry point and is not one any more; this is where it lives.
  slotTakerAbi,
  slotCollectiveFactoryAbi,
} from "./abis/slots";

import type { Address } from "viem";
import { anvil, baseSepolia } from "viem/chains";

/**
 * The hook-protocol `SlotFactory`, by chain.
 *
 * Deliberately its own table rather than an entry in `slotFactoryAddress`:
 * the two protocols' factories share a name and share nothing else, and a
 * client that resolved the wrong one would deploy a slot the rest of the app
 * cannot read. Local only for now — this protocol has not been deployed to a
 * public chain.
 *
 * The anvil address is CREATE2, from `script/protocol/DeployProtocol.s.sol` —
 * the same script every testnet uses, so a local address is a real address and
 * does not move when the deploy order changes.
 */
export const slotsFactoryAddress: Partial<Record<number, Address>> = {
  [anvil.id]: "0x4eA78564682e798c667EdB24723D0A6ec4F5caAD",
  [baseSepolia.id]: "0xAd348684dc13127C18e2b96d7FFdC0cC6B3E2dAA",
};

/**
 * The `MinimumTenureHookFactory`, by chain.
 *
 * One canonical `MinimumTenureHook` per configuration, deployed on demand: a
 * creator picks a duration in the UI and gets a hook for it without anybody
 * deploying one by hand, and the second slot to want that duration reuses the
 * first slot's hook rather than paying for its own.
 *
 * `predict(tenureSeconds)` is a `view`, so a client resolves the address with
 * no transaction and only sends `getOrDeploy` when `isDeployed` says nothing is
 * there yet.
 *
 * The anvil address is CREATE2, from `script/protocol/DeployProtocol.s.sol`.
 * Deploy order no longer moves it — that used to be the reason this one had to
 * be deployed last.
 */
export const minimumTenureHookFactoryAddress: Partial<Record<number, Address>> =
  {
    [anvil.id]: "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853",
  };

/**
 * The `SlotTaker` for a chain, if one is deployed there.
 *
 * Evict-and-take, from outside the core. `Slot.liquidateAndTake` existed
 * briefly and was removed under audit: "evict, then buy" composes from two
 * public entry points, and the core carrying a second seating path meant a
 * second quote and a second set of invariants to keep in step with `buy`. The
 * only thing composition could not reach was a NATIVE slot, because OZ's
 * `Multicall` is non-payable — so this contract is payable and forwards value,
 * and an ERC-20 slot still composes through the inherited `multicall`.
 *
 * Optional per chain, exactly like the book. A chain without one can still
 * evict and take on ERC-20; it is native slots that lose the atomic path.
 *
 * The anvil address is CREATE2, from `script/protocol/DeployProtocol.s.sol` —
 * recorded in `apps/contracts/deployments/31337/SlotTaker.json`. It matches the
 * base-sepolia address because CREATE2 makes it chain-independent.
 */
export const slotTakerAddress: Partial<Record<number, Address>> = {
  [anvil.id]: "0x5c66E3Abdb742647E971598be63f91120E07876f",
  [baseSepolia.id]: "0x5c66E3Abdb742647E971598be63f91120E07876f",
};

/**
 * The on-chain `OfferBook` for a chain, if one is deployed there.
 *
 * Discovery, not settlement. A signed sell order is how a sale SETTLES — the
 * occupant passes `(order, signature)` to `Slot.sell` — and this is how a bid
 * is FOUND: bidders post their signed terms here, anyone can read the book, and
 * the occupant accepts the best. The book never executes and never custodies
 * funds; it holds signatures and the metadata needed to rank them.
 *
 * Optional per chain. A chain without one simply has no public book, and the
 * private hand-over path (paste an order the bidder sent you) still works.
 */
/**
 * The PORTED collective factory — the one that speaks `proposeTerms`.
 *
 * Its own table rather than an entry in `slotCollectiveFactoryAddress`, which
 * still points at the pre-port deployment on base mainnet. Two contracts with
 * the same name and incompatible surfaces should not share a lookup; the
 * indexer had to grow a `version` discriminator for exactly this reason.
 */
export const slotsCollectiveFactoryAddress: Partial<Record<number, Address>> = {
  [anvil.id]: "0x6401a34bE3f440a7293a03e1E0F9E173a303be41",
  [baseSepolia.id]: "0xFc3B6B846feEccbB7Fe53C8151d67BAd77A20c93",
};

export const offerBookAddress: Partial<Record<number, Address>> = {
  [anvil.id]: "0xd4a800Ff4E72F5486bCb26E97C63358241CeF84d",
  [baseSepolia.id]: "0xC8b5Fb19F5bF22105FB037aCD874CA7Fd2D562Ba",
};

/**
 * A hook a client can offer by name instead of asking for an address.
 *
 * Advisory only, exactly like the factory's `attestedHooks`: a slot may point
 * at any address with code, and this list records what we can describe rather
 * than what is permitted.
 */
export interface KnownHook {
  address: Address;
  name: string;
  /** One line, written for whoever is about to attach it to their slot. */
  description: string;
}

export const knownHooks: Partial<Record<number, readonly KnownHook[]>> = {
  [anvil.id]: [
    {
      address: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
      name: "Minimum tenure — 7 days",
      description:
        "Nobody may buy the slot out from under its occupant for 7 days, and the occupant funds that window up front. Liquidation is untouched.",
    },
  ],
};

/** The known hook at `address`, if this client can name it. */
export function findKnownHook(
  chainId: number,
  address: Address | undefined,
): KnownHook | undefined {
  if (!address) return undefined;
  return knownHooks[chainId]?.find(
    (h) => h.address.toLowerCase() === address.toLowerCase(),
  );
}
