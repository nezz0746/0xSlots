#!/usr/bin/env tsx
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import * as p from "@clack/prompts";
import { Command } from "commander";
import c from "picocolors";

import {
  ANVIL,
  type ChainConfig,
  findChains,
  loadChains,
  recordDirFor,
  rpcFor,
  rpcOrigin,
} from "./chains.js";
import {
  IMMUTABLES,
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
  scriptVersion,
} from "./inspect.js";
import { loadContractsEnv } from "./env.js";
import { CONTRACTS, FORGE_ENV, REPO } from "./paths.js";

// Before anything reads `process.env`.
loadContractsEnv();

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

/** An address, short enough to sit in a table and long enough to compare. */
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

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

/**
 * Which chains to act on.
 *
 * Multi-select rather than one-at-a-time, because the thing being rolled out is
 * ONE set of implementations and the interesting question is which chains are
 * behind it. Running the command once per chain also meant confirming each in
 * isolation, so nobody ever saw "these three, including a mainnet" as a single
 * decision — which is the decision actually being made.
 *
 * Nothing is pre-selected. A default here would be a default about where to
 * send transactions.
 */
async function pickChains(chains: ChainConfig[]): Promise<ChainConfig[]> {
  const picked = ok(
    await p.multiselect<ChainConfig>({
      message: "Which chains?",
      required: true,
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

  // Config order — local, testnets, mainnets — regardless of the order they
  // were ticked in, so the cheapest place to be wrong is always tried first.
  // An explicit `--chain a,b` keeps its own order; a checkbox list expresses no
  // sequence, so imposing the safe one costs nothing.
  return chains.filter((x) => picked.includes(x));
}

/** Everything one chain can be asked without sending anything. */
interface Preflight {
  cfg: ChainConfig;
  rpc: string;
  local: boolean;
  recordDir: string;
  rows: string[];
  standalone: string[];
  changing: number;
  blocked: { name: string; moved: string[] }[];
  /** Set when this chain will be left alone, and why. */
  skip?: string;
  /**
   * The KIND of skip, so the summary can act on it rather than only print it.
   *
   * `wrong-mode` is the one that earns a field of its own: it means the chain
   * is fine and the command was wrong, which is the only skip with an obvious
   * next command — and the only one worth offering.
   */
  skipKind?: "wrong-mode" | "unreachable" | "unconfigured" | "failed";
}

type Step = <T>(label: string, fn: () => T) => T;

function spinnerStep(): Step {
  const spin = p.spinner();
  return <T>(label: string, fn: () => T): T => {
    spin.start(label);
    try {
      const out = fn();
      spin.stop(`${label} ${c.green("\u2713")}`);
      return out;
    } catch (e) {
      spin.stop(`${label} ${c.red("\u2717")}`);
      throw e;
    }
  };
}

/**
 * Read one chain, decide nothing.
 *
 * ── Why a chain that cannot be acted on is skipped, not fatal ─────────────
 *
 * These used to be `bail`s, which was right when a run meant one chain: a
 * missing RPC or an unreachable node is worth stopping for when it is the only
 * thing you asked about. Across a set it is the opposite — refusing to upgrade
 * four healthy chains because a fifth is unreachable turns one flaky endpoint
 * into a stalled rollout, and the obvious workaround is to re-run without it,
 * which is exactly what this does automatically and says out loud.
 *
 * The reason travels with the result so the summary can name it. Silence would
 * be the real failure: a chain quietly absent from the outcome reads as done.
 */
function preflight(mode: Mode, cfg: ChainConfig, step: Step): Preflight {
  const chainId = cfg.chainId;
  const local = chainId === ANVIL;
  const rpc = rpcFor(cfg);
  const recordDir = recordDirFor(chainId);

  const base: Preflight = {
    cfg,
    rpc: rpc ?? "",
    local,
    recordDir,
    rows: [],
    standalone: [],
    changing: 0,
    blocked: [],
  };

  if (!rpc)
    return {
      ...base,
      skipKind: "unconfigured",
      skip: `no RPC — set ${cfg.rpcEnv}`,
    };
  if (!reachable(rpc))
    return {
      ...base,
      skipKind: "unreachable",
      skip: local ? "not running" : `unreachable at ${rpcOrigin(rpc)}`,
    };

  // The admin is the only key that can upgrade anything here. A zero one is not
  // a permissive default, it is a protocol nobody can ever fix — and the
  // mainnet configs ship zeroed deliberately, so this is the likely state, not
  // an unlikely one.
  if (/^0x0+$/i.test(cfg.admin))
    return {
      ...base,
      skipKind: "unconfigured",
      skip: `no admin in deployments/config/${chainId}.json`,
    };

  // Asked through `recordedAddress`, not by listing filenames: a file existing
  // is not evidence THIS protocol wrote it.
  const liveProxies = Object.keys(PROXIES).filter((n) =>
    Boolean(recordedAddress(recordDir, n)),
  );

  if (mode === "upgrade" && liveProxies.length === 0)
    return { ...base, skipKind: "wrong-mode", skip: "nothing deployed here yet" };
  if (mode === "deploy" && liveProxies.length > 0)
    return {
      ...base,
      skipKind: "wrong-mode",
      skip: `already deployed (${liveProxies.length}/${Object.keys(PROXIES).length})`,
    };

  // ── what the script would do ──────────────────────────────────────────────
  //
  // Simulated, not re-derived. Whether a contract needs redeploying is a CREATE2
  // question, and the only thing that can answer it correctly is the script that
  // computes the salts.
  let plan;
  try {
    plan = step(`Simulating on ${cfg.name}`, () => simulate(rpc, cfg.admin));
  } catch (e) {
    const out = String((e as { stdout?: string }).stdout ?? (e as Error).message);
    p.log.error(out.split("\n").slice(-12).join("\n"));
    return { ...base, skipKind: "failed", skip: "the simulation failed" };
  }

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
      // A contract that is not there yet is the LARGEST change available, and
      // this used to `continue` before counting it — so an upgrade run whose
      // only work was a missing contract reported "everything is already
      // running its current code" and did nothing. The simulation still has the
      // last word: `current` here would mean the script disagrees that it is
      // missing.
      const act = plan.actions.get(name)?.action;
      if (act === "deployed" || act === "upgraded") changing++;
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
        : c.yellow(`v${onChain ?? "?"} \u2192 v${code ?? "?"}`);

    rows.push(
      `${c.bold(label)}${" ".repeat(Math.max(1, 26 - stripped(label).length))}` +
        `${verdict}${" ".repeat(Math.max(1, 11 - stripped(verdict).length))}` +
        `${versions}${" ".repeat(Math.max(1, 12 - stripped(versions).length))}` +
        `${note}`,
    );
  }

  // ── the contracts that are never upgraded ─────────────────────────────────
  //
  // Reported separately, and NOT merged into the table above, because the word
  // "upgrade" means something different here. A proxy moves; these do not. A
  // change stands up a new contract beside the old one, and the old one keeps
  // serving whoever is already pointed at it — so the interesting column is the
  // ADDRESS, not the version.
  const standalone: string[] = [];
  const movedStandalone: string[] = [];
  for (const [name, spec] of Object.entries(IMMUTABLES)) {
    const was = recordedAddress(recordDir, name);
    const act = plan.actions.get(name);
    const code = spec.versionConstant
      ? scriptVersion(spec.versionConstant)
      : codeVersion(spec.target);

    // No line from the simulation means the script never reached this contract
    // — a script that stopped early, or one this entry has drifted out of sync
    // with. Said out loud rather than rendered as "unchanged", which is the one
    // reading that would be wrong.
    if (!act) {
      standalone.push(
        `${c.bold(name.padEnd(22))} ${c.yellow("not in plan".padEnd(14))} ` +
          `${c.dim("the deploy script reported nothing for it")}`,
      );
      continue;
    }

    // The address it USED to be, when the plan moves it — null when it did not.
    const previous =
      was && was.toLowerCase() !== act.address.toLowerCase() ? was : null;
    const moved = previous !== null;
    if (!was || moved) changing++;

    const verdict = !was
      ? c.cyan("new".padEnd(14))
      : moved
        ? c.yellow("NEW ADDRESS".padEnd(14))
        : c.dim("unchanged".padEnd(14));

    const detail = previous
      ? `${short(act.address)}  ${c.dim(`was ${short(previous)}`)}`
      : `${short(act.address)}${code ? c.dim(`  v${code}`) : ""}`;

    standalone.push(`${c.bold(name.padEnd(22))} ${verdict} ${detail}`);
    if (moved) movedStandalone.push(name);
  }
  if (standalone.length && movedStandalone.length)
    standalone.push(
      "",
      c.dim("The old address keeps running. Slots already attached to it"),
      c.dim("stay on it; only new ones can point at the new address."),
    );

  return { ...base, rows, standalone, changing, blocked };
}

/**
 * The key for one chain.
 *
 * Anvil's well-known account is a default only for anvil. Letting it stand in
 * for a missing `PK` anywhere else would send a real transaction from a key
 * whose private half is in every tutorial on the internet.
 */
const keyFor = (pf: Preflight) =>
  process.env.PK ??
  (pf.local
    ? "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    : undefined);

async function run(mode: Mode | undefined, opts: Options) {
  p.intro(c.bgCyan(c.black(" 0xSlots protocol ")));

  const chains = loadChains();
  if (!chains.length) bail("No chain configs in apps/contracts/deployments/config.");

  if (!mode) {
    if (!interactive()) bail("No command given.", "Try: protocol upgrade --help");
    mode = await pickMode();
  }

  // ── which chains ──────────────────────────────────────────────────────────
  const requested = opts.chain ?? process.env.CHAIN;
  const { found, missing } = findChains(chains, requested);
  if (missing.length)
    bail(
      `No chain ${missing.map((m) => `"${m}"`).join(", ")}.`,
      `Known: ${chains.map((x) => `${x.name} (${x.chainId})`).join(", ")}\n` +
        `Several at once: --chain base-sepolia,base   ·   everything: --chain all`,
    );

  let selected = found;
  if (!selected.length) {
    if (!interactive()) bail("No --chain given and nothing to prompt with.");
    selected = await pickChains(chains);
  }

  // ── dry or for real ───────────────────────────────────────────────────────
  //
  // Asked only when it was not said. A flag is an answer; re-asking would make
  // the scripted path prompt for something it already decided.
  let dry = opts.dry ?? false;
  if (opts.dry === undefined && interactive()) {
    const allLocal = selected.every((x) => x.chainId === ANVIL);
    dry = ok(
      await p.select<boolean>({
        message:
          selected.length === 1
            ? `On ${c.bold(selected[0]!.name)}:`
            : `On ${c.bold(String(selected.length))} chains:`,
        options: [
          { value: true, label: "Dry run", hint: "report only, send nothing" },
          {
            value: false,
            label: allLocal ? "Broadcast" : c.yellow("Broadcast"),
            hint: allLocal ? "local chain" : "sends transactions",
          },
        ],
        initialValue: !allLocal,
      }),
    );
  }

  // ── read every chain before touching any of them ──────────────────────────
  //
  // All the reading first, then one decision, then all the writing. Interleaving
  // them — plan a chain, send to it, plan the next — means the mainnet
  // confirmation appears after transactions have already landed elsewhere, so
  // the answer "no" comes too late to mean anything.
  const step0 = spinnerStep();
  const results: Preflight[] = [];

  for (const cfg of selected) {
    const rpc = rpcFor(cfg);
    p.log.step(
      `${c.bold(cfg.name)} ${c.dim(`(${cfg.chainId})`)}  ${c.dim(rpcOrigin(rpc))}\n` +
        `${c.dim("admin")}  ${cfg.admin}`,
    );

    const pf = preflight(mode, cfg, step0);
    results.push(pf);

    if (pf.skip) {
      p.log.warn(`${c.bold(cfg.name)} skipped \u2014 ${pf.skip}`);
      continue;
    }
    p.note(pf.rows.join("\n"), `${cfg.name} \u2014 ${mode === "deploy" ? "to deploy" : "what would change"}`);
    if (pf.standalone.length)
      p.note(pf.standalone.join("\n"), `${cfg.name} \u2014 standalone`);
  }

  // ── the gate ──────────────────────────────────────────────────────────────
  //
  // One moved slot stops the WHOLE run, not just the chain that noticed it. The
  // same implementation is going everywhere, so a layout that moved is a fact
  // about the code rather than about a chain — the others have simply not been
  // asked yet, and letting them proceed would corrupt them one at a time.
  const blocked = results.flatMap((r) =>
    r.blocked.map((b) => ({ chain: r.cfg.name, ...b })),
  );
  if (blocked.length) {
    for (const b of blocked)
      p.log.error(
        `${b.chain} \u00b7 ${b.name}\n${b.moved.map((m) => `  ${m}`).join("\n")}`,
      );
    bail(
      "A storage slot moved under a live proxy.",
      "Every value after it would be read from the wrong place, and an upgrade\n" +
        "cannot take that back. Append new variables instead of inserting them.",
    );
  }

  const skipped = results.filter((r) => r.skip);
  const actionable = results.filter(
    (r) => !r.skip && (mode === "deploy" || r.changing > 0),
  );
  const uptodate = results.filter(
    (r) => !r.skip && mode === "upgrade" && r.changing === 0,
  );

  if (dry) {
    summarise(mode, actionable, uptodate, skipped, true);

    if (actionable.length) {
      const names = actionable.map((r) => r.cfg.name).join(",");
      p.outro(`Apply it:  ${c.bold(`pnpm protocol ${mode} --chain ${names}`)}`);
      return;
    }

    const wrongMode = skipped.filter((r) => r.skipKind === "wrong-mode");
    if (wrongMode.length && wrongMode.length === results.length) {
      const other: Mode = mode === "deploy" ? "upgrade" : "deploy";
      const names = wrongMode.map((r) => r.cfg.name).join(",");
      p.outro(`Try:  ${c.bold(`pnpm protocol ${other} --dry --chain ${names}`)}`);
      return;
    }

    p.outro(c.dim("Nothing was sent and no record was written."));
    return;
  }

  if (!actionable.length) {
    summarise(mode, actionable, uptodate, skipped, false);

    // Every chain turned this command away, and all for the same reason: the
    // protocol is there and you asked to deploy, or it is not and you asked to
    // upgrade. That is a mistyped command rather than a state to investigate,
    // so the useful output is the command you meant — not a table repeating
    // "wrong mode" once per chain and then saying "Nothing to do."
    const wrongMode = skipped.filter((r) => r.skipKind === "wrong-mode");
    if (wrongMode.length && wrongMode.length === results.length) {
      const other: Mode = mode === "deploy" ? "upgrade" : "deploy";
      const names = wrongMode.map((r) => r.cfg.name).join(",");
      p.log.info(
        mode === "deploy"
          ? "Every chain you picked already has the protocol on it."
          : "None of the chains you picked have the protocol on them yet.",
      );
      p.outro(`Try:  ${c.bold(`pnpm protocol ${other} --chain ${names}`)}`);
      return;
    }

    p.outro(
      uptodate.length
        ? c.green("Every contract is already running its current code.")
        : c.yellow("Nothing to do."),
    );
    return;
  }

  // Everything checkable, before the point of no return. This used to sit AFTER
  // the confirmation, so a mainnet run could be simulated, confirmed out loud,
  // and only then told the key was missing — which teaches people that the
  // scary prompt is not the last word, and that is the opposite of what it is
  // for.
  const keyless = actionable.filter((r) => !keyFor(r));
  if (keyless.length)
    bail(
      "PK is not set, so nothing can be broadcast.",
      `Needed for ${keyless.map((r) => r.cfg.name).join(", ")}.\n` +
        `Put it in apps/contracts/.env, or pass it for one run:\n` +
        `  PK=0x\u2026 pnpm protocol ${mode} --chain ${actionable.map((r) => r.cfg.name).join(",")}`,
    );

  // ── confirm, once, proportional to what a mistake costs ───────────────────
  //
  // One prompt for the whole set rather than one per chain. Confirming each in
  // turn hides the shape of what is about to happen: "yes" four times is not
  // the same decision as "yes, to these four, two of which are mainnets".
  //
  // Anvil is wiped several times an hour and has nothing to corrupt, so a run
  // that is entirely local skips this — it is friction on the loop you are
  // actually in.
  const remote = actionable.filter((r) => !r.local);
  const mainnets = remote.filter((r) => !r.cfg.testnet);

  if (remote.length && !opts.yes) {
    if (!interactive())
      bail("Refusing to broadcast unprompted.", "Pass --yes to skip the prompt.");

    const list = actionable
      .map((r) =>
        r.local
          ? `  ${c.dim(r.cfg.name)} ${c.dim("· local")}`
          : r.cfg.testnet
            ? `  ${r.cfg.name} ${c.dim("· testnet")}`
            : `  ${c.red(c.bold(r.cfg.name))} ${c.red("· MAINNET")}`,
      )
      .join("\n");
    p.note(list, `about to ${mode}`);

    const go = ok(
      await p.confirm({
        message: mainnets.length
          ? `Broadcast to ${c.red(c.bold(`${mainnets.length} MAINNET${mainnets.length > 1 ? "S" : ""}`))} and ${actionable.length - mainnets.length} other chain(s)?`
          : `Broadcast to ${c.bold(String(actionable.length))} chain(s)?`,
        initialValue: false,
      }),
    );
    if (!go) {
      p.cancel("Cancelled.");
      process.exit(0);
    }
  }

  // ── go, one chain at a time ───────────────────────────────────────────────
  //
  // Sequential on purpose. `forge script` keeps a broadcast cache under
  // `apps/contracts`, and two of them running at once would be writing the same
  // files; the terminal is also one spinner wide. Slower, and the alternative is
  // a rollout whose failures cannot be told apart.
  const step = spinnerStep();
  const done: Preflight[] = [];
  const failed: { cfg: ChainConfig; reason: string }[] = [];

  for (const pf of actionable) {
    const key = keyFor(pf)!;
    let log = "";
    try {
      log = step(
        `${mode === "deploy" ? "Deploying" : "Upgrading"} on ${pf.cfg.name}`,
        () =>
          execFileSync(
            "forge",
            [
              "script",
              "script/protocol/DeployProtocol.s.sol:DeployProtocol",
              "--rpc-url", pf.rpc,
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
      p.log.error(`${pf.cfg.name}\n${out.split("\n").slice(-12).join("\n")}`);
      failed.push({ cfg: pf.cfg, reason: "the protocol script failed" });
      // Carried on rather than aborted: the chains already broadcast to cannot
      // be un-broadcast, so stopping here would leave the set half-applied AND
      // half-unattempted, which is strictly worse than half-applied and known.
      continue;
    }

    const outcome = log
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /^(deployed|upgraded)\s/.test(l));
    if (outcome.length) p.note(outcome.join("\n"), `${pf.cfg.name} \u2014 on chain`);

    // Written only after a successful broadcast, so the file always describes
    // what is actually behind the proxy. This is the next upgrade's baseline.
    step(`Recording storage layouts for ${pf.cfg.name}`, () => {
      for (const [name, spec] of Object.entries(PROXIES)) {
        if (!recordedAddress(pf.recordDir, name)) continue;
        const l = layoutOf(spec.target);
        if (l)
          writeFileSync(
            layoutPath(pf.recordDir, name),
            `${JSON.stringify(l, null, 2)}\n`,
          );
      }
    });

    done.push(pf);
  }

  // ── rebuild once, not per chain ───────────────────────────────────────────
  //
  // These read the whole `deployments` tree and rewrite one generated file, so
  // running them per chain did the same work N times and left the intermediate
  // states on disk. Skipped entirely when nothing landed.
  if (done.length) {
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
  }

  // ── what actually happened ────────────────────────────────────────────────
  const lines: string[] = [];
  for (const r of done) lines.push(`${c.green("\u2713")} ${r.cfg.name}`);
  for (const f of failed) lines.push(`${c.red("\u2717")} ${f.cfg.name}  ${c.dim(f.reason)}`);
  for (const r of uptodate)
    lines.push(`${c.dim("\u00b7")} ${c.dim(`${r.cfg.name}  already current`)}`);
  for (const r of skipped)
    lines.push(`${c.dim("\u00b7")} ${c.dim(`${r.cfg.name}  ${r.skip}`)}`);
  p.note(lines.join("\n"), "result");

  if (failed.length) {
    p.outro(
      c.red(
        `${done.length} of ${done.length + failed.length} chains updated \u2014 ` +
          `${failed.map((f) => f.cfg.name).join(", ")} did not.`,
      ),
    );
    process.exit(1);
  }
  p.outro(c.green(`${done.map((r) => r.cfg.name).join(", ")} up to date.`));
}

/** The same table for a dry run and for a run with nothing to do. */
function summarise(
  mode: Mode,
  actionable: Preflight[],
  uptodate: Preflight[],
  skipped: Preflight[],
  dry: boolean,
) {
  const lines: string[] = [];
  for (const r of actionable)
    lines.push(
      `${c.yellow(dry ? "would" : "will")} ${r.cfg.name}  ${c.dim(`${r.changing} change${r.changing === 1 ? "" : "s"}`)}`,
    );
  for (const r of uptodate)
    lines.push(`${c.dim("\u00b7")} ${c.dim(`${r.cfg.name}  already current`)}`);
  for (const r of skipped)
    lines.push(`${c.dim("\u00b7")} ${c.dim(`${r.cfg.name}  ${r.skip}`)}`);
  if (lines.length) p.note(lines.join("\n"), mode === "deploy" ? "deploy plan" : "upgrade plan");
}

const program = new Command();
program
  .name("protocol")
  .description("Deploy and upgrade the Slots protocol across chains.")
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
        ? "Stand the protocol up on chains that have none."
        : "Move live proxies to the current implementations.",
    )
    .option(
      "-c, --chain <names>",
      "chain names or ids, comma-separated; \"all\" for every configured chain; prompts when omitted",
    )
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
