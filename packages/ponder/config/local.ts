import { createConfig } from "ponder";
import {
  AdLandAbi,
  SlotAbi,
  SlotBoundNftAbi,
  SlotBoundNftFactoryAbi,
  SlotBoundNftWrapperAbi,
  SlotCollectiveAbi,
  SlotCollectiveFactoryAbi,
  SlotFactoryAbi,
} from "../abis";
import {
  fromGenesis,
  readAnvilDeployment,
  readDeployment,
} from "./deployments";
import {
  COLLECTION_CREATED_EVENT,
  COLLECTIVE_DEPLOYED_EVENT,
  childrenOf,
  SLOT_CREATED_EVENT,
  WRAPPER_CREATED_EVENT,
} from "./events";

const ANVIL_RPC = process.env.ANVIL_RPC_URL ?? "http://127.0.0.1:8545";

/**
 * An anvil chain, INSTEAD of the remote ones (PONDER_LOCAL=1). A full
 * replacement rather than an addition: pulling remote history while iterating
 * on a local chain burns a provider quota to answer questions the local chain
 * answers in seconds.
 *
 * Every source the remote config has is declared here too, even at the zero
 * address when nothing is deployed. Ponder rejects a handler whose source the
 * config does not declare, and `src/index.ts` imports every handler file
 * unconditionally — so one filter that matches nothing is cheaper than
 * conditional imports.
 */
export function buildLocalConfig() {
  // Written by `DeployProtocol.s.sol`, the same CREATE2 script the testnets use.
  const slotFactory = fromGenesis(
    readDeployment("SLOTS_FACTORY_ANVIL", "SLOTS_START_BLOCK_ANVIL", 31337),
    "SLOTS_START_BLOCK_ANVIL",
  );
  const adLand = fromGenesis(
    readDeployment("ADLAND_ANVIL", "ADLAND_START_BLOCK_ANVIL", 31337, "AdLand"),
    "ADLAND_START_BLOCK_ANVIL",
  );
  // These two can come from a second script against an already-running chain,
  // so they are resolved and announced separately. See `readAnvilDeployment`.
  const collectiveFactory = readAnvilDeployment(
    "SLOTS_COLLECTIVE_FACTORY_ANVIL",
    "SLOTS_COLLECTIVE_START_BLOCK_ANVIL",
    "SlotCollectiveFactory",
    "collective factory",
    "set SLOTS_COLLECTIVE_FACTORY_ANVIL, or run script/slots/DeployAndDriveCollective.s.sol",
  );
  const nftFactory = readAnvilDeployment(
    "SLOTS_NFT_FACTORY_ANVIL",
    "SLOTS_NFT_START_BLOCK_ANVIL",
    "SlotBoundNFTFactory",
    "nft factory",
  );

  const anvil = <T>(at: T) => ({ anvil: at });

  return createConfig({
    chains: {
      anvil: {
        id: 31337,
        rpc: ANVIL_RPC,
        // A fresh anvil reuses block numbers from the previous run with
        // entirely different contents, so a warm cache serves the old chain's
        // blocks for the new one.
        disableCache: true,
      },
    },
    contracts: {
      SlotFactory: { abi: SlotFactoryAbi, chain: anvil(slotFactory) },
      Slot: {
        abi: SlotAbi,
        chain: childrenOf(anvil(slotFactory), SLOT_CREATED_EVENT, "slot"),
      },
      SlotCollectiveFactory: {
        abi: SlotCollectiveFactoryAbi,
        chain: anvil(collectiveFactory),
      },
      SlotCollective: {
        abi: SlotCollectiveAbi,
        chain: childrenOf(
          anvil(collectiveFactory),
          COLLECTIVE_DEPLOYED_EVENT,
          "manager",
        ),
      },
      AdLand: { abi: AdLandAbi, chain: anvil(adLand) },
      SlotBoundNFTFactory: {
        abi: SlotBoundNftFactoryAbi,
        chain: anvil(nftFactory),
      },
      SlotBoundNFT: {
        abi: SlotBoundNftAbi,
        chain: childrenOf(
          anvil(nftFactory),
          COLLECTION_CREATED_EVENT,
          "collection",
        ),
      },
      SlotBoundNFTWrapper: {
        abi: SlotBoundNftWrapperAbi,
        chain: childrenOf(anvil(nftFactory), WRAPPER_CREATED_EVENT, "wrapper"),
      },
    },
  });
}
