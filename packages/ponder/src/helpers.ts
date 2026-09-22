import type { Context } from "ponder:registry";
import {
  account,
  accountChain,
  accountSlot,
  currency,
  module,
} from "ponder:schema";
import {
  type Abi,
  type Address,
  getAddress,
  type Hex,
  toFunctionSelector,
} from "viem";
import { ERC20Abi, SlotAbi, SlotModuleAbi } from "../abis";

// Function selector for splitHash() — used to detect 0xSplits contracts
// by scanning bytecode (avoids noisy failed eth_calls on non-Splits contracts).
const SPLIT_HASH_SELECTOR = toFunctionSelector("splitHash()").slice(2);

export const ZERO_ADDR =
  "0x0000000000000000000000000000000000000000" as const satisfies Hex;

/// "This slot configured nothing" — the `settings` counterpart to ZERO_ADDR.
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
    chainId,
  });
  if (existing) return existing;
  return ctx.db.insert(accountSlot).values({
    account: acc,
    slot: slt,
    chainId,
    taxPaid: 0n,
    holdTime: 0n,
    lastOccupiedAt: null,
    publishCount: 0,
    firstInteractedAt: timestamp,
    lastInteractedAt: timestamp,
  });
}

export async function getOrCreateCurrency(
  ctx: Context,
  addressRaw: Hex,
): Promise<{ id: Hex; chainId: number }> {
  const id = lower(addressRaw);
  const chainId = ctx.chain.id;
  const existing = await ctx.db.find(currency, { id, chainId });
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
    // Named statically instead. Every chain this indexes is ETH-denominated, so
    // one name serves them all; the row IS per chain now, so a chain with a
    // different native token only needs this branch to look at `chainId`.
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

  await ctx.db.insert(currency).values({ id, chainId, name, symbol, decimals });
  return { id, chainId };
}

// ═══════════════════════════════════════════════════════════════════════════
// MODULES, AND THE STATE `SlotCreated` DOES NOT CARRY
// ═══════════════════════════════════════════════════════════════════════════

/** The scopes a module may declare. */
export type ScopeSet = {
  beforeBuy: boolean;
  beforeSelfAssess: boolean;
  afterBuy: boolean;
  afterRelease: boolean;
  afterLiquidate: boolean;
  afterSettle: boolean;
  strict: boolean;
};

/** What a slot with no module obeys: nothing. */
export const NO_SCOPES: ScopeSet = {
  beforeBuy: false,
  beforeSelfAssess: false,
  afterBuy: false,
  afterRelease: false,
  afterLiquidate: false,
  afterSettle: false,
  strict: false,
};

