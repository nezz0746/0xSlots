// The Slots protocol ABIs. Hook-based; no policies, no modules, no fees.
export { slotAbi } from "./slot";
export { slotFactoryAbi } from "./slotFactory";
export { compositeHookAbi } from "./compositeHook";
export { minimumTenureHookAbi } from "./minimumTenureHook";
// Collectives, ported to the hook surface: one hook role in place of the old
// policy and utility roles, and per-dimension cancels.
export { slotCollectiveAbi } from "./slotCollective";
export { slotCollectiveFactoryAbi } from "./slotCollectiveFactory";
