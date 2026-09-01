// The Slots protocol ABIs. Hook-based; no policies, no modules, no fees.
export { slotAbi } from "./slot";
export { slotFactoryAbi } from "./slotFactory";
export { compositeHookAbi } from "./compositeHook";
export { minimumTenureHookAbi } from "./minimumTenureHook";
// One canonical MinimumTenureHook per configuration, so a creator picks a
// duration instead of deploying a hook by hand.
export { minimumTenureHookFactoryAbi } from "./minimumTenureHookFactory";
// Collectives, ported to the hook surface: one hook role in place of the old
// policy and utility roles, and per-dimension cancels.
export { slotCollectiveAbi } from "./slotCollective";
export { slotCollectiveFactoryAbi } from "./slotCollectiveFactory";
// The on-chain order book. A signed order is how a sale settles; this is
// how a bid is DISCOVERED — the count, the list, and the best to accept.
export { offerBookAbi } from "./offerBook";
// Evict-and-take, composed from outside the slot. See SlotTaker.sol for
// why this is not a core entry point.
export { slotTakerAbi } from "./slotTaker";