/** `Manifest.scopes` as a set. Bits follow `ScopesLib`. */
export function unpackScopes(scopes: number): ScopeSet {
  const has = (bit: number) => (scopes & bit) !== 0;
  return {
    beforeBuy: has(1),
    beforeSelfAssess: has(2),
    afterBuy: has(4),
    afterRelease: has(8),
    afterLiquidate: has(16),
    afterSettle: has(32),
    strict: has(64),
  };
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
 * A module's own declaration of its scopes, for empty settings.
 *
 * `null` when `manifest` does not answer. A module whose manifest reverts is
 * REFUSED at attach time, so seeing null here means either a module that was
 * seen but never attached, or one that has since been upgraded into
 * something that no longer answers.
 */
export async function readScopes(
  ctx: Context,
  moduleAddr: Hex,
): Promise<ScopeSet | null> {
  try {
    const offer = (await ctx.client.readContract({
      address: getAddress(lower(moduleAddr)),
      abi: SlotModuleAbi,
      functionName: "manifest",
      args: [ZERO_DATA],
    })) as { scopes: number };
    return unpackScopes(offer.scopes);
  } catch {
    return null;
  }
}

/**
 * The terms `SlotCreated` leaves out, read back from the slot at the event's
 * block: rent, module terms, manager, lock and the scopes snapshot.
 */
export async function readSlotTerms(ctx: Context, slotAddr: Hex) {
  const address = getAddress(lower(slotAddr));
  const [taxTerms, moduleTerms, manager, mutTax, mutRecipient, mutModule, offer] =
    await readMany(ctx, address, SlotAbi as unknown as Abi, [
      "taxTerms",
      "moduleTerms",
      "manager",
      "mutableTax",
      "mutableRecipient",
      "mutableModule",
      "manifest",
    ]);

  const r = taxTerms as
    | { recipient: Hex; rateBps: number; minRunwaySeconds: number }
    | undefined;
  const h = moduleTerms as { target: Hex; settings: Hex } | undefined;
  const o = offer as
    | { scopes: number; feeBps: number; feeRecipient: Hex }
    | undefined;
  const managerAddr =
    typeof manager === "string" && lower(manager as Hex) !== ZERO_ADDR
      ? lower(manager as Hex)
      : null;

  return {
    taxRateBps: BigInt(r?.rateBps ?? 0),
    minRunwaySeconds: BigInt(r?.minRunwaySeconds ?? 0),
    /// NULL means nothing about the slot can ever change.
    manager: managerAddr,
    mutableTax: mutTax === true,
    mutableRecipient: mutRecipient === true,
    mutableModule: mutModule === true,
    /// The module's fee, as the slot accepted it.
    moduleFeeBps: o?.feeBps ?? 0,
    moduleFeeRecipient:
      o && lower(o.feeRecipient) !== ZERO_ADDR ? lower(o.feeRecipient) : null,
    /// The scopes THIS SLOT obeys, as it accepted them.
    scopes: o ? unpackScopes(o.scopes) : NO_SCOPES,
    settings: h ? lower(h.settings) : ZERO_DATA,
  };
}

/**
 * The `module` row, created on first sight with its declared scopes read once.
 *
 * Keyed by (address, chainId): a module is code, not an identity, and the same
 * address on two chains is two deployments whose immutables may differ.
 */
export async function getOrCreateModule(
  ctx: Context,
  moduleAddrRaw: Hex,
  timestamp: bigint,
) {
  const id = lower(moduleAddrRaw);
  const chainId = ctx.chain.id;
  const existing = await ctx.db.find(module, { id, chainId });
  if (existing) return existing;

  const declared = await readScopes(ctx, id);
  const f = declared ?? NO_SCOPES;

  return ctx.db.insert(module).values({
    id,
    chainId,
    declaredKnown: declared !== null,
    declaredBeforeBuy: f.beforeBuy,
    declaredBeforeSelfAssess: f.beforeSelfAssess,
    declaredAfterBuy: f.afterBuy,
    declaredAfterRelease: f.afterRelease,
    declaredAfterLiquidate: f.afterLiquidate,
    declaredAfterSettle: f.afterSettle,
    declaredStrict: f.strict,
    slotCount: 0,
    failedCallCount: 0,
    firstSeenAt: timestamp,
    updatedAt: timestamp,
  });
}

/** Move a module's slot count, creating the row if this is its first slot. */
export async function bumpModuleSlotCount(
  ctx: Context,
  moduleAddrRaw: Hex,
  timestamp: bigint,
  delta: number,
) {
  const id = lower(moduleAddrRaw);
  if (id === ZERO_ADDR) return;
  await getOrCreateModule(ctx, id, timestamp);
  await ctx.db.update(module, { id, chainId: ctx.chain.id }).set((row) => ({
    slotCount: Math.max(0, row.slotCount + delta),
    updatedAt: timestamp,
  }));
}

/** Columns for `slot`, from the accepted scopes. */
export const scopeColumns = (f: ScopeSet) => ({
  scopeBeforeBuy: f.beforeBuy,
  scopeBeforeSelfAssess: f.beforeSelfAssess,
  scopeAfterBuy: f.afterBuy,
  scopeAfterRelease: f.afterRelease,
  scopeAfterLiquidate: f.afterLiquidate,
  scopeAfterSettle: f.afterSettle,
  scopeStrict: f.strict,
});
