import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { defineConfig } from "@wagmi/cli";
import { foundry } from "@wagmi/cli/plugins";

/**
 * ABIs and addresses, generated from the Foundry build and the deployment
 * records.
 *
 * This replaces two hand-rolled generators. They worked, but every consumer had
 * to trust that somebody had remembered to run them — and twice they had not:
 * `version()` reached none of the ABIs for a whole release, and the local test
 * token pointed at an address with no code while every ERC-20 approval reverted
 * with nothing naming the cause.
 */

const REPO = join(__dirname, "..", "..");
const CONTRACTS = join(REPO, "apps/contracts");
const DEPLOYMENTS = join(CONTRACTS, "deployments");

/**
 * The contracts the SDK and the app speak to.
 *
 * An allowlist rather than an exclude list, because `src/v1/` still holds
 * same-named `Slot`, `SlotFactory` and `OfferBook` contracts. Matching by name
 * would resolve to whichever artifact the glob reached first, and the retired
 * protocol's ABI against the live schema is a filter that silently matches
 * nothing.
 */
const INCLUDE = [
  "Slot",
  "SlotFactory",
  "OfferBook",
  "SlotCollective",
  "SlotCollectiveFactory",
  "AdLand",
  "CompositeHook",
  "MinimumTenureHook",
  "MinimumTenureHookFactory",
  // Local only, and deployed by `SeedSlots` rather than `DeployProtocol`. It is
  // here for its ADDRESS: plain CREATE means it moves whenever the seed changes
  // what it deploys, and it was hand-typed in the SDK until it pointed at an
  // address with no code.
  "SlotsTestToken",
] as const;

/**
 * Addresses, read from what the deploy script wrote.
 *
 * `version` is the discriminator and it is load-bearing: the retired protocol's
 * scripts wrote these same filenames, so records for chains it reached still
 * hold PRE-PORT addresses. Only `DeployProtocol` and `SeedSlots` write
 * `version`, so only what they wrote is read.
 */
function deployments(): Record<string, Record<number, `0x${string}`>> {
  const out: Record<string, Record<number, `0x${string}`>> = {};
  if (!existsSync(DEPLOYMENTS)) return out;

  for (const chainId of readdirSync(DEPLOYMENTS)) {
    if (!/^\d+$/.test(chainId)) continue;
    for (const file of readdirSync(join(DEPLOYMENTS, chainId))) {
      if (!file.endsWith(".json")) continue;
      const name = file.slice(0, -5);
      let rec: { address?: string; version?: number };
      try {
        rec = JSON.parse(
          readFileSync(join(DEPLOYMENTS, chainId, file), "utf8"),
        );
      } catch {
        continue;
      }
      if (rec.version === undefined || !rec.address) continue;
      if (/^0x0+$/i.test(rec.address)) continue;
      (out[name] ??= {})[Number(chainId)] = rec.address as `0x${string}`;
    }
  }
  return out;
}

export default defineConfig({
  out: "src/generated.ts",
  plugins: [
    foundry({
      project: CONTRACTS,
      artifacts: "out",
      include: INCLUDE.map((n) => `${n}.json`),
      // Forge disambiguates colliding source basenames by path, so the retired
      // protocol's artifacts land under `v1/` and `periphery/`. Without these,
      // `OfferBook.json` matches twice and generation fails with "must be
      // unique" — which is the good outcome. The bad one would have been a
      // silent pick.
      exclude: ["v1/**", "periphery/**", "draft/**"],
      // `forge build` is the caller's job. Running it from here would rebuild
      // on every `wagmi generate`, including the one CI runs purely to diff.
      forge: { build: false },
      deployments: deployments(),
    }),
  ],
});
