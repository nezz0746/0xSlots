/**
 * The one function a module has to answer.
 *
 * `manifest(settings)` is what the slot reads and copies when a module attaches;
 * it is the only part of ISlotModule this indexer ever calls: everything else on
 * the interface is a callback the slot makes, never something we ask about.
 *
 * Hand-written rather than copied from a concrete module's ABI, because there is
 * no canonical module contract — MinimumTenureModule and AdLand are two
 * implementations among however many people write, and the interface is the
 * only thing all of them share.
 */
export const SlotModuleAbi = [
  {
    type: "function",
    name: "manifest",
    inputs: [{ name: "config", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "scopes", type: "uint8" },
          { name: "feeBps", type: "uint16" },
          { name: "feeRecipient", type: "address" },
        ],
      },
    ],
    stateMutability: "view",
  },
] as const;
