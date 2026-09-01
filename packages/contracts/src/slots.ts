// Entry point for the hook-based Slots protocol.
//
// A SEPARATE subpath rather than more names on the root, because both protocols
// have a `slotAbi` and a `slotFactoryAbi` and they are not compatible. Merging
// them would force a rename on one side, and the side that gets renamed is the
// one every existing import already uses. `@0xslots/contracts/slots` keeps the
// obvious names for the protocol that survives and costs the old one nothing.
export {
  compositeHookAbi,
  minimumTenureHookAbi,
  slotAbi,
  slotFactoryAbi,
} from "./abis/slots";
