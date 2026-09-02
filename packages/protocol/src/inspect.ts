import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CONTRACTS, FORGE_ENV } from "./paths.js";

/**
 * Everything an upgrade can move, and how to ask the chain what it is running.
 *
 * Two shapes, because the protocol has two:
 *
 * - `uups` — the proxy IS the address users hold, and its implementation is in
 *   the ERC-1967 slot. One contract per entry.
 * - `beacon` — the address here is an IMPLEMENTATION sitting behind a beacon
 *   that a factory owns. Hundreds of proxies delegate to it, so a moved storage
 *   slot corrupts all of them at once. It has no 1967 slot of its own; the
 *   factory is asked instead.
 *
 * The beacon entries were missing, which is why the largest blast radius in the
 * protocol was the one with no version check and no layout gate.
 */
export interface Upgradeable {
  target: string;
  kind: "uups" | "beacon";
  /** For beacons: the record naming the factory that owns the beacon. */
  owner?: string;
}

export const PROXIES: Record<string, Upgradeable> = {
  SlotFactory: { target: "src/SlotFactory.sol:SlotFactory", kind: "uups" },
  OfferBook: { target: "src/periphery/book/OfferBook.sol:OfferBook", kind: "uups" },
  SlotCollectiveFactory: {
    target: "src/collectives/SlotCollectiveFactory.sol:SlotCollectiveFactory",
    kind: "uups",
  },
  AdLand: { target: "src/hooks/adland/AdLand.sol:AdLand", kind: "uups" },
  Slot: {
    target: "src/Slot.sol:Slot",
    kind: "beacon",
    owner: "SlotFactory",
  },
  SlotCollective: {
    target: "src/collectives/SlotCollective.sol:SlotCollective",
    kind: "beacon",
    owner: "SlotCollectiveFactory",
  },
};

export interface StorageVar {
  label: string;
  slot: string;
  offset: number;
  bytes: number;
}

export type LayoutDiff =
  | { status: "ok"; added: number }
  | { status: "moved"; moved: string[] }
  | { status: "unrecorded" }
  | { status: "unreadable" };

/** `cast`, with its stderr swallowed — a missing contract is an expected answer. */
export function cast(args: string[]): string | null {
  try {
    return execFileSync("cast", args, {
      cwd: CONTRACTS,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      env: { ...process.env, ...FORGE_ENV },
    }).trim();
  } catch {
    return null;
  }
}

export const reachable = (rpc: string) =>
  cast(["block-number", "--rpc-url", rpc]) !== null;

/**
 * The version compiled into the code about to ship.
 *
 * Read from the SOURCE, because in a dry run the implementation does not exist
 * yet — there is nothing to call. `version()` is a `pure` constant precisely so
 * it can be known without a chain.
 */
