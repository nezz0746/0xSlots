/**
 * The one function a hook has to answer.
 *
 * `hookOffer(config)` is what the slot reads and copies when a hook attaches;
 * it is the only part of ISlotHook this indexer ever calls: everything else on
 * the interface is a callback the slot makes, never something we ask about.
 *
 * Hand-written rather than copied from a concrete hook's ABI, because there is
 * no canonical hook contract — MinimumTenureHook and AdLand are two
 * implementations among however many people write, and the interface is the
 * only thing all of them share.
 */
export const SlotHookAbi = [
  {
    type: "function",
    name: "hookOffer",
    inputs: [{ name: "config", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "permissions", type: "uint8" },
          { name: "feeBps", type: "uint16" },
          { name: "feeRecipient", type: "address" },
        ],
      },
    ],
    stateMutability: "view",
  },
] as const;
