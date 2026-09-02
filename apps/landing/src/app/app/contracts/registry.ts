import {
  minimumTenureHookFactoryAbi,
  minimumTenureHookFactoryAddress,
  offerBookAbi,
  offerBookAddress,
  slotCollectiveImplementationAddress,
  slotImplementationAddress,
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
  /** Beacon/implementation pointer, where there is one. */
  implFn?: "implementation";
  upgradeable: boolean;
  /**
   * The beacon this contract owns, if it owns one.
   *
   * A beacon is the other half of the upgrade story and the half with the
   * larger blast radius: hundreds of proxies delegate to whatever it points at,
   * and pointing it is a SEPARATE transaction from deploying the code. So the
   * deployment record naming an implementation is not evidence the beacon is
   * serving it — the two really do drift, and did.
   *
   * `expected` is the implementation the package says should be behind it.
   * Comparing that against what the beacon actually serves is the whole reason
   * this appears on the page.
   */
  beacon?: {
    /** What the proxies behind it are, in one word. */
    serves: string;
    expected: (chainId: number) => Address | undefined;
  };
};

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
    implFn: "implementation",
    upgradeable: true,
    beacon: { serves: "every slot", expected: (c) => slotImplementationAddress[c] },
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
    beacon: {
      serves: "every collective",
      expected: (c) => slotCollectiveImplementationAddress[c],
    },
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
