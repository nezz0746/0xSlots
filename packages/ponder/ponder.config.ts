import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createConfig, factory, loadBalance, rateLimit } from "ponder";
import { http, type Hex, parseAbiItem, type Transport, webSocket } from "viem";
import {
  FeedAbi,
  FeedHubAbi,
  FeedPostModuleAbi,
  SlotAbi,
  SlotFactoryAbi,
  slotFactoryLegacyAbi,
} from "./abis";

// ──────────────────────────────────────────
// Local mode
//
// PONDER_LOCAL=1 indexes an anvil chain INSTEAD of base/base-sepolia, reading
// addresses from the forge deploy output rather than the constants below. It is
// a full replacement, not an addition: pulling years of mainnet history while
// iterating on a local chain burns an Alchemy quota to answer questions the
// local chain answers in seconds.
// ──────────────────────────────────────────

const LOCAL = process.env.PONDER_LOCAL === "1";
const ANVIL_RPC = process.env.ANVIL_RPC_URL ?? "http://127.0.0.1:8545";

function localDeployment(name: string): { address: Hex; startBlock: number } {
  const path = fileURLToPath(
    new URL(
      `../../apps/contracts/deployments/31337/${name}.json`,
      import.meta.url,
    ),
  );
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new Error(
      `PONDER_LOCAL=1 but ${path} is missing. Run the local deploy first:\n` +
        `  cd apps/contracts && forge script script/DeployLocal.s.sol:DeployLocal --broadcast`,
    );
  }
}

// ──────────────────────────────────────────
// Per-chain factory addresses (mirror packages/subgraph/config/*.json)
// ──────────────────────────────────────────

const BASE_SEPOLIA_SLOT_FACTORY =
  "0x6D87C1647f228Baf8DE0374FCd7FdEBF6900fdFF" as const;
const BASE_SEPOLIA_SLOT_FACTORY_START_BLOCK = 39341061;

const BASE_SLOT_FACTORY = "0xbf2F890E8F5CCCB3A1D7c5030dBC1843B9E36B0e" as const;
const BASE_SLOT_FACTORY_START_BLOCK = 43581441;

// FeedHub — base-sepolia only.
//
// packages/subgraph/config/base.json carries a mainnet entry, but it is an
// explicit placeholder reusing this same address with a note that there is no
// code at it on mainnet. Indexing that would mean a log filter that can never
// match; the source is added here when the mainnet hub actually ships.
const BASE_SEPOLIA_FEED_HUB =
  "0xE4c0c374E3233b5174a1600AF1321cDa9b6B5cF8" as const;
const BASE_SEPOLIA_FEED_HUB_START_BLOCK = 44088994;

const FEED_CREATED_EVENT = parseAbiItem(
  "event FeedCreated(uint256 indexed index, address indexed feed, address indexed owner)",
);

// ──────────────────────────────────────────
// Event signatures used to derive child addresses via factory()
// ──────────────────────────────────────────

// Two live `SlotDeployed` signatures. `SlotConfig` gained `mutablePolicy` and
// `SlotInitParams` gained `occupancyPolicy`, which changed both tuple types and
// therefore topic0 — two distinct events that happen to share a name.
//
// Both are load-bearing, and each needs its OWN source on both sides:
//
//   * `factory()` derives child addresses from exactly one event, so a single
//     entry registers only that era's slots as children.
//   * `ponder.on("<source>:SlotDeployed")` resolves against that source's ABI,
//     so a single entry writes slot rows for only that era.
//
// Getting these two out of step is worse than either gap alone: children
// registered from one signature while rows are written from the other means
// every slot event fires against a row that was never inserted, and `loadSlot`
// throws rather than skipping.
//
// 64 slots on base and 237 on base-sepolia were created under the legacy
// signature, against exactly one each under the current one — 301 of 303.
const SLOT_DEPLOYED_EVENT = parseAbiItem(
  "event SlotDeployed(address indexed slot, address indexed recipient, address indexed currency, (bool,bool,bool,address) config, (uint256,address,uint256,uint256,address) initParams)",
);

const SLOT_DEPLOYED_LEGACY_EVENT = parseAbiItem(
  "event SlotDeployed(address indexed slot, address indexed recipient, address indexed currency, (bool,bool,address) config, (uint256,address,uint256,uint256) initParams)",
);

