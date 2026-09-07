import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * This package lives in `packages/`, the Foundry project in `apps/contracts`.
 *
 * Resolved from this file rather than from `process.cwd()`, so the CLI behaves
 * the same whether it is run from the repo root, from a workspace filter, or
 * from a `bin` link.
 */
export const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
export const CONTRACTS = join(REPO, "apps", "contracts");

/** Foundry prints a banner on nightlies that would otherwise fill the spinner. */
export const FORGE_ENV = { FOUNDRY_DISABLE_NIGHTLY_WARNING: "1" };
