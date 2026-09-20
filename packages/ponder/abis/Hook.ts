/**
 * The one function an app has to answer.
 *
 * `manifest(config)` is what the slot reads and copies when an app attaches;
 * it is the only part of ISlotApp this indexer ever calls: everything else on
 * the interface is a callback the slot makes, never something we ask about.
 *
 * Hand-written rather than copied from a concrete app's ABI, because there is
 * no canonical app contract — MinimumTenureApp and AdLand are two
 * implementations among however many people write, and the interface is the
 * only thing all of them share.
 */
export const SlotHookAbi = [
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