const MODULE_VERIFIED_EVENT = parseAbiItem(
  "event ModuleVerified(address indexed module, bool verified, string name, string version, uint256 feeBps, string moduleURI)",
);

type WatchedEvent =
  | typeof SLOT_DEPLOYED_EVENT
  | typeof SLOT_DEPLOYED_LEGACY_EVENT
  | typeof MODULE_VERIFIED_EVENT;

// Helper: build per-chain factory() override for slot-factory-spawned contracts
const slotChildAddress = (
  event: WatchedEvent,
  parameter: "slot" | "module",
) => ({
  baseSepolia: {
    address: factory({
      address: BASE_SEPOLIA_SLOT_FACTORY,
      event,
      parameter,
    }),
    startBlock: BASE_SEPOLIA_SLOT_FACTORY_START_BLOCK,
  },
  base: {
    address: factory({
      address: BASE_SLOT_FACTORY,
      event,
      parameter,
    }),
    startBlock: BASE_SLOT_FACTORY_START_BLOCK,
  },
});

// ──────────────────────────────────────────
// RPC endpoints
//
// Two ways in, checked in order:
//
//   1. PONDER_RPC_URL_BASE / PONDER_RPC_URL_BASE_SEPOLIA — a complete URL.
//      Preferred for a deployment: paste what the provider gave you and no
//      secret has to be reassembled here.
//   2. ALCHEMY_API_KEY (or ALCHEMY_KEY, which is what turbo.json and the rest
//      of the repo use) — the URL is built around it.
//
// Missing credentials used to resolve to `.../v2/` and fail on every request
// with "Must be authenticated!", eight retries per chain, forever. That reads
// like a provider outage rather than an unset variable, so it now throws at
// boot naming the variables involved.
//
// Alchemy is the default provider — base-sepolia.publicnode.com works too, but
// Coinbase's https://sepolia.base.org has a broken eth_getLogs.
// ──────────────────────────────────────────

const ALCHEMY_KEY =
  process.env.ALCHEMY_API_KEY ?? process.env.ALCHEMY_KEY ?? "";

/**
 * How hard to lean on Alchemy when public endpoints are also in the pool.
 *
 * Backfill is `eth_getLogs`-heavy and wants a provider that answers wide ranges
 * reliably; steady state is just block polling, which any public node serves.
 * Capping Alchemy and load-balancing the rest keeps the paid quota for the work
 * that actually needs it.
 */
const ALCHEMY_RPS = Number(process.env.ALCHEMY_RPS ?? 25);

/**
 * Public endpoints — OPT-IN, via PONDER_PUBLIC_RPCS=1.
 *
 * Not the default, because most of them refuse the one method that matters.
 * Measured against the exact `eth_getLogs` ponder issues during backfill:
 *
 *   mainnet.base.org                  ok
 *   base.api.onfinality.io/public     -32029, needs an API key
 *   api.zan.top/base-mainnet          -32012, "not available for
 *                                     unregistered accounts"
 *
 * Mixed into the pool by default they produced 48 errors and zero progress:
 * load balancing spreads requests round-robin, so a provider that rejects
 * eth_getLogs does not degrade throughput, it stalls the sync outright.
 *
 * They remain useful for the realtime phase, which is block polling and cheap
 * for anyone to serve — see the note on staged backfill below.
 *
 * Coinbase's https://sepolia.base.org is excluded entirely: its eth_getLogs is
 * broken for some contracts, which is a wrong answer rather than an error.
 */
const PUBLIC_RPCS: Record<string, string[]> = {
  base: [
    "wss://base-rpc.publicnode.com",
    "wss://base.drpc.org",
    "https://mainnet.base.org",
  ],
  base_sepolia: [
    "wss://base-sepolia-rpc.publicnode.com",
    "https://base-sepolia-rpc.publicnode.com",
  ],
};

const USE_PUBLIC_RPCS = process.env.PONDER_PUBLIC_RPCS === "1";

const toTransport = (url: string): Transport =>
  url.startsWith("ws") ? webSocket(url) : http(url);

