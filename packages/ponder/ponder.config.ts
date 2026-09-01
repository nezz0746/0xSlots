import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createConfig, factory } from "ponder";
import { parseAbiItem } from "viem";
import {
  SlotAbi,
  SlotCollectiveAbi,
  SlotCollectiveFactoryAbi,
  SlotFactoryAbi,
} from "./abis";

// ═══════════════════════════════════════════════════════════════════════════
// THE HOOK-BASED SLOTS PROTOCOL
//
// ── One creation function, one source ──────────────────────────────────────
//
// The previous protocol had two live `SlotDeployed` signatures — a struct
// gained a field, which changed topic0 — so every handler had to be registered
// twice and every child-address `factory()` declared twice. `SlotFactory` now
// has exactly ONE creation function taking one `SlotInit` struct, and one
// `SlotCreated` event. There is a single `Slot` source below, and src/slot.ts
// registers each handler once. A new slot parameter goes into `SlotInit`; it
// must never become a suffixed second creator, because that splits this file
// again.
//
// ── Discovering slots: factory() on SlotCreated ────────────────────────────
//
// Slots are BeaconProxies, so their addresses are only knowable from the
// factory's own log. `factory()` on `SlotCreated` watches every slot address
// directly, which keeps viem's typed decoding and keeps `event.log.address`
// meaning the slot.
//
// The factory briefly carried a re-emit — `emitEvent` / `SlotEvent`, one
// watched address for the whole protocol with every event hand-decoded from
// `bytes` — and nothing in `src/slots` ever called it. It is gone from the
// contracts now rather than left as a supported-looking path that emitted
// nothing, so this is the only way in and there is no second stream to
// accidentally index alongside it and double-count every transition.
// ═══════════════════════════════════════════════════════════════════════════

// ──────────────────────────────────────────
// Local mode
//
// PONDER_LOCAL=1 indexes an anvil chain INSTEAD of base/base-sepolia. It is a
// full replacement, not an addition: pulling remote history while iterating on
// a local chain burns a provider quota to answer questions the local chain
// answers in seconds.
// ──────────────────────────────────────────

const LOCAL = process.env.PONDER_LOCAL === "1";
const ANVIL_RPC = process.env.ANVIL_RPC_URL ?? "http://127.0.0.1:8545";

/**
 * The local factory, pinned rather than read from disk.
 *
 * `apps/contracts/deployments/31337/SlotFactory.json` is written by
 * `DeployProtocol.s.sol` — the same script the testnets use, via CREATE2.
 *
 * This was a pinned constant for as long as the local chain had two deploy
 * paths writing that filename, one of them the retired protocol's. Pinning
 * outlived the reason for it: the constant kept naming the OLD plain-CREATE
 * address after local moved to CREATE2, so the filter matched nothing and the
 * explorer showed an empty chain that `cast logs` proved was full. Read the
 * record, like every other chain.
 */
// Resolved below, once `remoteFactory` and the constants it closes over exist.
// Calling it up here reads `UNDEPLOYED` inside its temporal dead zone.

/**
 * The local collective factory, which cannot be pinned the way the slot
 * factory is.
 *
 * `DeployProtocol.s.sol` does deploy one, but the local drive script wants its
 * own — collectives need a
 * `SplitsWarehouse`, which the protocol deploy has no business creating — so it
 * comes up separately, from `script/slots/DeployAndDriveCollective.s.sol`,
 * against a chain whose nonce is already wherever the seed left it. Its address
 * is therefore a function of when it was deployed, not of the deploy script,
 * and a hardcoded constant would be wrong on the second run.
 *
 * Resolved in order: the env var, then the deployment file that script writes,
 * then nothing. The file outliving its chain is the same hazard called out
 * above for `SlotFactory` — a filter that silently matches nothing — so the
 * resolved address is ANNOUNCED at boot with where it came from. That turns a
 * stale address into one line of output you can check against `cast codesize`,
 * instead of an empty table with no explanation.
 */
