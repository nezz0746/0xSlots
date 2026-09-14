// The Slots protocol's ABIs and addresses.
//
// Almost everything here comes straight from `./generated`, which
// `wagmi generate` writes from the Foundry build and the deployment records.
// This file exists for the four things codegen cannot know: the widened types,
// what to do when a contract is deployed nowhere, which hooks to offer by name,
// and the one address no deploy script writes.

import type { Address } from "viem";
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

/**
 * The beacon implementations, widened.
 *
 * Named for what they are. wagmi derives `slotAddress` from the contract name,
 * which reads like "the address of a slot" — but a slot is a proxy the factory
 * deploys per position, and there are hundreds. This is the single
 * implementation they all delegate to through the beacon, and nobody should be
 * pointing a UI at it thinking otherwise.
 */
export const slotImplementationAddress = map("slotAddress");
export const slotCollectiveImplementationAddress = map("slotCollectiveAddress");

/** Local-only, written by `SeedSlots` — absent on a machine that never seeded. */
export const slotsTestTokenAddress = map("slotsTestTokenAddress");

/**
 * The block a contract was deployed at, or `undefined` where no record exists.
 *
 * The lower bound for any historical log query, and the reason this is exported
 * at all. `getLogs` with no `fromBlock` means the chain's GENESIS — 51 million
 * blocks on Base — and the explorer had one of those on an eight-second timer,
 * which is a full-history scan per poll, per open tab.
 *
 * `undefined` is a real answer and callers must handle it: a contract deployed
 * nowhere has no block, and a machine that has never seeded has no local record.
 * Returning 0 instead would be the genesis scan wearing a fix.
 *
 * Named by CONTRACT rather than by address map, because the generated maps are
 * renamed here (`slotAddress` → `slotImplementationAddress`) while the records
 * keep the Foundry name.
 */
export function deployBlockOf(
  contract: keyof typeof generated.deployBlocks,
  chainId: number,
): bigint | undefined {
  const byChain = generated.deployBlocks[contract] as
    | Partial<Record<number, number>>
    | undefined;
  const block = byChain?.[chainId];
  return block === undefined ? undefined : BigInt(block);
}

/**
 * The one `MinimumTenureHook` per chain.
 *
 * ONE, now, where there used to be one per duration behind a CREATE2 factory.
 * The window a slot enforces is its own `hookData`, so every duration is served
 * by this address — which is why the factory, the predicted-address dance and
 * the "this duration is not deployed yet, expect two transactions" branch in
 * the create form are all gone.
 *
 * A client attaching it supplies the duration as `hookData`, 32 bytes,
 * big-endian seconds. The hook refuses zero, at creation, rather than attaching
 * and vetoing every buy afterwards.
 */
export const minimumTenureHookAddress = map("minimumTenureHookAddress");

export interface KnownHook {
  address: Address;
  name: string;
  /** One line, written for whoever is about to attach it to their slot. */
  description: string;
  /** Who maintains it. "0xSlots" is stock; anything else is somebody else's. */
  by: string;
  /** Where the project behind the hook lives, when it has somewhere. */
  url?: string;
  /**
   * Its mark, for a client that has room to show one.
   *
   * Absolute for a third party, and app-relative for a stock hook — which
   * makes the shipping app's own logo the mark of the hooks it maintains,
   * without this package having to know which app is rendering it.
   */
  logo?: string;
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
  by: string;
  url?: string;
  logo?: string;
}[] = [
  {
    addresses: adLandAddress,
    name: "AdLand",
    description:
      "Taxed onchain standardized ad data, curated by adland.space and served by CDN on your website.",
    by: "adland.space",
    url: "https://adland.space/",
    logo: "https://adland.space/logo.png",
  },
  {
    addresses: minimumTenureHookAddress,
    name: "Minimum tenure",
    description:
      "Gives a new occupant a window they choose. Inside it, taking the slot costs a large premium on their price, and they cannot cut it.",
    by: "0xSlots",
    logo: "/logo.png",
  },
];

export const knownHooks: Partial<Record<number, readonly KnownHook[]>> =
  (() => {
    const out: Record<number, KnownHook[]> = {};
    for (const c of catalogue)
      for (const [id, address] of Object.entries(c.addresses)) {
        (out[Number(id)] ??= []).push({
          address: address as Address,
          name: c.name,
          description: c.description,
          by: c.by,
          url: c.url,
          logo: c.logo,
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