/**
 * The transport pool for a chain.
 *
 *   1. PONDER_RPC_URL_<CHAIN> — comma-separated, and the complete answer when
 *      set. Nothing else is added, so a deployment can pin exactly what it
 *      wants and balance across paid providers.
 *   2. Otherwise Alchemy, plus the public pool when PONDER_PUBLIC_RPCS=1.
 *
 * ── Spending Alchemy only on the backfill ────────────────────────────────────
 *
 * Ponder has no per-phase transport hook, so this cannot be expressed in
 * config. It is an operational sequence instead: deploy with Alchemy alone, let
 * the historical sync finish, then set PONDER_PUBLIC_RPCS=1 and redeploy.
 *
 * What that saves is narrower than it first looks. The RPC cache lives in its
 * own `ponder_sync` schema, keyed by chain rather than by app, so a new app
 * schema replays cached ranges from Postgres instead of the provider — but the
 * indexing functions still re-run, and any source or range that was not cached
 * before (a newly added contract, an earlier startBlock) is real RPC work at
 * whatever endpoints are configured at that moment. Verify with
 * `select count(*) from ponder_sync.logs`.
 */
function rpcPool(
  label: "base" | "base_sepolia",
  explicit: string | undefined,
  alchemySubdomain: string,
): Transport {
  const explicitUrls = (explicit ?? "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
  if (explicitUrls.length > 0) {
    return loadBalance(explicitUrls.map(toTransport));
  }

  const pool: Transport[] = [];
  if (ALCHEMY_KEY) {
    const alchemy = http(
      `https://${alchemySubdomain}.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    );
    // Only worth capping when something else can absorb the overflow.
    pool.push(
      USE_PUBLIC_RPCS
        ? rateLimit(alchemy, { requestsPerSecond: ALCHEMY_RPS })
        : alchemy,
    );
  }
  if (USE_PUBLIC_RPCS) {
    pool.push(...(PUBLIC_RPCS[label] ?? []).map(toTransport));
  }

  if (pool.length === 0) {
    throw new Error(
      `No RPC endpoint for ${label}. Set PONDER_RPC_URL_${label.toUpperCase()} ` +
        `to a URL (or a comma-separated list), or ALCHEMY_API_KEY ` +
        `(ALCHEMY_KEY is also accepted). PONDER_PUBLIC_RPCS=1 adds public ` +
        `endpoints, which are suitable for realtime but not for backfill.`,
    );
  }
  return pool.length === 1 ? pool[0]! : loadBalance(pool);
}

const remoteConfig = createConfig({
  chains: {
    baseSepolia: {
      id: 84532,
      rpc: rpcPool(
        "base_sepolia",
        process.env.PONDER_RPC_URL_BASE_SEPOLIA,
        "base-sepolia",
      ),
    },
    base: {
      id: 8453,
      rpc: rpcPool("base", process.env.PONDER_RPC_URL_BASE, "base-mainnet"),
    },
  },
  contracts: {
    // startBlock stays at the factory deployment rather than moving up to the
    // v3 upgrade (base 49494932, base-sepolia 44825297). Every module was
    // verified before its chain's upgrade — base at 44653646 — and the module
    // source derives its watched addresses from ModuleVerified, so starting
    // later would register no modules and metadata would silently produce
    // nothing. The saving would be trivial regardless: a log filter over the
    // skipped range is a few hundred chunked eth_getLogs, since only blocks
    // that actually match cost a full-block request.
    SlotFactory: {
      abi: SlotFactoryAbi,
      chain: {
        baseSepolia: {
          address: BASE_SEPOLIA_SLOT_FACTORY,
          startBlock: BASE_SEPOLIA_SLOT_FACTORY_START_BLOCK,
        },
        base: {
          address: BASE_SLOT_FACTORY,
          startBlock: BASE_SLOT_FACTORY_START_BLOCK,
        },
      },
    },
    // Same address as SlotFactory, legacy-only ABI. Two entries rather than one
    // merged ABI: `ponder.on` can disambiguate overloads by full signature, but
    // a merged ABI would still need one source per signature for factory()
    // anyway, and spelling tuple-heavy signatures out as handler keys is far
    // more brittle than one narrow ABI per era.
    SlotFactoryLegacy: {
      abi: slotFactoryLegacyAbi,
      chain: {
        baseSepolia: {
          address: BASE_SEPOLIA_SLOT_FACTORY,
          startBlock: BASE_SEPOLIA_SLOT_FACTORY_START_BLOCK,
        },
        base: {
          address: BASE_SLOT_FACTORY,
          startBlock: BASE_SLOT_FACTORY_START_BLOCK,
        },
      },
    },
    Slot: {
      abi: SlotAbi,
      chain: slotChildAddress(SLOT_DEPLOYED_EVENT, "slot"),
    },
    // The 301 pre-occupancy-layer slots. Same ABI — the Slot contract itself is
    // beacon-upgraded, so both eras emit the current event set; only the
    // factory event that birthed them differs.
    SlotLegacy: {
      abi: SlotAbi,
      chain: slotChildAddress(SLOT_DEPLOYED_LEGACY_EVENT, "slot"),
    },
    // Every verified module, watched for MetadataUpdated. FeedPostModule's ABI
    // carries both the V1 (slot, uri) and V2 (slot, updatedBy, uri) overloads,
    // so this single source covers MetadataModule contracts too — handlers
    // disambiguate by full signature in src/metadata.ts.
    FeedPostModule: {
      abi: FeedPostModuleAbi,
      chain: slotChildAddress(MODULE_VERIFIED_EVENT, "module"),
    },
    FeedHub: {
      abi: FeedHubAbi,
      chain: {
        baseSepolia: {
          address: BASE_SEPOLIA_FEED_HUB,
          startBlock: BASE_SEPOLIA_FEED_HUB_START_BLOCK,
        },
      },
    },
    // Beacon-proxy feeds, derived from the hub's FeedCreated.
    Feed: {
      abi: FeedAbi,
      chain: {
        baseSepolia: {
          address: factory({
            address: BASE_SEPOLIA_FEED_HUB,
            event: FEED_CREATED_EVENT,
            parameter: "feed",
          }),
          startBlock: BASE_SEPOLIA_FEED_HUB_START_BLOCK,
        },
      },
    },
  },
});

/**
 * The anvil equivalent: same five sources, one chain, addresses read from disk.
 *
 * `SlotFactoryLegacy` and `SlotLegacy` are declared here too even though a
 * fresh chain only ever emits the current signature. The handlers in src/ are
 * registered unconditionally and ponder rejects a handler whose source is
 * absent, so the alternative would be conditional registration for no gain.
 * They cost one log filter that never matches.
 */
function buildLocalConfig() {
  const { address, startBlock } = localDeployment("SlotFactory");
  const at = { address, startBlock };
  const child = (event: WatchedEvent, parameter: "slot" | "module") => ({
    anvil: {
      address: factory({ address, event, parameter }),
      startBlock,
    },
  });

  return createConfig({
    chains: {
      anvil: {
        id: 31337,
        rpc: http(ANVIL_RPC),
        // A fresh anvil reuses block numbers from the previous run with
        // entirely different contents, so a warm cache serves the old chain's
        // blocks for the new one.
        disableCache: true,
      },
    },
    contracts: {
      SlotFactory: { abi: SlotFactoryAbi, chain: { anvil: at } },
      SlotFactoryLegacy: { abi: slotFactoryLegacyAbi, chain: { anvil: at } },
      Slot: { abi: SlotAbi, chain: child(SLOT_DEPLOYED_EVENT, "slot") },
      SlotLegacy: {
        abi: SlotAbi,
        chain: child(SLOT_DEPLOYED_LEGACY_EVENT, "slot"),
      },
      FeedPostModule: {
        abi: FeedPostModuleAbi,
        chain: child(MODULE_VERIFIED_EVENT, "module"),
      },
      // No FeedHub is deployed locally, so these never match. Declared anyway
      // for the same reason as the legacy sources: src/feed.ts registers its
      // handlers unconditionally and ponder rejects a handler whose source is
      // missing. Pointed at the slot factory purely so the address is valid.
      FeedHub: { abi: FeedHubAbi, chain: { anvil: at } },
      Feed: { abi: FeedAbi, chain: { anvil: at } },
    },
  });
}

/**
 * The remote config is the type witness even when running locally.
 *
 * Ponder derives `context.chain` from `config.contracts[source].chain`, so
 * exporting a union of the two configs collapses every handler's `context.chain`
 * to `unknown`. Pinning the type to one of them keeps all of src/ inferring
 * correctly; the two differ only in chain identity, and handlers read nothing
 * from `context.chain` but `.id`, which is a number in both.
 */
export default LOCAL
  ? (buildLocalConfig() as unknown as typeof remoteConfig)
  : remoteConfig;
