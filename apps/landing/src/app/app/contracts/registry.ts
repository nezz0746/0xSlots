import {
  minimumTenureHookFactoryAbi,
  minimumTenureHookFactoryAddress,
  offerBookAbi,
  offerBookAddress,
  slotAbi,
  slotCollectiveAbi,
  slotCollectiveFactoryAbi,
  slotFactoryAbi as slotsFactoryAbi,
  slotCollectiveFactoryAddress,
  slotFactoryAddress,
} from "@0xslots/contracts/slots";
import type { Abi, Address } from "viem";

/**
 * What the contracts page knows how to describe.
 *
 * Each entry says where the address comes from and which of the three
 * questions it can answer. They are deliberately optional: a stateless
 * periphery contract has no version and no admin, and rendering "—" for it is
 * more honest than inventing a zero.
 */
export type ContractEntry = {
  name: string;
  /** What it is for, in one line. */
  role: string;
  address: (chainId: number) => Address | undefined;
  abi: Abi;
  /** Upgradeable contracts carry a version; stateless ones do not. */
  hasVersion: boolean;
  /** Who may upgrade it, where that is a question at all. */
  adminFn?: "admin";
  upgradeable: boolean;
  /** True when this contract owns an `UpgradeableBeacon`. */
  ownsBeacon?: boolean;
};

/**
 * An implementation that lives behind a beacon.
 *
 * These are rows in their own right, not a footnote on the factory that owns
 * them. A beacon implementation is the code every proxy of its kind actually
 * runs — hundreds of them, upgraded together in one transaction — so it is the
 * largest blast radius on this page and deserves the same three answers as
 * anything else: where it is, which version, and who can replace it.
 *
 * Its address is not read from the package. It is asked of the chain, through
 * the beacon the factory owns, because that is the address the proxies resolve
 * and the only one that is true by construction.
 */
export type BeaconImplementation = {
  name: string;
  role: string;
  /** The `ContractEntry.name` of the factory whose beacon serves this. */
  owner: string;
  /** Read `version()` through this. */
  abi: Abi;
};

export const BEACON_IMPLEMENTATIONS: BeaconImplementation[] = [
  {
    name: "Slot",
    role: "The code every slot runs",
    owner: "SlotFactory",
    abi: slotAbi as Abi,
  },
  {
    name: "SlotCollective",
    role: "The code every collective runs",
    owner: "SlotCollectiveFactory",
    abi: slotCollectiveAbi as Abi,
  },
];

/**
 * `UpgradeableBeacon.implementation()`.
 *
 * Read from the beacon itself rather than through the factory, because only one
 * of the two factories forwards it — `SlotFactory` has `implementation()`,
 * `SlotCollectiveFactory` only hands back its beacon. Asking the beacon works
 * for both and is the address the proxies actually resolve.
 */
export const beaconAbi = [
  {
    type: "function",
    name: "implementation",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
] as const satisfies Abi;

export const CONTRACTS: ContractEntry[] = [
  {
    name: "SlotFactory",
    role: "Creates slots; owns the beacon every slot delegates to",
    address: (c) => slotFactoryAddress[c],
    abi: slotsFactoryAbi as Abi,
    hasVersion: true,
    adminFn: "admin",
    upgradeable: true,
    ownsBeacon: true,
  },
  {
    name: "OfferBook",
    role: "Standing bids — discovery, not settlement",
    address: (c) => offerBookAddress[c],
    abi: offerBookAbi as Abi,
    hasVersion: true,
    adminFn: "admin",
    upgradeable: true,
  },
  {
    name: "SlotCollectiveFactory",
    role: "Creates collectives that govern and are paid by slots",
    address: (c) => slotCollectiveFactoryAddress[c],
    abi: slotCollectiveFactoryAbi as Abi,
    hasVersion: true,
    adminFn: "admin",
    upgradeable: true,
    ownsBeacon: true,
  },
  {
    name: "MinimumTenureHookFactory",
    role: "Deterministic hooks — one address per tenure",
    address: (c) => minimumTenureHookFactoryAddress[c],
    abi: minimumTenureHookFactoryAbi as Abi,
    hasVersion: false,
    upgradeable: false,
  },
];
