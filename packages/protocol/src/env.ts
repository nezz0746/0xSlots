import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CONTRACTS } from "./paths.js";

/**
 * Load `apps/contracts/.env`, the way forge does.
 *
 * The deployer key already lives there — `forge` reads that file automatically,
 * so every other command in this repo finds it. This CLI is Node, which does
 * not, and the result was a run that simulated, asked for MAINNET confirmation,
 * got a yes, and only then said `PK is not set`.
 *
 * An already-set variable always wins, so `PK=0x… pnpm protocol …` still
 * overrides the file for a one-off key.
 *
 * Deliberately minimal: no `dotenv`, no expansion, no `export` handling. This
 * reads a file forge already parses to its own rules, and anything clever here
 * would be a second interpretation of the same file that could disagree.
 */
export function loadContractsEnv(): void {
  const path = join(CONTRACTS, ".env");
  if (!existsSync(path)) return;

  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq <= 0) continue;

    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    if (process.env[key] !== undefined) continue;

    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
