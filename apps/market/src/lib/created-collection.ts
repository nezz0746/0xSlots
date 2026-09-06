import { slotBoundNftFactoryAbi } from "@0xslots/contracts/slots";
import { type Address, parseEventLogs, type TransactionReceipt } from "viem";

/**
 * The address a `createCollection` receipt just brought into being.
 *
 * The factory deploys with plain `new`, so the address exists only in its own
 * log — there is nothing to predict beforehand and nothing the SDK returns but
 * a hash. Decoded from the receipt rather than read back from the indexer,
 * which has not seen the block yet at the moment this is needed.
 */
export function createdCollection(
  receipt: TransactionReceipt,
): Address | undefined {
  const [event] = parseEventLogs({
    abi: slotBoundNftFactoryAbi,
    eventName: "CollectionCreated",
    logs: receipt.logs,
  });
  return event?.args.collection;
}
