// The protocol ABIs come from the package that generates them.
//
// These were COPIES, kept in step by hand, and two of them were an entry behind
// when it was noticed — `version()` had been added to the contracts and reached
// neither. Ponder is in the same workspace and already depends on
// `@0xslots/contracts`, so there is no reason for a second copy to exist.
export {
  slotAbi as SlotAbi,
  slotCollectiveAbi as SlotCollectiveAbi,
  slotCollectiveFactoryAbi as SlotCollectiveFactoryAbi,
  slotFactoryAbi as SlotFactoryAbi,
} from "@0xslots/contracts/slots";

// Hand-written, and not generated from this protocol's build: a minimal ERC-20
// for currency reads, and the hook interface as the indexer needs to see it.
export { ERC20Abi } from "./ERC20";
export { SlotHookAbi } from "./Hook";