export function codeVersion(target: string): string | null {
  const file = join(CONTRACTS, target.split(":")[0] ?? "");
  if (!existsSync(file)) return null;
  const m = readFileSync(file, "utf8").match(
    /function version\(\)[^{]*\{\s*return\s+(\d+);/,
  );
  return m?.[1] ?? null;
}

/** Name, slot, offset and size — the only parts an upgrade must not move. */
export function layoutOf(target: string): StorageVar[] | null {
  try {
    const l = JSON.parse(
      execFileSync("forge", ["inspect", target, "storage", "--json"], {
        cwd: CONTRACTS,
        encoding: "utf8",
        env: { ...process.env, ...FORGE_ENV },
      }),
    ) as {
      storage: { label: string; slot: string; offset: number; type: string }[];
      types: Record<string, { numberOfBytes: string }>;
    };
    return l.storage.map((v) => ({
      label: v.label,
      slot: String(v.slot),
      offset: v.offset,
      bytes: Number(l.types[v.type]?.numberOfBytes ?? 0),
    }));
  } catch {
    return null;
  }
}

export const layoutPath = (recordDir: string, name: string) =>
  join(recordDir, `${name}.layout.json`);

/**
 * Compare the layout about to ship against the one recorded when this proxy was
 * last written to.
 *
 * Against the RECORD, not a snapshot of current source. A snapshot answers "did
 * anyone move a slot since the last commit", which is a review question. An
 * upgrade asks "does this implementation still fit the storage the proxy already
 * has" — and only a record of what is deployed THERE can answer it, per chain,
 * because chains drift apart.
 *
 * Append-only: everything the deployed version had must still sit at the same
 * slot, offset and size. Adding to the end is fine.
 */
export function layoutDiff(
  recordDir: string,
  name: string,
  next: StorageVar[] | null,
): LayoutDiff {
  const p = layoutPath(recordDir, name);
  if (!existsSync(p)) return { status: "unrecorded" };
  if (!next) return { status: "unreadable" };
  const prev = JSON.parse(readFileSync(p, "utf8")) as StorageVar[];

  const moved: string[] = [];
  for (const [i, was] of prev.entries()) {
    const now = next[i];
    if (!now) {
      moved.push(`${was.label} was removed`);
      continue;
    }
    if (
      now.label !== was.label ||
      now.slot !== was.slot ||
      now.offset !== was.offset ||
      now.bytes !== was.bytes
    ) {
      moved.push(
        `${was.label} (slot ${was.slot}+${was.offset}, ${was.bytes}b) → ` +
          `${now.label} (slot ${now.slot}+${now.offset}, ${now.bytes}b)`,
      );
    }
  }
  if (moved.length) return { status: "moved", moved };
  return { status: "ok", added: Math.max(0, next.length - prev.length) };
}

/**
 * The implementation a beacon is actually pointing at.
 *
 * Asked of the factory, through its public surface: `SlotFactory` answers
 * `implementation()` directly, `SlotCollectiveFactory` hands back its beacon
 * and the beacon answers. Reading the record instead would only ever confirm
 * what we already wrote down — and the bug being guarded against is exactly the
 * record disagreeing with the chain.
 */
export function beaconImplementation(
  recordDir: string,
  ownerName: string,
  rpc: string,
): string | null {
  const owner = recordedAddress(recordDir, ownerName);
  if (!owner) return null;
  const direct = cast(["call", owner, "implementation()(address)", "--rpc-url", rpc]);
  if (direct) return direct;
  const beacon = cast(["call", owner, "beacon()(address)", "--rpc-url", rpc]);
  if (!beacon) return null;
  return cast(["call", beacon, "implementation()(address)", "--rpc-url", rpc]);
}

/**
 * The address this protocol recorded for `name`, if it recorded one.
 *
 * `version` is the discriminator and it is load-bearing. The retired protocol's
 * deploy scripts wrote these SAME filenames, so chains it reached still hold
 * pre-port records — base mainnet's `SlotCollectiveFactory.json` names
 * 0x9DE033C5, a contract this protocol never deployed. Reading it made the CLI
 * refuse to deploy to base on the grounds that base already had a collective
 * factory, which it does not.
 *
 * Only `DeployProtocol` and `SeedSlots` write `version`, so only what they wrote
 * is read. Ponder and the codegen already applied this rule; this did not.
 */
export const recordedAddress = (recordDir: string, name: string) => {
  const p = join(recordDir, `${name}.json`);
  if (!existsSync(p)) return undefined;
  const rec = JSON.parse(readFileSync(p, "utf8")) as {
    address?: `0x${string}`;
    version?: number;
  };
  if (rec.version === undefined || !rec.address) return undefined;
  if (/^0x0+$/i.test(rec.address)) return undefined;
  return rec.address;
};

/** What the deploy script says it would do to one contract. */
export type Action = "exists" | "deployed" | "current" | "upgraded" | "beacon";

/**
 * Run the deploy script WITHOUT broadcasting, and read back what it would do.
 *
 * Asked rather than re-derived. Whether a contract needs redeploying is a
 * CREATE2 question — salt, namespace and the exact initcode hash — and
 * reimplementing that here would be a second copy free to drift from the first.
 * Worse, it would drift silently: the gate would report "unchanged" while the
 * script redeployed, which is exactly what happened when the gate keyed on
 * `version()` alone. `SlotFactory` imports `Slot.sol`, so changing Slot changes
 * SlotFactory's metadata, its initcode and its address — with no version bump
 * anywhere to notice.
 *
 * `--sender` matters even here. The upgrade path calls `upgradeToAndCall`, which
 * reverts for anyone but the admin, so simulating as the default sender would
 * report a failure that is not real.
 */
export function simulate(
  rpc: string,
  admin: string,
): { actions: Map<string, { action: Action; address: string }>; log: string } {
  const log = execFileSync(
    "forge",
    [
      "script",
      "script/protocol/DeployProtocol.s.sol:DeployProtocol",
      "--rpc-url", rpc,
      "--sender", admin,
    ],
    {
      cwd: CONTRACTS,
      encoding: "utf8",
      env: { ...process.env, ...FORGE_ENV, DRY_RUN: "true" },
    },
  );

  const actions = new Map<string, { action: Action; address: string }>();
  for (const line of log.split("\n")) {
    const m = line
      .trim()
      .match(/^(exists|deployed|current|upgraded|beacon)\s+(\S+)\s+(0x[0-9a-fA-F]{40})$/);
    if (!m) continue;
    const [, action, name, address] = m as unknown as [string, Action, string, string];
    // `beacon` and `upgraded` are outcomes; keep them over a bare `exists` for
    // the same name, which only describes the implementation being present.
    const prev = actions.get(name);
    if (prev && (prev.action === "upgraded" || prev.action === "beacon")) continue;
    actions.set(name, { action, address });
  }
  return { actions, log };
}
