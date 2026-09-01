import {
  minimumTenureHookFactoryAbi,
  minimumTenureHookFactoryAddress,
  offerBookAbi,
  offerBookAddress,
  slotCollectiveFactoryAbi,
  slotFactoryAbi as slotsFactoryAbi,
  slotTakerAbi,
  slotTakerAddress,
  slotsCollectiveFactoryAddress,
  slotsFactoryAddress,
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
};

export const CONTRACTS: ContractEntry[] = [
  {
    name: "SlotFactory",
    role: "Creates slots; owns the beacon every slot delegates to",
    address: (c) => slotsFactoryAddress[c],
    abi: slotsFactoryAbi as Abi,
    hasVersion: true,
    adminFn: "admin",
    implFn: "implementation",
    upgradeable: true,
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
    address: (c) => slotsCollectiveFactoryAddress[c],
    abi: slotCollectiveFactoryAbi as Abi,
    hasVersion: true,
    adminFn: "admin",
    upgradeable: true,
  },
  {
    name: "MinimumTenureHookFactory",
    role: "Deterministic hooks — one address per tenure",
    address: (c) => minimumTenureHookFactoryAddress[c],
    abi: minimumTenureHookFactoryAbi as Abi,
    hasVersion: false,
    upgradeable: false,
  },
  {
    name: "SlotTaker",
    role: "Evict and take in one transaction, on native slots",
    address: (c) => slotTakerAddress[c],
    abi: slotTakerAbi as Abi,
    hasVersion: false,
    upgradeable: false,
  },
];
