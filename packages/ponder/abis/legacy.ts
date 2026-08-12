/**
 * The pre-occupancy-layer `SlotDeployed`.
 *
 * `SlotConfig` gained `mutablePolicy` and `SlotInitParams` gained
 * `occupancyPolicy`. That changed both tuple types, and therefore topic0 — the
 * two are distinct events that happen to share a name.
 *
 * This is not dead history. As of the last full-range scan of both topic0s
 * there are 64 slots on base and 237 on base-sepolia under this signature,
 * against exactly one each under the current one — 301 of 303 slots. Indexing
 * only the current signature yields two slots in total, never registers the
 * other 301 as `factory()` children (so none of their events index either), and
 * silently voids the metadata pipeline, since `applyMetadataUpdate` returns
 * early when the slot row is missing.
 *
 * Kept hand-written rather than imported from @0xslots/contracts, because that
 * package tracks the CURRENT contracts and has no reason to carry history.
 */
export const slotFactoryLegacyAbi = [
  {
    type: "event",
    name: "SlotDeployed",
    inputs: [
      { name: "slot", type: "address", indexed: true, internalType: "address" },
      {
        name: "recipient",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "currency",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "config",
        type: "tuple",
        indexed: false,
        internalType: "struct SlotConfig",
        components: [
          { name: "mutableTax", type: "bool", internalType: "bool" },
          { name: "mutableUtility", type: "bool", internalType: "bool" },
          { name: "manager", type: "address", internalType: "address" },
        ],
      },
      {
        name: "initParams",
        type: "tuple",
        indexed: false,
        internalType: "struct SlotInitParams",
        components: [
          { name: "taxPercentage", type: "uint256", internalType: "uint256" },
          { name: "utility", type: "address", internalType: "address" },
          {
            name: "liquidationBountyBps",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "minDepositSeconds",
            type: "uint256",
            internalType: "uint256",
          },
        ],
      },
    ],
    anonymous: false,
  },
] as const;