function anvilCollectiveFactory(): Deployment {
  const fromEnv = process.env.SLOTS_COLLECTIVE_FACTORY_ANVIL as
    | `0x${string}`
    | undefined;
  if (fromEnv) {
    const block = Number(process.env.SLOTS_COLLECTIVE_START_BLOCK_ANVIL ?? 0);
    console.log(`[local] collective factory ${fromEnv} from block ${block} (env)`);
    return { address: fromEnv, startBlock: block };
  }
  try {
    const raw = readFileSync(
      "../../apps/contracts/deployments/31337/SlotCollectiveFactory.json",
      "utf8",
    );
    const { address, startBlock } = JSON.parse(raw) as Deployment;
    console.log(
      `[local] collective factory ${address} from block ${startBlock} ` +
        `(deployments/31337) — verify with: cast codesize ${address}`,
    );
    // The recorded block, not 0. The collective factory comes up long after
    // the protocol does — it is a second script against an already-running
    // chain — so starting at 0 would be a thousand empty `eth_getLogs` before
    // the first log it can possibly match.
    return { address, startBlock };
  } catch {
    console.log(
      "[local] no collective factory: set SLOTS_COLLECTIVE_FACTORY_ANVIL, or " +
        "run script/slots/DeployAndDriveCollective.s.sol",
    );
    return { address: UNDEPLOYED, startBlock: 0 };
  }
}

// ──────────────────────────────────────────
// Per-chain factory addresses
//
// Remote chains read their factory from the deployment records the deploy
// script writes, with an env var as an override.
//
// The records were NOT trusted before, and the reason was real: the old
// `DeployLocal` wrote the RETIRED factory's address into the same filenames,
// so reading them would have indexed the old event set against the new schema
// and written nothing but errors. `DeployProtocol` writes the hook-based
// addresses now, so the file is the truth and the env var is the escape hatch
// rather than the other way round.
//
// A chain with no record still falls back to `startBlock: "latest"`, so it
// costs a log filter at the tip rather than a historical scan for an address
// that has no code.
// ──────────────────────────────────────────

const UNDEPLOYED = "0x0000000000000000000000000000000000000000" as const;

type Deployment = {
  address: `0x${string}`;
  startBlock: number | "latest";
};

function remoteFactory(
  env: string,
  blockEnv: string,
  chainId: number,
  name = "SlotFactory",
): Deployment {
  // An explicit env var wins: it is how you point a branch at a different
  // deployment without editing a committed file.
  const fromEnv = process.env[env] as `0x${string}` | undefined;
  if (fromEnv) {
    const block = process.env[blockEnv];
    return { address: fromEnv, startBlock: block ? Number(block) : "latest" };
  }

  // Otherwise the record the deploy script wrote.
  try {
    const raw = readFileSync(
      join(__dirname, `../../apps/contracts/deployments/${chainId}/${name}.json`),
      "utf8",
    );
    const rec = JSON.parse(raw) as Deployment & { version?: number };

    // `version` is the discriminator, and it is load-bearing. These filenames
    // were reused by the retired protocol's deploy scripts, so the records for
    // chains the old protocol reached still hold PRE-PORT addresses —
    // base mainnet's collective factory is one. Indexing those against this
    // schema is the exact failure this config used to avoid by trusting
    // nothing. Only `DeployProtocol` writes `version`, so only what it wrote
    // is read.
    if (rec.version === undefined) {
      console.log(
        `[chain ${chainId}] ${name}: record predates the port, ignoring`,
      );
      return { address: UNDEPLOYED, startBlock: "latest" };
    }

    if (rec.address && rec.address !== UNDEPLOYED) {
      console.log(
        `[chain ${chainId}] ${name} ${rec.address} from block ${rec.startBlock}`,
      );
      return { address: rec.address, startBlock: rec.startBlock };
    }
  } catch {
    // No record for this chain: nothing is deployed there yet.
  }

  return { address: UNDEPLOYED, startBlock: "latest" };
}

const ANVIL_SLOT_FACTORY_RECORD = remoteFactory(
  "SLOTS_FACTORY_ANVIL",
  "SLOTS_START_BLOCK_ANVIL",
  31337,
);
const ANVIL_SLOT_FACTORY = ANVIL_SLOT_FACTORY_RECORD.address;
// Anvil always has a real record when it has a chain at all, so an env
// override without a block still means "from genesis" rather than "from tip".
const ANVIL_START_BLOCK = Number(
  process.env.SLOTS_START_BLOCK_ANVIL ??
    (ANVIL_SLOT_FACTORY_RECORD.startBlock === "latest"
      ? 0
      : ANVIL_SLOT_FACTORY_RECORD.startBlock),
);

const BASE_SEPOLIA_SLOT_FACTORY = remoteFactory(
  "SLOTS_FACTORY_BASE_SEPOLIA",
  "SLOTS_START_BLOCK_BASE_SEPOLIA",
  84532,
);
const BASE_SLOT_FACTORY = remoteFactory(
  "SLOTS_FACTORY_BASE",
  "SLOTS_START_BLOCK_BASE",
  8453,
);

