import { readFileSync } from "node:fs";
import { join } from "node:path";

// ──────────────────────────────────────────
// Deployment records
//
// Every chain reads its addresses from the records `DeployProtocol.s.sol`
// writes under apps/contracts/deployments/<chainId>/, with an env var as an
// override.
//
// The records were NOT trusted before, and the reason was real: the old
// `DeployLocal` wrote the RETIRED factory's address into the same filenames,
// so reading them would have indexed the old event set against the new schema
// and written nothing but errors. `DeployProtocol` writes the v1 addresses now,
// so the file is the truth and the env var is the escape hatch rather than the
// other way round.
//
// A chain with no record still falls back to `startBlock: "latest"`, so it
// costs a log filter at the tip rather than a historical scan for an address
// that has no code.
// ──────────────────────────────────────────

export const UNDEPLOYED = "0x0000000000000000000000000000000000000000" as const;

export type Deployment = {
  address: `0x${string}`;
  startBlock: number | "latest";
};

/**
 * Where the deployment records live, resolved without assuming a module format.
 *
 * `__dirname` exists when this config is loaded as CommonJS and is UNDEFINED
 * under an ESM loader — and the reads below are inside a `try` that treats any
 * failure as "nothing deployed there". So under the wrong loader every chain
 * resolves to the zero address, every filter matches nothing, and the indexer
 * runs to completion having indexed an empty protocol. No error, no warning.
 *
 * Ponder runs with the cwd at this package, so the two agree; the fallback is
 * only reached where `__dirname` is not defined at all.
 */
const RECORDS =
  typeof __dirname === "undefined"
    ? join(process.cwd(), "../../apps/contracts/deployments")
    : join(__dirname, "../../../apps/contracts/deployments");

/**
 * One contract's deployment on one chain: the env override, else the record.
 *
 * Reads any record, not only factories — AdLand goes through it too.
 */
export function readDeployment(
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
      join(RECORDS, String(chainId), `${name}.json`),
      "utf8",
    );
    const rec = JSON.parse(raw) as Deployment & { version?: number };

    // `version` is the discriminator, and it is load-bearing. These filenames
    // were reused by the retired protocol's deploy scripts, so the records for
    // chains the old protocol reached still hold PRE-PORT addresses — base
    // mainnet's collective factory is one. Only `DeployProtocol` writes
    // `version`, so only what it wrote is read.
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

/**
 * A record from a local-only deploy script, read without the `version` check.
 *
 * The collective and collection factories on anvil can come from a second
 * script run against an already-running chain, so their address is a function
 * of when they were deployed and cannot be pinned. Resolved in order: the env
 * var, then the record, then nothing — and ANNOUNCED at boot, so a record that
 * outlived its chain is one line you can check with `cast codesize` rather
 * than an empty table with no explanation.
 */
export function readAnvilDeployment(
  env: string,
  blockEnv: string,
  name: string,
  label: string,
  hint?: string,
): Deployment {
  const fromEnv = process.env[env] as `0x${string}` | undefined;
  if (fromEnv) {
    const block = Number(process.env[blockEnv] ?? 0);
    console.log(`[local] ${label} ${fromEnv} from block ${block} (env)`);
    return { address: fromEnv, startBlock: block };
  }
  try {
    const raw = readFileSync(join(RECORDS, "31337", `${name}.json`), "utf8");
    const { address, startBlock } = JSON.parse(raw) as Deployment;
    // The recorded block, not 0: these come up long after the protocol does,
    // so starting at 0 would be a thousand empty `eth_getLogs` first.
    console.log(
      `[local] ${label} ${address} from block ${startBlock} ` +
        `(deployments/31337) — verify with: cast codesize ${address}`,
    );
    return { address, startBlock };
  } catch {
    if (hint) console.log(`[local] no ${label}: ${hint}`);
    return { address: UNDEPLOYED, startBlock: 0 };
  }
}

/**
 * A record on anvil, indexed from genesis unless told otherwise.
 *
 * Anvil always has a real record when it has a chain at all, so `"latest"`
 * only ever means "no record" — and there is nothing to skip ahead to on a
 * chain this short.
 */
export function fromGenesis(rec: Deployment, blockEnv: string) {
  return {
    address: rec.address,
    startBlock: Number(
      process.env[blockEnv] ??
        (rec.startBlock === "latest" ? 0 : rec.startBlock),
    ),
  };
}
