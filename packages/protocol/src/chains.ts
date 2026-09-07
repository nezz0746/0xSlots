import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { CONTRACTS } from "./paths.js";

export interface ChainConfig {
  name: string;
  chainId: number;
  rpcEnv: string;
  rpcUrl?: string;
  admin: `0x${string}`;
  testnet?: boolean;
  explorerVerify?: boolean;
}

export const ANVIL = 31337;

/**
 * The chains this repo can deploy to, read from `deployments/config`.
 *
 * A directory rather than a table in code: adding a chain stays one file, and
 * the picker, `--chain` validation and the "known chains" error all read the
 * same place, so they cannot disagree.
 *
 * Ordered local first, then testnets, then mainnets — which is both the order
 * you reach for them in and the order of increasing consequence.
 */
export function loadChains(): ChainConfig[] {
  const dir = join(CONTRACTS, "deployments/config");
  if (!existsSync(dir)) return [];
  const rank = (c: ChainConfig) =>
    c.chainId === ANVIL ? 0 : c.testnet ? 1 : 2;
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as ChainConfig)
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

/** Resolve `--chain` by name or id. */
export function findChain(
  chains: ChainConfig[],
  arg: string | undefined,
): ChainConfig | undefined {
  if (!arg) return undefined;
  return (
    chains.find((c) => String(c.chainId) === String(arg)) ??
    chains.find((c) => c.name === arg)
  );
}

/**
 * The endpoint for a chain.
 *
 * The env var wins, so a branch can point at its own node; the committed
 * `rpcUrl` is the public fallback that makes these commands work with no setup.
 */
export function rpcFor(cfg: ChainConfig): string | undefined {
  if (cfg.chainId === ANVIL)
    return process.env.ANVIL_RPC_URL ?? "http://127.0.0.1:8545";
  return process.env[cfg.rpcEnv] ?? cfg.rpcUrl;
}

/** Host only — an RPC URL routinely carries an API key in its path. */
export function rpcOrigin(url: string | undefined): string {
  if (!url) return "(unset)";
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

export const recordDirFor = (chainId: number) =>
  join(CONTRACTS, "deployments", String(chainId));
