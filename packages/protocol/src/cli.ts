#!/usr/bin/env tsx
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import * as p from "@clack/prompts";
import { Command } from "commander";
import c from "picocolors";

import {
  ANVIL,
  type ChainConfig,
  findChain,
  loadChains,
  recordDirFor,
  rpcFor,
  rpcOrigin,
} from "./chains.js";
import {
  PROXIES,
  beaconImplementation,
  cast,
  simulate,
  codeVersion,
  layoutDiff,
  layoutOf,
  layoutPath,
  reachable,
  recordedAddress,
} from "./inspect.js";
import { CONTRACTS, FORGE_ENV, REPO } from "./paths.js";

type Mode = "deploy" | "upgrade";
interface Options {
  chain?: string;
  dry?: boolean;
  yes?: boolean;
}

function bail(msg: string, hint?: string): never {
  p.log.error(msg);
  if (hint) p.log.message(c.dim(hint));
  p.outro(c.red("stopped"));
  process.exit(1);
}

/** A cancelled prompt is a decision, not an error. */
function ok<T>(v: T | symbol): T {
  if (p.isCancel(v)) {
    p.cancel("Cancelled.");
    process.exit(0);
  }
  return v as T;
}

const interactive = () => process.stdin.isTTY === true;

/** Visible width — colour codes are bytes, not columns, and break padding. */
const stripped = (s: string) => s.replace(/\u001b\[[0-9;]*m/g, "");

async function pickMode(): Promise<Mode> {
  return ok(
    await p.select<Mode>({
      message: "What would you like to do?",
      options: [
        {
          value: "upgrade",
          label: "Upgrade",
          hint: "move live proxies to the current implementations",
        },
        {
          value: "deploy",
          label: "Deploy",
          hint: "stand the protocol up on a chain that has none",
        },
      ],
    }),
  );
}

async function pickChain(chains: ChainConfig[]): Promise<ChainConfig> {
  return ok(
    await p.select<ChainConfig>({
      message: "Which chain?",
      options: chains.map((x) => ({
        value: x,
        label: x.chainId === ANVIL ? c.dim(x.name) : x.name,
        hint:
          x.chainId === ANVIL
            ? `${x.chainId} · local`
            : x.testnet
              ? `${x.chainId} · testnet`
              : `${x.chainId} · ${c.red("mainnet")}`,
      })),
    }),
  );
}

async function run(mode: Mode | undefined, opts: Options) {
  p.intro(c.bgCyan(c.black(" 0xSlots protocol ")));

  const chains = loadChains();
  if (!chains.length) bail("No chain configs in apps/contracts/deployments/config.");

  if (!mode) {
    if (!interactive()) bail("No command given.", "Try: protocol upgrade --help");
    mode = await pickMode();
  }

  // ── which chain ───────────────────────────────────────────────────────────
  const requested = opts.chain ?? process.env.CHAIN;
  let cfg = findChain(chains, requested);
  if (requested && !cfg)
    bail(
      `No chain "${requested}".`,
      `Known: ${chains.map((x) => `${x.name} (${x.chainId})`).join(", ")}`,
    );
  if (!cfg) {
    if (!interactive()) bail("No --chain given and nothing to prompt with.");
    cfg = await pickChain(chains);
  }

  const chainId = cfg.chainId;
  const local = chainId === ANVIL;
  const rpc = rpcFor(cfg);
  if (!rpc) bail(`No RPC for ${cfg.name}.`, `Set ${cfg.rpcEnv}, or add "rpcUrl".`);

  // ── dry or for real ───────────────────────────────────────────────────────
  //
  // Asked only when it was not said. A flag is an answer; re-asking would make
  // the scripted path prompt for something it already decided.
  let dry = opts.dry ?? false;
  if (opts.dry === undefined && interactive()) {
    dry = ok(
      await p.select<boolean>({
        message: `On ${c.bold(cfg.name)}:`,
        options: [
          { value: true, label: "Dry run", hint: "report only, send nothing" },
          {
            value: false,
            label: local ? "Broadcast" : c.yellow("Broadcast"),
            hint: local ? "local chain" : "sends transactions",
          },
        ],
        initialValue: !local,
      }),
    );
  }

  p.log.step(
    `${c.bold(cfg.name)} ${c.dim(`(${chainId})`)}  ${c.dim(rpcOrigin(rpc))}\n` +
      `${c.dim("admin")}  ${cfg.admin}`,
  );

  if (!reachable(rpc))
    bail(
      `${cfg.name} is not reachable at ${rpcOrigin(rpc)}.`,
      local ? "Start it with:  pnpm dev:local" : `Check ${cfg.rpcEnv}.`,
    );

  // ── deploy vs upgrade ─────────────────────────────────────────────────────
  const recordDir = recordDirFor(chainId);
  const records = existsSync(recordDir)
    ? readdirSync(recordDir).filter((f) => f.endsWith(".json"))
    : [];
  const liveProxies = Object.keys(PROXIES).filter((n) =>
    records.includes(`${n}.json`),
  );

  if (mode === "upgrade" && liveProxies.length === 0)
    bail(
      `Nothing is deployed on ${cfg.name}, so there is nothing to upgrade.`,
      `Run:  pnpm protocol deploy --chain ${cfg.name}`,
    );
  if (mode === "deploy" && liveProxies.length > 0)
    bail(
      `${cfg.name} already has ${liveProxies.join(", ")}.`,
      `Deploying again would stand up a SECOND protocol beside the live one.\n` +
        `Run:  pnpm protocol upgrade --chain ${cfg.name}`,
    );

  const spin0 = p.spinner();
  const step0 = <T>(label: string, fn: () => T): T => {
    spin0.start(label);
    try {
      const out = fn();
      spin0.stop(`${label} ${c.green("✓")}`);
      return out;
    } catch (e) {
      spin0.stop(`${label} ${c.red("✗")}`);
      throw e;
    }
  };

  // ── what the script would do ──────────────────────────────────────────────
  //
  // Simulated, not re-derived. Whether a contract needs redeploying is a CREATE2
  // question, and the only thing that can answer it correctly is the script that
  // computes the salts.
  let plan;
  try {
    plan = step0(`Simulating on ${cfg.name}`, () => simulate(rpc, cfg.admin));
  } catch (e) {
    const out = String((e as { stdout?: string }).stdout ?? (e as Error).message);
    p.log.error(out.split("\n").slice(-12).join("\n"));
    return bail("The simulation failed. Nothing was sent.");
  }

  // ── the gate ──────────────────────────────────────────────────────────────
  const rows: string[] = [];
  const blocked: { name: string; moved: string[] }[] = [];
  let changing = 0;

  for (const [name, spec] of Object.entries(PROXIES)) {
    const code = codeVersion(spec.target);
    const next = layoutOf(spec.target);

    // A UUPS proxy IS the address; a beacon implementation is behind one, so
    // the factory is asked what it is currently serving.
    const at =
      spec.kind === "uups"
        ? recordedAddress(recordDir, name)
        : beaconImplementation(recordDir, spec.owner!, rpc);

    if (!at) {
      rows.push(
        `${c.bold(name.padEnd(22))} ${c.cyan("new".padEnd(12))} code v${code ?? "?"}`,
      );
      continue;
    }
    const onChain = cast(["call", at, "version()(uint64)", "--rpc-url", rpc]);

    // The script's own verdict, not a version comparison. They disagree exactly
    // when a contract's bytecode moved without its version — which is the case
    // the version check cannot see.
    const act = plan.actions.get(name)?.action;
    const willChange =
      act === "deployed" || act === "upgraded" || act === "beacon";
    if (willChange) changing++;

    const d = layoutDiff(recordDir, name, next);
    if (d.status === "moved") blocked.push({ name, moved: d.moved });

    const note =
      d.status === "moved"
        ? c.red("STORAGE MOVED")
        : d.status === "unrecorded"
          ? c.dim("layout not recorded")
          : d.status === "unreadable"
            ? c.yellow("layout unreadable")
            : d.added
              ? c.green(`+${d.added} slot${d.added > 1 ? "s" : ""}`)
              : c.dim("layout ok");

    const label =
      spec.kind === "beacon" ? `${name} ${c.dim("(beacon)")}` : name;
    const verdict = willChange
      ? c.yellow(act === "beacon" ? "BEACON" : "UPGRADE")
      : c.dim("unchanged");
    const versions =
      onChain === code
        ? c.dim(`v${code ?? "?"}`)
        : c.yellow(`v${onChain ?? "?"} → v${code ?? "?"}`);

    rows.push(
      `${c.bold(label)}${" ".repeat(Math.max(1, 26 - stripped(label).length))}` +
        `${verdict}${" ".repeat(Math.max(1, 11 - stripped(verdict).length))}` +
        `${versions}${" ".repeat(Math.max(1, 12 - stripped(versions).length))}` +
        `${note}`,
    );
  }
  p.note(rows.join("\n"), mode === "deploy" ? "to deploy" : "what would change");

  if (blocked.length) {
    for (const b of blocked)
      p.log.error(`${b.name}\n${b.moved.map((m) => `  ${m}`).join("\n")}`);
    bail(
      "A storage slot moved under a live proxy.",
      "Every value after it would be read from the wrong place, and an upgrade\n" +
        "cannot take that back. Append new variables instead of inserting them.",
    );
  }

  if (dry) {
    p.log.info(c.dim("Nothing was sent and no record was written."));
    p.outro(`Apply it:  ${c.bold(`pnpm protocol ${mode} --chain ${cfg.name}`)}`);
    return;
  }

  if (mode === "upgrade" && changing === 0) {
    p.outro(c.green("Every contract is already running its current code."));
    return;
  }

  // ── confirm, proportional to what a mistake costs ─────────────────────────
  //
  // Anvil is wiped several times an hour and has nothing to corrupt, so a
  // prompt there is friction on the loop you are actually in.
  if (!local && !opts.yes) {
    if (!interactive())
      bail("Refusing to broadcast unprompted.", "Pass --yes to skip the prompt.");
    const go = ok(
      await p.confirm({
        message: cfg.testnet
          ? `Broadcast to ${c.bold(cfg.name)}?`
          : `Broadcast to ${c.red(c.bold(`${cfg.name} — MAINNET`))}?`,
        initialValue: false,
      }),
    );
    if (!go) {
      p.cancel("Cancelled.");
      process.exit(0);
    }
  }

  const key =
    process.env.PK ??
    (local
      ? "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
      : undefined);
  if (!key) bail("PK is not set, so nothing can be broadcast.");

  // ── go ────────────────────────────────────────────────────────────────────
  const spin = p.spinner();
  const step = <T>(label: string, fn: () => T): T => {
    spin.start(label);
    try {
      const out = fn();
      spin.stop(`${label} ${c.green("✓")}`);
      return out;
    } catch (e) {
      spin.stop(`${label} ${c.red("✗")}`);
      throw e;
    }
  };

  let log = "";
  try {
    log = step(
      `${mode === "deploy" ? "Deploying" : "Upgrading"} on ${cfg.name}`,
      () =>
        execFileSync(
          "forge",
          [
            "script",
            "script/protocol/DeployProtocol.s.sol:DeployProtocol",
            "--rpc-url", rpc,
            "--broadcast",
            "--private-key", key,
          ],
          {
            cwd: CONTRACTS,
            encoding: "utf8",
            env: { ...process.env, ...FORGE_ENV, DRY_RUN: "false" },
          },
        ),
    );
  } catch (e) {
    const out = String((e as { stdout?: string }).stdout ?? (e as Error).message);
    p.log.error(out.split("\n").slice(-12).join("\n"));
    bail("The protocol script failed. Nothing was recorded.");
  }

  const outcome = log
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^(deployed|upgraded)\s/.test(l));
  if (outcome.length) p.note(outcome.join("\n"), "on chain");

  // Written only after a successful broadcast, so the file always describes
  // what is actually behind the proxy. This is the next upgrade's baseline.
  step("Recording storage layouts", () => {
    for (const [name, spec] of Object.entries(PROXIES)) {
      if (!recordedAddress(recordDir, name)) continue;
      const l = layoutOf(spec.target);
      if (l)
        writeFileSync(
          layoutPath(recordDir, name),
          `${JSON.stringify(l, null, 2)}\n`,
        );
    }
  });

  const pnpm = (args: string[]) =>
    execFileSync("pnpm", args, { cwd: REPO, encoding: "utf8", stdio: "pipe" });

  step("Regenerating ABIs and addresses", () =>
    pnpm(["--filter", "@0xslots/contracts", "codegen"]),
  );
  step("Rebuilding @0xslots/contracts", () =>
    pnpm(["--filter", "@0xslots/contracts", "build"]),
  );
  step("Rebuilding @0xslots/sdk", () =>
    pnpm(["--filter", "@0xslots/sdk", "build"]),
  );

  p.outro(c.green(`${cfg.name} is up to date.`));
}

const program = new Command();
program
  .name("protocol")
  .description("Deploy and upgrade the Slots protocol on one chain.")
  // Deliberately NO options here. Declaring them on both the program and its
  // subcommands makes the program-level one win — commander consumes
  // `--chain base-sepolia` as a global before `upgrade` ever sees it, and the
  // subcommand runs with nothing. Bare `protocol` asks for everything anyway.
  .action(() => go(undefined, {}));

for (const mode of ["deploy", "upgrade"] as const) {
  program
    .command(mode)
    .description(
      mode === "deploy"
        ? "Stand the protocol up on a chain that has none."
        : "Move live proxies to the current implementations.",
    )
    .option("-c, --chain <name>", "chain name or id; prompts when omitted")
    .option("-d, --dry", "report what would happen, send nothing")
    .option("-y, --yes", "skip the confirmation prompt")
    .action((opts: Options) => go(mode, opts));
}

function go(mode: Mode | undefined, opts: Options) {
  run(mode, opts).catch((e: unknown) => {
    p.log.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
}

program.parseAsync(process.argv);
