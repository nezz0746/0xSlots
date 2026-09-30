import type { Abi } from "viem";

/**
 * The two reads every module answers, whichever module it is: what it asks
 * for, given some settings. From `ISlotModule`, declared here rather than
 * borrowed from one module's generated ABI, so no reader depends on a
 * particular module existing.
 */
export const moduleAbi = [
  {
    type: "function",
    name: "scopes",
    stateMutability: "view",
    inputs: [{ name: "settings", type: "bytes" }],
    outputs: [{ type: "uint16" }],
  },
  {
    type: "function",
    name: "fee",
    stateMutability: "view",
    inputs: [{ name: "settings", type: "bytes" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "bps", type: "uint16" },
          { name: "recipient", type: "address" },
        ],
      },
    ],
  },
] as const satisfies Abi;
