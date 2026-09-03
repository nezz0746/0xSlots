import type { Context } from "ponder:registry";
import {
  account,
  accountChain,
  accountSlot,
  currency,
  hook,
} from "ponder:schema";
import {
  type Abi,
  type Address,
  getAddress,
  type Hex,
  toFunctionSelector,
} from "viem";
import { ERC20Abi, SlotAbi, SlotHookAbi } from "../abis";

// Function selector for splitHash() — used to detect 0xSplits contracts
// by scanning bytecode (avoids noisy failed eth_calls on non-Splits contracts).
const SPLIT_HASH_SELECTOR = toFunctionSelector("splitHash()").slice(2);

export const ZERO_ADDR =
  "0x0000000000000000000000000000000000000000" as const satisfies Hex;

/// "This slot configured nothing" — the `hookData` counterpart to ZERO_ADDR.
export const ZERO_DATA =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const satisfies Hex;

export const evtId = (txHash: Hex, logIndex: number | bigint): string =>
  `${txHash}-${logIndex.toString()}`;

export const lower = (a: Hex): Hex => a.toLowerCase() as Hex;

type AccountTypeValue = "EOA" | "CONTRACT" | "DELEGATED" | "SPLIT";

async function detectAccountType(
  ctx: Context,
  address: Address,
  isTxSender: boolean,
): Promise<AccountTypeValue> {
  const code = await ctx.client.getCode({ address });
  if (!code || code === "0x") return "EOA";
  if (isTxSender) return "DELEGATED";

  // Detect 0xSplits by scanning the bytecode for splitHash() selector.
  // No extra RPC call (vs. readContract) — avoids reverts spamming logs.
  if (code.toLowerCase().includes(SPLIT_HASH_SELECTOR.toLowerCase())) {
    return "SPLIT";
  }

  return "CONTRACT";
}

export async function getOrCreateAccount(
  ctx: Context,
  addressRaw: Hex,
  isTxSender = false,
) {
  const id = lower(addressRaw);
  const existing = await ctx.db.find(account, { id });
  if (existing) {
    if (existing.type === "CONTRACT" && isTxSender) {
      return ctx.db.update(account, { id }).set({ type: "DELEGATED" });
    }
    return existing;
  }
  const type = await detectAccountType(ctx, getAddress(id), isTxSender);
  return ctx.db.insert(account).values({
    id,
    type,
    slotCount: 0,
    occupiedCount: 0,
    totalHoldTime: 0n,
    taxPaidTotal: 0n,
  });
}

/**
 * Move an account's per-chain counters.
 *
 * The chain-scoped mirror of the totals on `account`. Callers bump both in the
 * same breath — see the three sites in `factory.ts` and `slot.ts` — because the
 * pair only means anything while it agrees.
 *
 * Upserts rather than assuming a row: an account can be a recipient on a chain
 * it has never occupied anything on, and vice versa, so whichever counter moves
 * first creates the row.
 *
 * `Math.max(0, …)` on the decrement is a floor, not a fix. It cannot trigger
 * while inserts and deletes stay paired, and if it ever did, a stuck zero is a
 * far better failure than a negative count rendering as "-1 occupied".
 */
export async function bumpAccountChain(
  ctx: Context,
  addressRaw: Hex,
  chainId: number,
  delta: {
    slotCount?: number;
    occupiedCount?: number;
    occupiedAsRecipient?: number;
  },
) {
  const acct = lower(addressRaw);
  const slotDelta = delta.slotCount ?? 0;
  const occDelta = delta.occupiedCount ?? 0;
  const recOccDelta = delta.occupiedAsRecipient ?? 0;

  await ctx.db
    .insert(accountChain)
    .values({
      account: acct,
      chainId,
      slotCount: Math.max(0, slotDelta),
      occupiedCount: Math.max(0, occDelta),
      occupiedAsRecipient: Math.max(0, recOccDelta),
    })
    .onConflictDoUpdate((row) => ({
      slotCount: Math.max(0, row.slotCount + slotDelta),
      occupiedCount: Math.max(0, row.occupiedCount + occDelta),
      occupiedAsRecipient: Math.max(0, row.occupiedAsRecipient + recOccDelta),
    }));
}