// ──────────────────────────────────────────
// Collective factories
//
// Env-driven for the same reason the slot factories above are, and it is NOT
// the same reason it looks like. Collective factories ARE deployed on base and
// base-sepolia — the addresses are in this file's history — but what is behind
// them is the PRE-PORT collective: three manager roles, a three-member
// `UpdateKind`, and a `LiquidationBountyRelayed` that no longer exists.
//
// `UpdateRelayed(address,address,uint8,bytes32)` is byte-identical across the
// port, so pointing this at a legacy factory would not fail — it would decode
// old `Policy` (ordinal 2) proposals against a two-member `Dimension` and
// quietly write a null `kind`. Silence, not an error. So the addresses are
// gone until a ported factory is deployed, and each chain reads its own.
// ──────────────────────────────────────────

// The ported collective factory IS deployed on base-sepolia now, so these read
// their own record rather than staying dark.
const BASE_SEPOLIA_COLLECTIVE_FACTORY = remoteFactory(
  "COLLECTIVE_FACTORY_BASE_SEPOLIA",
  "COLLECTIVE_START_BLOCK_BASE_SEPOLIA",
  84532,
  "SlotCollectiveFactory",
);
const BASE_COLLECTIVE_FACTORY = remoteFactory(
  "COLLECTIVE_FACTORY_BASE",
  "COLLECTIVE_START_BLOCK_BASE",
  8453,
  "SlotCollectiveFactory",
);

// ──────────────────────────────────────────
// Event signatures used to derive child addresses via factory()
// ──────────────────────────────────────────

const SLOT_CREATED_EVENT = parseAbiItem(
  "event SlotCreated(address indexed slot, address indexed recipient, address indexed creator, address currency, address hook)",
);

const COLLECTIVE_DEPLOYED_EVENT = parseAbiItem(
  "event SlotCollectiveDeployed(address indexed manager, address indexed admin, address indexed deployer)",
);

// ──────────────────────────────────────────
// RPC endpoints
//
// Two ways in, checked in order:
//
//   1. PONDER_RPC_URL_BASE / PONDER_RPC_URL_BASE_SEPOLIA — a complete URL.
//      Preferred for a deployment: paste what the provider gave you and no
//      secret has to be reassembled here.
//   2. COINBASE_API_KEY, else ALCHEMY_API_KEY (or ALCHEMY_KEY, which is what
//      turbo.json and the rest of the repo use) — the URL is built around it.
//
// Missing credentials used to resolve to `.../v2/` and fail on every request
// with "Must be authenticated!", eight retries per chain, forever. That reads
// like a provider outage rather than an unset variable, so it now throws at
// boot naming the variables involved.
//
// ── Endpoints go to ponder as URLs, never as a viem Transport ────────────────
//
// `chain.rpc` takes `string | string[] | Transport`, and the three are not
// equivalent. From ponder/dist/esm/rpc/index.js, a URL (or a list of them)
// becomes one tracked *bucket* per endpoint:
//
//   * per-provider adaptive rate limiting, starting at 20 rps and moving with
//     the provider's own answers (`maxRequestsPerSecond` is deprecated —
//     "Handled automatically instead")
//   * deactivation with exponential backoff on 429 or timeout, and
//     reactivation afterwards
//   * selection by `expectedLatency`, which divides total latency by the
//     SUCCESSFUL count — so a provider that errors is scored worse and drifts
//     out of rotation, while 10% epsilon exploration keeps re-testing it
//   * a fresh bucket per retry, up to 9, so one provider's refusal is a retry
//     rather than a dead end
//   * the provider's hostname in every log line
//
// A viem Transport gets none of that. It is wrapped as a single bucket named
// `custom_transport` and ponder treats the whole pool as one provider, which
// is exactly what `loadBalance()` used to hand it here. That is what turned a
// blocked endpoint into a stalled sync — see PUBLIC_RPCS below.
// ──────────────────────────────────────────

const ALCHEMY_KEY =
  process.env.ALCHEMY_API_KEY ?? process.env.ALCHEMY_KEY ?? "";

/**
 * Coinbase Developer Platform, and the one that wins when both are set.
 *
 * The key rides in the URL path — it is CDP's *client* key, the one their docs
 * describe as safe in frontend code — so it needs no header support and slots
 * into the same URL list as everything else. Documented ceiling is 7,500 BU per
 * 5 seconds per project, and CDP documents no eth_getLogs limits at all, which
 * is not the same as having none: the address-list ceiling that publicnode
 * enforces below was undocumented too. Verify before trusting it as the only
 * provider on a chain (see the probe recipe in PUBLIC_RPCS).
 */
