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

/** Resolve one `--chain` token by name or id. */
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
 * Resolve `--chain` when it may name several.
 *
 * Comma-separated, plus `all` for every configured chain. Order follows what
 * was ASKED for rather than {loadChains}' own ordering, because a run that says
 * `--chain base-sepolia,base` is describing a sequence: prove it on the testnet,
 * then go. Reordering that would quietly send the mainnet transaction first.
 *
 * `all` is the exception and stays in config order — local, testnets, mainnets —
 * which puts the same "cheapest first" property back for the one spelling that
 * expresses no preference.
 *
 * Unknown tokens come back in `missing` rather than throwing, so the caller can
 * name every one of them at once instead of one per run.
 */
export function findChains(
  chains: ChainConfig[],
  arg: string | undefined,
): { found: ChainConfig[]; missing: string[] } {
  if (!arg) return { found: [], missing: [] };

  const tokens = arg
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (tokens.length === 1 && tokens[0]?.toLowerCase() === "all")
    return { found: chains, missing: [] };

  const found: ChainConfig[] = [];
  const missing: string[] = [];
  for (const token of tokens) {
    const hit = findChain(chains, token);
    if (!hit) missing.push(token);
    // Named twice is not an error, but running it twice would be: the second
    // pass would find its own broadcast already applied and report nothing to
    // do, which reads like a failure.
    else if (!found.includes(hit)) found.push(hit);
  }
  return { found, missing };
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