export async function getOrCreateAccountSlot(
  ctx: Context,
  accountAddr: Hex,
  slotAddr: Hex,
  timestamp: bigint,
  chainId: number,
) {
  const acc = lower(accountAddr);
  const slt = lower(slotAddr);
  const existing = await ctx.db.find(accountSlot, {
    account: acc,
    slot: slt,
  });
  if (existing) return existing;
  return ctx.db.insert(accountSlot).values({
    account: acc,
    slot: slt,
    chainId,
    taxPaid: 0n,
    holdTime: 0n,
    lastOccupiedAt: null,
    firstInteractedAt: timestamp,
    lastInteractedAt: timestamp,
  });
}

export async function getOrCreateCurrency(ctx: Context, addressRaw: Hex) {
  const id = lower(addressRaw);
  const existing = await ctx.db.find(currency, { id });
  if (existing) return existing;

  let name: string | null = null;
  let symbol: string | null = null;
  let decimals = 18;

  if (id === ZERO_ADDR) {
    // The native-ETH sentinel. There is no contract to ask, so the reads below
    // are skipped — but skipping them silently left `name` and `symbol` null,
    // and every consumer rendering `currencyRef.symbol` printed nothing beside
    // the price. `decimals` only looked handled because 18 is also the generic
    // default here, not because native was considered.
    //
    // Named statically instead. Every chain this indexes is ETH-denominated;
    // a chain with a different native token would need this keyed by chainId.
    name = "Ether";
    symbol = "ETH";
  } else {
    const checksum = getAddress(id);
    const abi = ERC20Abi as unknown as readonly unknown[];

    const take = (n: unknown, s: unknown, d: unknown): { any: boolean } => {
      let any = false;
      if (typeof n === "string") {
        name = n;
        any = true;
      }
      if (typeof s === "string") {
        symbol = s;
        any = true;
      }
      if (typeof d === "number") {
        decimals = d;
        any = true;
      } else if (typeof d === "bigint") {
        decimals = Number(d);
        any = true;
      }
      return { any };
    };

    // Ask only if the chain actually declares Multicall3.
    //
    // Letting the call fail and catching it is not equivalent: ponder retries a
    // failed `context.client` action with backoff before the error surfaces
    // here, so on a bare anvil — which has no Multicall3 — every new currency
    // logged a warning and turned a 5ms block into a 630ms one. The retries are
    // pure waste when the answer is knowable up front.
    const hasMulticall3 = Boolean(
      (
        ctx.client as {
          chain?: { contracts?: { multicall3?: { address?: string } } };
        }
      ).chain?.contracts?.multicall3?.address,
    );

    let resolved = false;
    if (hasMulticall3) {
      try {
        const [n, s, d] = await ctx.client.multicall({
          allowFailure: true,
          contracts: [
            { address: checksum, abi, functionName: "name" },
            { address: checksum, abi, functionName: "symbol" },
            { address: checksum, abi, functionName: "decimals" },
          ],
        });
        resolved = take(
          n.status === "success" ? n.result : undefined,
          s.status === "success" ? s.result : undefined,
          d.status === "success" ? d.result : undefined,
        ).any;
      } catch {
        // Declared but unreachable — fall through to the individual reads.
      }
    }

    // Fall back to three plain eth_calls. Three round trips instead of one is a
    // fine trade for a row written once per currency, and it is the difference
    // between a named token and a bare address on any chain without Multicall3.
    if (!resolved) {
      const read = async (functionName: string) => {
        try {
          return await ctx.client.readContract({
            address: checksum,
            abi,
            functionName,
          });
        } catch {
          return undefined;
        }
      };
      const [n, s, d] = await Promise.all([
        read("name"),
        read("symbol"),
        read("decimals"),
      ]);
      take(n, s, d);
    }
  }

  return ctx.db.insert(currency).values({ id, name, symbol, decimals });
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOKS, AND THE STATE `SlotCreated` DOES NOT CARRY
// ═══════════════════════════════════════════════════════════════════════════

/** The eight subscriptions a hook may declare. */
export type HookFlagSet = {
  beforeBuy: boolean;
  beforeSelfAssess: boolean;
  afterBuy: boolean;
  afterRelease: boolean;
  afterLiquidate: boolean;
  afterSettle: boolean;
};

/** What a slot with no hook obeys: nothing. */
export const NO_HOOK_FLAGS: HookFlagSet = {
  beforeBuy: false,
  beforeSelfAssess: false,
  afterBuy: false,
  afterRelease: false,
  afterLiquidate: false,
  afterSettle: false,
};

function asFlags(value: unknown): HookFlagSet | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  const keys = Object.keys(NO_HOOK_FLAGS) as (keyof HookFlagSet)[];
  const out = { ...NO_HOOK_FLAGS };
  for (const k of keys) {
    if (typeof v[k] !== "boolean") return null;
    out[k] = v[k] as boolean;
  }
  return out;
}

