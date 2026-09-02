// The Slots protocol's ABIs and addresses.
//
// Almost everything here comes straight from `./generated`, which
// `wagmi generate` writes from the Foundry build and the deployment records.
// This file exists for the four things codegen cannot know: the widened types,
// what to do when a contract is deployed nowhere, which hooks to offer by name,
// and the one address no deploy script writes.

import type { Address } from "viem";
import { anvil } from "viem/chains";
import * as generated from "./generated";

/** Everything wagmi generated: every ABI, every address map, every config. */
export * from "./generated";

/**
 * An address map from the generated module, or an empty one.
 *
 * Two jobs. It WIDENS — wagmi emits `{ 84532: "0x…" } as const`, and every
 * consumer looks up a chain id known only at runtime, so the honest type is
 * `Address | undefined`.
 *
 * And it tolerates ABSENCE. wagmi emits `<name>Address` only for contracts that
 * have a deployment record, so the set of exports changes with whichever chains
 * the machine running codegen knows about. Importing by name meant a regenerate
 * on a never-seeded machine deleted an export this file imports and the package
 * stopped compiling — one person's local state breaking everyone's build.
 * Deployed nowhere is a legitimate answer, and it is an empty map.
 */
const map = (name: string): Partial<Record<number, Address>> =>
  ((generated as unknown as Record<string, unknown>)[name] ?? {}) as Partial<
    Record<number, Address>
  >;

export const slotFactoryAddress = map("slotFactoryAddress");
export const offerBookAddress = map("offerBookAddress");
export const slotCollectiveFactoryAddress = map("slotCollectiveFactoryAddress");
export const adLandAddress = map("adLandAddress");

/** Local-only, written by `SeedSlots` — absent on a machine that never seeded. */
export const slotsTestTokenAddress = map("slotsTestTokenAddress");
export const minimumTenureHookAddress = map("minimumTenureHookAddress");

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

export interface KnownHook {
  address: Address;
  name: string;
  /** One line, written for whoever is about to attach it to their slot. */
  description: string;
}

/**
 * The hooks this client can offer BY NAME, per chain.
 *
 * Derived, not typed. This was a hand-written array with one entry, for anvil,
 * naming an address the local deploy had long since stopped producing — so the
 * only hook the dropdown ever offered by name was a dead one, and no hook was
 * offered on any real chain at all. A hook now appears on exactly the chains it
 * is deployed to, because the deployment records say so.
 *
 * Adding a hook is one entry here plus a line in `DeployProtocol`. It then
 * appears on every chain the protocol reaches, with no per-chain edit.
 */
const catalogue: readonly {
  addresses: Partial<Record<number, Address>>;
  name: string;
  description: string;
}[] = [
  {
    addresses: adLandAddress,
    name: "AdLand — publish a creative",
    description:
      "The occupant publishes an image or URI that renders in the slot, and it retires the moment the slot changes hands. Buying and publishing can be done in one transaction.",
  },
];

export const knownHooks: Partial<Record<number, readonly KnownHook[]>> = (() => {
  const out: Record<number, KnownHook[]> = {};
  for (const c of catalogue)
    for (const [id, address] of Object.entries(c.addresses)) {
      (out[Number(id)] ??= []).push({
        address: address as Address,
        name: c.name,
        description: c.description,
      });
    }
  return out;
})();

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
