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
import { type Deployment, readDeployment } from "./deployments";
import {
  COLLECTION_CREATED_EVENT,
  COLLECTIVE_DEPLOYED_EVENT,
  childrenOf,
  SLOT_CREATED_EVENT,
  WRAPPER_CREATED_EVENT,
} from "./events";
import { type PoolLabel, rpcPool } from "./rpc";

/**
 * The chains indexed remotely. `env` is the suffix every per-chain override
 * carries: `PONDER_RPC_URL_<env>`, `SLOTS_FACTORY_<env>`, and so on.
 */
const CHAINS = {
  baseSepolia: { id: 84532, pool: "base_sepolia", env: "BASE_SEPOLIA" },
  // Protocol v1 on Base mainnet since block 51992101 (2026-09-30), read from
  // apps/contracts/deployments/8453 like every other chain.
  base: { id: 8453, pool: "base", env: "BASE" },
  sepolia: { id: 11155111, pool: "sepolia", env: "SEPOLIA" },
} as const satisfies Record<
  string,
  { id: number; pool: PoolLabel; env: string }
>;

type ChainName = keyof typeof CHAINS;
const NAMES = Object.keys(CHAINS) as ChainName[];

/**
 * One record, read on every chain.
 *
 * `envPrefix` and `blockPrefix` name the overrides: `<envPrefix>_<chain>` is
 * the address and `<blockPrefix>_<chain>` its start block.
 */
function onEveryChain(
  name: string,
  envPrefix: string,
  blockPrefix: string,
): Record<ChainName, Deployment> {
  const out = {} as Record<ChainName, Deployment>;
  for (const chain of NAMES) {
    const { id, env } = CHAINS[chain];
    out[chain] = readDeployment(
      `${envPrefix}_${env}`,
      `${blockPrefix}_${env}`,
      id,
      name,
    );
  }
  return out;
}

/**
 * base, base-sepolia and sepolia, from the deployment records.
 *
 * A function rather than a module-level value, so a local run neither reads
 * the remote records nor needs a provider key to boot.
 */
export function buildRemoteConfig() {
  const slotFactory = onEveryChain(
    "SlotFactory",
    "SLOTS_FACTORY",
    "SLOTS_START_BLOCK",
  );
  // Only ported collective factories are read: `readDeployment` ignores a
  // record without `version`, which is what the pre-port ones on base are.
  // Pointed at a legacy factory this would not fail — `UpdateRelayed` is
  // byte-identical across the port — it would quietly write a null `kind`.
  const collectiveFactory = onEveryChain(
    "SlotCollectiveFactory",
    "COLLECTIVE_FACTORY",
    "COLLECTIVE_START_BLOCK",
  );
  const nftFactory = onEveryChain(
    "SlotBoundNFTFactory",
    "NFT_FACTORY",
    "NFT_START_BLOCK",
  );
  // A MODULE, and the only one indexed: one deployment per chain rather than
  // factory children. AdLand earns it because the creative it stores is the
  // whole content of an ad space and lives nowhere else.
  const adLand = onEveryChain("AdLand", "ADLAND", "ADLAND_START_BLOCK");

  return createConfig({
    chains: {
      baseSepolia: {
        id: CHAINS.baseSepolia.id,
        rpc: rpcPool("base_sepolia", process.env.PONDER_RPC_URL_BASE_SEPOLIA),
      },
      base: {
        id: CHAINS.base.id,
        rpc: rpcPool("base", process.env.PONDER_RPC_URL_BASE),
      },
      sepolia: {
        id: CHAINS.sepolia.id,
        rpc: rpcPool("sepolia", process.env.PONDER_RPC_URL_SEPOLIA),
      },
    },
    contracts: {
      SlotFactory: { abi: SlotFactoryAbi, chain: slotFactory },
      Slot: {
        abi: SlotAbi,
        chain: childrenOf(slotFactory, SLOT_CREATED_EVENT, "slot"),
      },
      SlotCollectiveFactory: {
        abi: SlotCollectiveFactoryAbi,
        chain: collectiveFactory,
      },
      AdLand: { abi: AdLandAbi, chain: adLand },
      SlotBoundNFTFactory: { abi: SlotBoundNftFactoryAbi, chain: nftFactory },
      SlotBoundNFT: {
        abi: SlotBoundNftAbi,
        chain: childrenOf(nftFactory, COLLECTION_CREATED_EVENT, "collection"),
      },
      // From the SAME factory as the collections, so no new record and no new
      // env var. Wrappers appear once `initializeWrappers` has been called.
      SlotBoundNFTWrapper: {
        abi: SlotBoundNftWrapperAbi,
        chain: childrenOf(nftFactory, WRAPPER_CREATED_EVENT, "wrapper"),
      },
      SlotCollective: {
        abi: SlotCollectiveAbi,
        chain: childrenOf(
          collectiveFactory,
          COLLECTIVE_DEPLOYED_EVENT,
          "manager",
        ),
      },
    },
  });
}