/**
 * Read several view functions off one contract.
 *
 * Multicall where the chain declares Multicall3, N plain `eth_call`s where it
 * does not — the local anvil has no Multicall3, and letting the multicall fail
 * and catching it is NOT equivalent: ponder retries a failed `context.client`
 * action with backoff before the error surfaces, so every miss costs hundreds
 * of milliseconds. The same check `getOrCreateCurrency` makes, for the same
 * reason.
 *
 * `undefined` in the returned array means that one read did not answer.
 */
async function readMany(
  ctx: Context,
  address: Address,
  abi: Abi,
  functionNames: readonly string[],
): Promise<unknown[]> {
  const hasMulticall3 = Boolean(
    (
      ctx.client as {
        chain?: { contracts?: { multicall3?: { address?: string } } };
      }
    ).chain?.contracts?.multicall3?.address,
  );

  if (hasMulticall3) {
    try {
      const results = await ctx.client.multicall({
        allowFailure: true,
        contracts: functionNames.map((functionName) => ({
          address,
          abi,
          functionName,
        })),
      });
      return results.map((r) =>
        r.status === "success" ? r.result : undefined,
      );
    } catch {
      // Fall through to individual reads.
    }
  }

  return Promise.all(
    functionNames.map(async (functionName) => {
      try {
        return await ctx.client.readContract({ address, abi, functionName });
      } catch {
        return undefined;
      }
    }),
  );
}

/**
 * A hook's own declaration of what it subscribes to.
 *
 * `null` when `hooks()` does not answer. That is not a hypothetical: a hook
 * whose `hooks()` reverts is REFUSED at attach time — `_readHookFlags` is
 * deliberately fail-closed — so seeing null here means either a hook that was
 * attested but never attached, or one that has since been upgraded into
 * something that no longer answers.
 */
export async function readHookFlags(
  ctx: Context,
  hookAddr: Hex,
): Promise<HookFlagSet | null> {
  const [raw] = await readMany(
    ctx,
    getAddress(lower(hookAddr)),
    SlotHookAbi as unknown as Abi,
    ["hooks"],
  );
  return asFlags(raw);
}

/**
 * The terms `SlotCreated` leaves out.
 *
 * The event carries slot, recipient, creator, currency and hook — and nothing
 * about the economics. Tax, the deposit floor, which dimensions are mutable and
 * who may move them all have to be read back from the slot itself.
 *
 * This is six eth_calls per slot creation, at the event's own block, so the
 * answer is the state as of birth and ponder caches it like any other read.
 * It is also the single most avoidable cost in this indexer — see the note in
 * src/factory.ts.
 */