const COINBASE_KEY = process.env.COINBASE_API_KEY ?? "";

/** Per-chain path segment for each paid provider. */
const PAID_ENDPOINTS: Record<
  "base" | "base_sepolia",
  { alchemy: string; coinbase: string }
> = {
  base: { alchemy: "base-mainnet", coinbase: "base" },
  base_sepolia: { alchemy: "base-sepolia", coinbase: "base-sepolia" },
};

// ALCHEMY_RPS is gone with the `rateLimit()` wrapper it configured. Capping
// Alchemy never reduced the bill anyway — the credits a backfill costs are set
// by how many requests the data needs, not by how fast they are sent — and the
// wrapper forced the single-bucket path above. Ponder now rate-limits each
// provider on its own evidence, and Alchemy's 429s are what tell it to slow
// down.

/**
 * Public endpoints — OPT-IN, via PONDER_PUBLIC_RPCS=1, and never the whole
 * pool on their own.
 *
 * Most of them refuse the one method that matters. Measured 2026-08-20 with
 * this indexer's own filter shape — 50 factory-derived addresses, 23 topic0s,
 * against a window at the chain tip:
 *
 *   mainnet.base.org                  ok
 *   base.drpc.org                     ok
 *   base-rpc.publicnode.com           -32602 "Request blocked" (HTTP 403)
 *   base-sepolia-rpc.publicnode.com   -32602 "Request blocked" (HTTP 403)
 *   base-sepolia.gateway.tenderly.co  ok at 25, 1k and 10k-block windows
 *   base-sepolia.drpc.org             408 "Request timeout on the free tier",
 *                                     intermittently — 1k ok, 25 and 10k not
 *   base.api.onfinality.io/public     -32029, needs an API key (earlier)
 *   api.zan.top/base-mainnet          -32012, unregistered (earlier)
 *
 * Mixed into the pool they once produced 48 errors and zero progress, because
 * `loadBalance()` is round-robin with no failover — @ponder/utils hands the
 * request to `transports[index++]` and returns whatever comes back, error
 * included. Handing ponder the URLs instead (see above) makes a refusal cost
 * one retry against a different bucket, so a bad member degrades throughput
 * rather than stopping the sync. That is what makes them safe to keep here —
 * as a cheap tier UNDER a provider that answers everything, not as a
 * replacement for one.
 *
 * ── What publicnode actually refuses ─────────────────────────────────────────
 *
 * Both base-sepolia rows here were publicnode (wss and https are one
 * provider), and on 2026-08-20 production had it rejecting every log query the
 * indexer makes: -32602, "Details: Request blocked", over a 25-block window at
 * the tip (0x2b9c5f8 -> 0x2b9c610) carrying 50 addresses.
 *
 * Bisecting the request shows the limit is the ADDRESS LIST, and nothing else:
 *
 *   1..9 addresses    ok          23 topic0s      ok
 *   10+ addresses     blocked     10,000 blocks   ok
 *
 * So the span rules out an archive-depth limit and ponder's "use
 * ethGetLogsBlockRange" tip with it — no block range is small enough, because
 * the range was never the problem. Ponder batches factory children ~50 at a
 * time, so every log query the `Slot` source emits is over the line, on BOTH
 * chains: base-rpc.publicnode.com blocks the same shape.
 *
 * publicnode stays in the base pool, where two other members answer the heavy
 * method and it still serves the block polling that is most of the volume. It
 * is gone from base-sepolia, where it was the entire pool and there was
 * nothing to absorb the refusal.
 *
 * Coinbase's https://sepolia.base.org is excluded for a different reason: its
 * eth_getLogs is broken for some contracts, which is a wrong answer rather
 * than an error.
 *
 * ── Vetting a candidate ──────────────────────────────────────────────────────
 *
 * Reachability proves nothing here; every endpoint above answers
 * eth_blockNumber. Ask it for the shape this indexer actually sends — a long
 * address list — and compare a 25-block window against a 10,000-block one:
 *
 *   ADDRS=$(printf '"0x%040d",%.0s' 1 $(seq 1 49))"0x$(printf '%040d' 50)"
 *   curl -s "$URL" -H 'content-type: application/json' --data @- <<JSON | head -c 300
 *   {"jsonrpc":"2.0","id":1,"method":"eth_getLogs","params":[{"address":[$ADDRS],
 *    "fromBlock":"0x2b9c5f8","toBlock":"0x2b9c610"}]}
 *   JSON
 *
 * A JSON-RPC error, an HTTP 403 or a timeout all disqualify it. Anything that
 * only fails on the wide window is a rate-limit story, not a capability one.
 */
