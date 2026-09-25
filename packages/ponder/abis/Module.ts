/**
 * The one function a module has to answer.
 *
 * `scopes(settings)` is what the slot reads and copies when a module attaches;
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
    name: "scopes",
    inputs: [{ name: "settings", type: "bytes" }],
    outputs: [{ name: "", type: "uint16" }],
    stateMutability: "view",
  },
] as const;
