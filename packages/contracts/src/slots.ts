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
} from "./abis/slots";

import type { Address } from "viem";
import { anvil } from "viem/chains";

/**
 * The hook-protocol `SlotFactory`, by chain.
 *
 * Deliberately its own table rather than an entry in `slotFactoryAddress`:
 * the two protocols' factories share a name and share nothing else, and a
 * client that resolved the wrong one would deploy a slot the rest of the app
 * cannot read. Local only for now — this protocol has not been deployed to a
 * public chain.
 *
 * The anvil address is deterministic from a fresh chain driven by account 0,
 * as `script/slots/DeploySlots.s.sol` deploys it. See
 * `docs/plans/2026-09-01-slots-local-runbook.md`.
 */
export const slotsFactoryAddress: Partial<Record<number, Address>> = {
  [anvil.id]: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
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
 * The anvil address is deterministic from a fresh chain driven by account 0, as
 * `script/slots/DeploySlots.s.sol` deploys it — LAST, so the addresses above it
 * do not move.
 */
export const minimumTenureHookFactoryAddress: Partial<Record<number, Address>> =
  {
    [anvil.id]: "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853",
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
export const offerBookAddress: Partial<Record<number, Address>> = {
  [anvil.id]: "0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6",
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
