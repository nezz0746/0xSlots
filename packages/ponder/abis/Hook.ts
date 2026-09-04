/**
 * The one function a hook has to answer.
 *
 * `subscriptions()` is what the slot reads and snapshots when a hook is
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
    name: "subscriptions",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "beforeBuy", type: "bool" },
          { name: "beforeSelfAssess", type: "bool" },
          { name: "afterBuy", type: "bool" },
          { name: "afterRelease", type: "bool" },
          { name: "afterLiquidate", type: "bool" },
          { name: "afterSettle", type: "bool" },
        ],
      },
    ],
    stateMutability: "view",
  },
] as const;
