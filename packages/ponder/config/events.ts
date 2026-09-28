import { factory } from "ponder";
import { type AbiEvent, parseAbiItem } from "viem";
import type { Deployment } from "./deployments";

// The factory events each child source is discovered from. Slots, collectives
// and wrappers are BeaconProxies and collections are plain contracts, but all
// their addresses exist only in their factory's own log.

export const SLOT_CREATED_EVENT = parseAbiItem(
  "event SlotCreated(address indexed slot, address indexed recipient, address indexed creator, address currency, address module)",
);

export const COLLECTIVE_DEPLOYED_EVENT = parseAbiItem(
  "event SlotCollectiveDeployed(address indexed manager, address indexed admin, address indexed deployer)",
);

export const COLLECTION_CREATED_EVENT = parseAbiItem(
  "event CollectionCreated(address indexed collection, address indexed creator, address indexed recipient, address currency, uint256 maxSupply)",
);

export const WRAPPER_CREATED_EVENT = parseAbiItem(
  "event WrapperCreated(address indexed wrapper, address indexed creator, address indexed owner, string name, string symbol, uint256 wrapFeeWei)",
);

/**
 * The child source for each chain: every contract `event` announced by that
 * chain's factory, from the factory's own start block.
 */
export function childrenOf<const K extends string, E extends AbiEvent>(
  factories: Record<K, Deployment>,
  event: E,
  parameter: Exclude<Parameters<typeof factory<E>>[0]["parameter"], undefined>,
) {
  const out = {} as Record<
    K,
    {
      address: ReturnType<typeof factory<E>>;
      startBlock: Deployment["startBlock"];
    }
  >;
  for (const key of Object.keys(factories) as K[]) {
    const at = factories[key];
    out[key] = {
      address: factory({ address: at.address, event, parameter } as Parameters<
        typeof factory<E>
      >[0]),
      startBlock: at.startBlock,
    };
  }
  return out;
}