const PUBLIC_RPCS: Record<string, string[]> = {
  base: [
    "wss://base-rpc.publicnode.com",
    "wss://base.drpc.org",
    "https://mainnet.base.org",
  ],
  // Tenderly is the one free base-sepolia endpoint that answered the real
  // filter shape at every window size tried. One provider's worth of evidence
  // from one afternoon, so it is a cheap tier under Alchemy, not a substitute
  // for it. base-sepolia.drpc.org is deliberately absent: its free tier timed
  // out on two of the three windows, which is a slow stall rather than a fast
  // error.
  base_sepolia: ["https://base-sepolia.gateway.tenderly.co"],
};

const USE_PUBLIC_RPCS = process.env.PONDER_PUBLIC_RPCS === "1";

/**
 * Names the providers actually in play, key redacted.
 *
 * The previous build logged the flag alone, so attributing a stalled sync to
 * its endpoint took a production log dump. Hostnames are safe to print; the
 * Alchemy URL's path is the credential.
 */
const announce = (label: string, urls: string[]) => {
  const hosts = urls.map((u) => {
    try {
      return new URL(u).hostname;
    } catch {
      return "<unparseable url>";
    }
  });
  console.log(`[rpc] ${label}: ${hosts.join(", ")}`);
};

/**
 * The endpoint list for a chain, as URLs for ponder to manage.
 *
 *   1. PONDER_RPC_URL_<CHAIN> — comma-separated, and the complete answer when
 *      set. Nothing else is added, so a deployment can pin exactly what it
 *      wants.
 *   2. Otherwise Alchemy, plus the public tier when PONDER_PUBLIC_RPCS=1.
 *
 * The paid endpoint — Coinbase if its key is set, else Alchemy — goes FIRST.
 * Order is not priority: ponder scores buckets by observed latency, so this
 * only decides who serves the opening requests before there is any evidence to
 * score. Starting on the provider that answers everything is the difference
 * between a sync that begins and one that spends its first minute discovering
 * which members are refusing it.
 *
 * ── Spending Alchemy only on the backfill ────────────────────────────────────
 *
 * Ponder has no per-phase endpoint hook, so this cannot be expressed in config.
 * It is an operational sequence instead: deploy with Alchemy alone, let the
 * historical sync finish, then set PONDER_PUBLIC_RPCS=1 and redeploy.
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
): string[] {
  const explicitUrls = (explicit ?? "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
  if (explicitUrls.length > 0) {
    announce(`${label} (explicit)`, explicitUrls);
    return explicitUrls;
  }

  // Coinbase REPLACES Alchemy rather than outranking it, because ordering here
  // buys less than it looks like it does: ponder picks buckets by observed
  // latency, so a pool of [coinbase, alchemy] converges on whichever answers
  // faster, not on the one named first. Exclusivity is the only way to say
  // "use Coinbase" and have it hold. To run both as peers instead, make this
  // an `if` and drop the `else`.
  const pool: string[] = [];
  const paid = PAID_ENDPOINTS[label];
  if (COINBASE_KEY) {
    pool.push(
      `https://api.developer.coinbase.com/rpc/v1/${paid.coinbase}/${COINBASE_KEY}`,
    );
  } else if (ALCHEMY_KEY) {
    pool.push(`https://${paid.alchemy}.g.alchemy.com/v2/${ALCHEMY_KEY}`);
  }
  if (USE_PUBLIC_RPCS) {
    pool.push(...(PUBLIC_RPCS[label] ?? []));
  }

  if (pool.length === 0) {
    throw new Error(
      `No RPC endpoint for ${label}. Set PONDER_RPC_URL_${label.toUpperCase()} ` +
        `to a URL (or a comma-separated list), or COINBASE_API_KEY, or ` +
        `ALCHEMY_API_KEY (ALCHEMY_KEY is also accepted). ` +
        `PONDER_PUBLIC_RPCS=1 adds this chain's public tier, where it has one.`,
    );
  }
  announce(label, pool);
  return pool;
}

const remoteConfig = createConfig({
  chains: {
    baseSepolia: {
      id: 84532,
      rpc: rpcPool("base_sepolia", process.env.PONDER_RPC_URL_BASE_SEPOLIA),
    },
    base: {
      id: 8453,
      rpc: rpcPool("base", process.env.PONDER_RPC_URL_BASE),
    },
  },
  contracts: {
    SlotFactory: {
      abi: SlotFactoryAbi,
      chain: {
        baseSepolia: BASE_SEPOLIA_SLOT_FACTORY,
        base: BASE_SLOT_FACTORY,
      },
    },
    // Every slot the factory has made, discovered from `SlotCreated`. One
    // source, one signature — see the note at the top of this file.
    Slot: {
      abi: SlotAbi,
      chain: {
        baseSepolia: {
          address: factory({
            address: BASE_SEPOLIA_SLOT_FACTORY.address,
            event: SLOT_CREATED_EVENT,
            parameter: "slot",
          }),
          startBlock: BASE_SEPOLIA_SLOT_FACTORY.startBlock,
        },
        base: {
          address: factory({
            address: BASE_SLOT_FACTORY.address,
            event: SLOT_CREATED_EVENT,
            parameter: "slot",
          }),
          startBlock: BASE_SLOT_FACTORY.startBlock,
        },
      },
    },
    SlotCollectiveFactory: {
      abi: SlotCollectiveFactoryAbi,
      chain: {
        baseSepolia: BASE_SEPOLIA_COLLECTIVE_FACTORY,
        base: BASE_COLLECTIVE_FACTORY,
      },
    },
    // Every collective the factory has made. Same shape as `Slot` above and
    // for the same reason: collectives are BeaconProxies, so their addresses
    // exist only in the factory's own log.
    SlotCollective: {
      abi: SlotCollectiveAbi,
      chain: {
        baseSepolia: {
          address: factory({
            address: BASE_SEPOLIA_COLLECTIVE_FACTORY.address,
            event: COLLECTIVE_DEPLOYED_EVENT,
            parameter: "manager",
          }),
          startBlock: BASE_SEPOLIA_COLLECTIVE_FACTORY.startBlock,
        },
        base: {
          address: factory({
            address: BASE_COLLECTIVE_FACTORY.address,
            event: COLLECTIVE_DEPLOYED_EVENT,
            parameter: "manager",
          }),
          startBlock: BASE_COLLECTIVE_FACTORY.startBlock,
        },
      },
    },
  },
});

/** The anvil equivalent: the same two sources, one chain, the hooks deploy. */
function buildLocalConfig() {
  const at = {
    address: ANVIL_SLOT_FACTORY,
    startBlock: ANVIL_START_BLOCK,
  };

  // A collective factory that has not been deployed yet is watched at the zero
  // address rather than dropped from the config. Dropping it would change the
  // set of registered sources, and ponder rejects handlers for a source that
  // does not exist — so `src/collective.ts` would have to be conditionally
  // imported, and a local run without collectives would stop type-checking the
  // handlers it is not running. One filter that matches nothing is cheaper.
  const collectiveAt = anvilCollectiveFactory();

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
      SlotFactory: { abi: SlotFactoryAbi, chain: { anvil: at } },
      Slot: {
        abi: SlotAbi,
        chain: {
          anvil: {
            address: factory({
              address: ANVIL_SLOT_FACTORY,
              event: SLOT_CREATED_EVENT,
              parameter: "slot",
            }),
            startBlock: ANVIL_START_BLOCK,
          },
        },
      },
      SlotCollectiveFactory: {
        abi: SlotCollectiveFactoryAbi,
        chain: { anvil: collectiveAt },
      },
      SlotCollective: {
        abi: SlotCollectiveAbi,
        chain: {
          anvil: {
            address: factory({
              address: collectiveAt.address,
              event: COLLECTIVE_DEPLOYED_EVENT,
              parameter: "manager",
            }),
            startBlock: collectiveAt.startBlock,
          },
        },
      },
    },
  });
}

/**
 * The remote config is the type witness even when running locally.
 *
 * Ponder derives `context.chain` from `config.contracts[source].chain`, so
 * exporting a union of the two configs collapses every handler's
 * `context.chain` to `unknown`. Pinning the type to one of them keeps all of
 * src/ inferring correctly; the two differ only in chain identity, and
 * handlers read nothing from `context.chain` but `.id`, which is a number in
 * both.
 */
export default LOCAL
  ? (buildLocalConfig() as unknown as typeof remoteConfig)
  : remoteConfig;