export async function readSlotTerms(ctx: Context, slotAddr: Hex) {
  const address = getAddress(lower(slotAddr));
  const [tax, minDeposit, mutTax, mutHook, manager, flags, hookData] =
    await readMany(ctx, address, SlotAbi as unknown as Abi, [
      "taxBps",
      "minDepositSeconds",
      "mutableTax",
      "mutableHook",
      "manager",
      "hookFlags",
      "hookData",
    ]);

  const managerAddr =
    typeof manager === "string" && lower(manager as Hex) !== ZERO_ADDR
      ? lower(manager as Hex)
      : null;

  return {
    taxBps: typeof tax === "bigint" ? tax : 0n,
    minDepositSeconds: typeof minDeposit === "bigint" ? minDeposit : 0n,
    mutableTax: mutTax === true,
    mutableHook: mutHook === true,
    /// NULL means every term is frozen forever. The contract enforces the
    /// pairing — `initialize` reverts if a manager is set with nothing mutable,
    /// and reverts if something is mutable with no manager — so this is a fact
    /// about the slot, not missing data.
    manager: managerAddr,
    /// The snapshot THIS SLOT obeys, which is what `hookFlags()` returns and
    /// is not re-read from the hook afterwards.
    flags: asFlags(flags) ?? NO_HOOK_FLAGS,
    /// Read rather than taken from the event, for the same reason the flags
    /// are: `SlotCreated` does not carry it, and the slot is the authority.
    hookData: typeof hookData === "string" ? lower(hookData as Hex) : ZERO_DATA,
  };
}

/**
 * The `hook` row, created on first sight with its declared flags read once.
 *
 * Keyed by (address, chainId): a hook is code, not an identity, and the same
 * address on two chains is two deployments whose immutables may differ.
 */
export async function getOrCreateHook(
  ctx: Context,
  hookAddrRaw: Hex,
  timestamp: bigint,
) {
  const id = lower(hookAddrRaw);
  const chainId = ctx.chain.id;
  const existing = await ctx.db.find(hook, { id, chainId });
  if (existing) return existing;

  const declared = await readHookFlags(ctx, id);
  const f = declared ?? NO_HOOK_FLAGS;

  return ctx.db.insert(hook).values({
    id,
    chainId,
    declaredKnown: declared !== null,
    declaredBeforeBuy: f.beforeBuy,
    declaredBeforeSelfAssess: f.beforeSelfAssess,
    declaredAfterBuy: f.afterBuy,
    declaredAfterRelease: f.afterRelease,
    declaredAfterLiquidate: f.afterLiquidate,
    declaredAfterSettle: f.afterSettle,
    attested: false,
    attestedAt: null,
    slotCount: 0,
    failedCallCount: 0,
    firstSeenAt: timestamp,
    updatedAt: timestamp,
  });
}

/** Move a hook's slot count, creating the row if this is its first slot. */
export async function bumpHookSlotCount(
  ctx: Context,
  hookAddrRaw: Hex,
  timestamp: bigint,
  delta: number,
) {
  const id = lower(hookAddrRaw);
  if (id === ZERO_ADDR) return;
  await getOrCreateHook(ctx, id, timestamp);
  await ctx.db.update(hook, { id, chainId: ctx.chain.id }).set((row) => ({
    slotCount: Math.max(0, row.slotCount + delta),
    updatedAt: timestamp,
  }));
}

/** Columns for `slot`, from a flag snapshot. */
export const hookFlagColumns = (f: HookFlagSet) => ({
  hookBeforeBuy: f.beforeBuy,
  hookBeforeSelfAssess: f.beforeSelfAssess,
  hookAfterBuy: f.afterBuy,
  hookAfterRelease: f.afterRelease,
  hookAfterLiquidate: f.afterLiquidate,
  hookAfterSettle: f.afterSettle,
});
