import { slotAbi } from "@0xslots/contracts/slots";
import { encodeFunctionData } from "viem";
import { describe, expect, it, vi } from "vitest";
import { NATIVE_CURRENCY_ADDRESS } from "../native";
import {
  assertSlotInit,
  type SlotInit,
  SlotsClient,
  ZERO_HOOK_DATA,
} from "./client";

const SLOT = "0x1111111111111111111111111111111111111111" as const;
const ACCOUNT = "0x2222222222222222222222222222222222222222" as const;
const ERC20 = "0x3333333333333333333333333333333333333333" as const;
const HOOK = "0x4444444444444444444444444444444444444444" as const;
const FACTORY = "0x5555555555555555555555555555555555555555" as const;
const MANAGER = "0x6666666666666666666666666666666666666666" as const;
const TAKER = "0x9999999999999999999999999999999999999999" as const;
const ZERO = "0x0000000000000000000000000000000000000000" as const;

const CHAIN_ID = 8453;

/**
 * A viem-shaped double. `reads` maps functionName -> value, so a test states
 * only what the path under test actually queries — an unexpected read THROWS
 * rather than silently returning a default, which is half the point of these
 * tests. A `buy` that quietly stopped reading `currency` would otherwise still
 * pass every assertion about the call it sends.
 */
function harness(
  reads: Record<string, unknown>,
  /**
   * Let a test model an on-chain side effect of a write. Used to reproduce the
   * one rule that cannot be seen in a single read: seating somebody voids every
   * operator approval, silently and with no event.
   */
  onWrite?: (
    functionName: string,
    args: readonly unknown[],
    state: Record<string, unknown>,
  ) => void,
  /**
   * What `simulateContract` hands back. A slot address covers `createSlot`,
   * which is the only simulate most tests reach; `collectAll` returns amounts.
   */
  simulateResult: unknown = SLOT,
) {
  // Approvals mutate state, so the double has to as well: a static allowance
  // would make the post-approval poll re-read the old value and throw, which is
  // a property of the fake, not of the code under test.
  const state = { ...reads };

  const writeContract = vi.fn(async ({ functionName, args }: any) => {
    if (functionName === "approve") state.allowance = args[1];
    onWrite?.(functionName, args, state);
    return "0xhash";
  });

  const readContract = vi.fn(async ({ functionName }: any) => {
    if (!(functionName in state))
      throw new Error(`unexpected read: ${functionName}`);
    return state[functionName];
  });

  const signTypedData = vi.fn(async (_args: any) => "0xsignature" as const);

  const client = new SlotsClient({
    factoryAddress: FACTORY,
    // Evict-and-take is periphery now. Wired here so every test exercises the
    // real routing rather than a client that quietly has nowhere to send it.
    publicClient: {
      readContract,
      simulateContract: vi.fn(async () => ({ result: simulateResult })),
      waitForTransactionReceipt: vi.fn(async () => ({ status: "success" })),
    } as any,
    walletClient: {
      writeContract,
      signTypedData,
      account: { address: ACCOUNT },
      chain: { id: CHAIN_ID },
    } as any,
  });

  return { client, writeContract, readContract, signTypedData };
}

/**
 * A client whose WALLET answers `eth_call` from a node of its own.
 *
 * The whole point of the seam under test: `publicClient` is the app's RPC and
 * `walletClient` is the user's, and the approve reaches them at different
 * moments. `walletAllowanceSeq` is what the wallet's node reports on each
 * successive read — `[0n, 0n, AMOUNT]` is a node two polls behind.
 */
function laggingWalletClient(walletAllowanceSeq: (bigint | null)[]) {
  const state: Record<string, unknown> = {
    currency: ERC20,
    quoteBuy: 100n,
    allowance: 0n,
  };
  const writeContract = vi.fn(async ({ functionName, args }: any) => {
    if (functionName === "approve") state.allowance = args[1];
    return "0xhash";
  });
  const readContract = vi.fn(
    async ({ functionName }: any) => state[functionName],
  );

  let i = 0;
  const request = vi.fn(async () => {
    const next = walletAllowanceSeq[Math.min(i, walletAllowanceSeq.length - 1)];
    i++;
    if (next === null) throw new Error("wallet does not do eth_call");
    return `0x${next.toString(16)}`;
  });

  const client = new SlotsClient({
    factoryAddress: FACTORY,
    publicClient: {
      readContract,
      simulateContract: vi.fn(async () => ({ result: SLOT })),
      waitForTransactionReceipt: vi.fn(async () => ({ status: "success" })),
    } as any,
    walletClient: {
      writeContract,
      request,
      account: { address: ACCOUNT },
      chain: { id: CHAIN_ID },
    } as any,
  });
  return { client, writeContract, request };
}

describe("the approve the wallet has not seen yet", () => {
  const buy = (client: SlotsClient) =>
    client.buy({
      slot: SLOT,
      account: ACCOUNT,
      selfAssessedPrice: 50n,
      depositAmount: 50n,
    });

  it("waits for the WALLET's node before sending the buy", async () => {
    // Two polls behind. Without this the buy is submitted while MetaMask's own
    // provider still has no allowance, it estimates gas against that state, and
    // the user is warned that a perfectly good transaction will fail.
    const { client, writeContract, request } = laggingWalletClient([
      0n,
      0n,
      100n,
    ]);

    await buy(client);

    expect(request).toHaveBeenCalled();
    // Asked until it said yes, rather than asked once and hoped.
    expect(request.mock.calls.length).toBeGreaterThanOrEqual(3);

    const order = writeContract.mock.calls.map((c: any[]) => c[0].functionName);
    expect(order).toEqual(["approve", "buy"]);
  });

  it("does not hang on a wallet that will not answer", async () => {
    // A read-only diagnostic must never be able to block a buy. The allowance
    // is already confirmed on a node we trust; this only asks what the wallet
    // is about to believe.
    const { client, writeContract, request } = laggingWalletClient([null]);

    await buy(client);

    expect(request).toHaveBeenCalledTimes(1);
    expect(
      writeContract.mock.calls.map((c: any[]) => c[0].functionName),
    ).toEqual(["approve", "buy"]);
  });
});

const approvals = (writeContract: ReturnType<typeof vi.fn>) =>
  writeContract.mock.calls.filter(
    (c: any[]) => c[0].functionName === "approve",
  );

const sent = (writeContract: ReturnType<typeof vi.fn>, name: string) =>
  writeContract.mock.calls.find((c: any[]) => c[0].functionName === name)?.[0];

const SLOT_B = "0x7777777777777777777777777777777777777777" as const;

/**
 * Batch collection.
 *
 * These assert WHERE the call goes as much as what it carries. `collect` is on
 * the slot and `collectAll` is on the factory, and sending either to the other
 * address fails in a way no type catches — the ABIs both have the name, and the
 * wrong target simply reverts on chain.
 */
describe("collectAll", () => {
  it("goes to the factory, carrying the slots", async () => {
    const { client, writeContract } = harness({});
    await client.collectAll([SLOT, SLOT_B]);

    const call = sent(writeContract, "collectAll");
    expect(call.address).toBe(FACTORY);
    expect(call.args[0]).toEqual([SLOT, SLOT_B]);
  });

  it("collect() still goes to the slot itself", async () => {
    const { client, writeContract } = harness({});
    await client.collect(SLOT);
    expect(sent(writeContract, "collect").address).toBe(SLOT);
  });

  it("collectFrom() goes to the factory with one slot", async () => {
    const { client, writeContract } = harness({});
    await client.collectFrom(SLOT);

    const call = sent(writeContract, "collectFrom");
    expect(call.address).toBe(FACTORY);
    expect(call.args[0]).toBe(SLOT);
  });

  /**
   * The contract accepts an empty batch — an empty loop is not an error — which
   * is exactly why the client refuses it. A UI mapping over an empty selection
   * would otherwise prompt for a signature that pays gas to do nothing.
   */
  it("refuses an empty batch without sending anything", async () => {
    const { client, writeContract } = harness({});
    await expect(client.collectAll([])).rejects.toThrow(/no slots given/);
    expect(writeContract).not.toHaveBeenCalled();
  });

  it("simulates to the per-slot amounts, as a plain array", async () => {
    const { client, writeContract } = harness({}, undefined, [10n, 0n, 25n]);

    // A zero is a real answer — already flushed, not a slot, or reverting —
    // and has to survive rather than be filtered into a shorter array that no
    // longer lines up with the input.
    await expect(
      client.simulateCollectAll([SLOT, SLOT_B, ACCOUNT]),
    ).resolves.toEqual([10n, 0n, 25n]);
    expect(writeContract).not.toHaveBeenCalled();
  });

  it("refuses to simulate an empty batch too", async () => {
    const { client } = harness({}, undefined, []);
    await expect(client.simulateCollectAll([])).rejects.toThrow(
      /no slots given/,
    );
  });
});

describe("native ETH slots", () => {
  it("buy attaches value equal to the slot's own quote, and never approves", async () => {
    const { client, writeContract } = harness({
      quoteBuy: 15n * 10n ** 17n,
      currency: NATIVE_CURRENCY_ADDRESS,
    });

    await client.buy({
      slot: SLOT,
      account: ACCOUNT,
      depositAmount: 5n * 10n ** 17n,
      selfAssessedPrice: 2n * 10n ** 18n,
    });

    const buy = sent(writeContract, "buy");
    expect(buy.value).toBe(15n * 10n ** 17n);
    expect(approvals(writeContract)).toHaveLength(0);
  });

  it("buy sends the quote as `maxPayment` — the ceiling is ON by default", async () => {
    // The whole point of the fourth argument. The sitting price is read at
    // EXECUTION, so an occupant can raise it into a pending buy; without a
    // ceiling an ERC-20 buy pays the new price out of the whole allowance. A
    // client that sends 0 here reintroduces exactly that, and every other
    // assertion in this file would still pass.
    const { client, writeContract } = harness({
      quoteBuy: 15n * 10n ** 17n,
      currency: NATIVE_CURRENCY_ADDRESS,
    });

    await client.buy({
      slot: SLOT,
      account: ACCOUNT,
      depositAmount: 5n * 10n ** 17n,
      selfAssessedPrice: 2n * 10n ** 18n,
    });

    const buy = sent(writeContract, "buy");
    expect(buy.args).toHaveLength(4);
    const maxPayment = buy.args[3] as bigint;
    expect(maxPayment).not.toBe(0n);
    // Not merely non-zero: it is the figure this call was quoted, so the
    // transaction pays what it was told or it reverts `PaymentAboveMax`.
    expect(maxPayment).toBe(15n * 10n ** 17n);
  });

  it("an explicit `maxPayment` wins, including 0n to opt out", async () => {
    // Opting out is spelled as a value, not as an absence: omitting the field
    // gets the protection and only `0n` gives it up.
    const optedOut = harness({
      quoteBuy: 1_000n,
      currency: NATIVE_CURRENCY_ADDRESS,
    });
    await optedOut.client.buy({
      slot: SLOT,
      account: ACCOUNT,
      depositAmount: 10n,
      selfAssessedPrice: 990n,
      maxPayment: 0n,
    });
    expect(sent(optedOut.writeContract, "buy").args[3]).toBe(0n);

    const headroom = harness({
      quoteBuy: 1_000n,
      currency: NATIVE_CURRENCY_ADDRESS,
    });
    await headroom.client.buy({
      slot: SLOT,
      account: ACCOUNT,
      depositAmount: 10n,
      selfAssessedPrice: 990n,
      maxPayment: 1_200n,
    });
    expect(sent(headroom.writeContract, "buy").args[3]).toBe(1_200n);
  });

  it("buy sends the quote VERBATIM, whatever it says", async () => {
    // The regression guard for the whole change. `quoteBuy` here is not
    // `price + deposit` for any price — a client still doing its own arithmetic
    // cannot produce this number, however careful the arithmetic is.
    const { client, writeContract } = harness({
      quoteBuy: 999n,
      currency: NATIVE_CURRENCY_ADDRESS,
    });

    await client.buy({
      slot: SLOT,
      account: ACCOUNT,
      depositAmount: 3n * 10n ** 17n,
      selfAssessedPrice: 10n ** 18n,
    });

    expect(sent(writeContract, "buy").value).toBe(999n);
  });

  it("buy never reads `price` — the contract states the rule now", async () => {
    // `price` is absent from the double, so deriving the amount from it throws.
    // Both payment paths ask the slot what they owe instead of reimplementing
    // `_buy`'s arithmetic from outside and staying in step with it forever.
    const { client, readContract } = harness({
      quoteBuy: 10n ** 18n,
      currency: NATIVE_CURRENCY_ADDRESS,
    });

    await client.buy({
      slot: SLOT,
      account: ACCOUNT,
      depositAmount: 5n * 10n ** 17n,
      selfAssessedPrice: 2n * 10n ** 18n,
    });

    expect(
      readContract.mock.calls.map((c: any[]) => c[0].functionName),
    ).toEqual(["quoteBuy", "currency"]);
  });

  it("buy quotes for the SEATED account, with the deposit", async () => {
    const { client, readContract } = harness({
      quoteBuy: 1n,
      currency: NATIVE_CURRENCY_ADDRESS,
    });

    await client.buy({
      slot: SLOT,
      account: ACCOUNT,
      depositAmount: 5n * 10n ** 17n,
      selfAssessedPrice: 2n * 10n ** 18n,
    });

    const quote = readContract.mock.calls.find(
      (c: any[]) => c[0].functionName === "quoteBuy",
    )![0];
    // Account FIRST, mirroring the contract. `quoteBuy` carries the seated
    // account's arrears now, so quoting for anyone else answers a different
    // question — and on a native slot, where msg.value is checked for
    // EQUALITY, answering it means the buy reverts.
    expect(quote.args).toEqual([ACCOUNT, 5n * 10n ** 17n]);
  });

  it("buy quotes for the seat, not for the payer", async () => {
    const { client, readContract } = harness({
      quoteBuy: 1n,
      currency: NATIVE_CURRENCY_ADDRESS,
    });
    const seated = "0x7777777777777777777777777777777777777777" as const;

    await client.buy({
      slot: SLOT,
      account: seated,
      depositAmount: 1n,
      selfAssessedPrice: 10n,
    });

    const quote = readContract.mock.calls.find(
      (c: any[]) => c[0].functionName === "quoteBuy",
    )![0];
    // The connected wallet pays; `seated` occupies and owes any arrears. A
    // client quoting `this.account` here under-quotes a debtor's re-entry and
    // invents a debt for a payer who owes nothing.
    expect(quote.args[0]).toBe(seated);
  });

  it("buy seats `account` while the connected wallet pays", async () => {
    const { client, writeContract } = harness({
      quoteBuy: 1n,
      currency: NATIVE_CURRENCY_ADDRESS,
    });
    const seated = "0x7777777777777777777777777777777777777777" as const;

    await client.buy({
      slot: SLOT,
      account: seated,
      depositAmount: 1n,
      selfAssessedPrice: 10n,
    });

    const buy = sent(writeContract, "buy");
    // The two are deliberately separable, so the client must never quietly
    // substitute one for the other.
    expect(buy.args[0]).toBe(seated);
    expect(buy.account).toBe(ACCOUNT);
  });

  it("topUp attaches value equal to amount and never approves", async () => {
    const { client, writeContract } = harness({
      currency: NATIVE_CURRENCY_ADDRESS,
    });

    await client.topUp(SLOT, 7n * 10n ** 17n);

    expect(sent(writeContract, "topUp").value).toBe(7n * 10n ** 17n);
    expect(approvals(writeContract)).toHaveLength(0);
  });
});

describe("ERC-20 slots", () => {
  it("buy approves the SLOT when the allowance is short, and sends no value", async () => {
    const { client, writeContract } = harness({
      quoteBuy: 2n * 10n ** 6n,
      currency: ERC20,
      allowance: 0n,
    });

    await client.buy({
      slot: SLOT,
      account: ACCOUNT,
      depositAmount: 10n ** 6n,
      selfAssessedPrice: 2n * 10n ** 6n,
    });

    const approve = sent(writeContract, "approve");
    expect(approve.address).toBe(ERC20);
    // The slot is the puller. Approving anything else funds nothing.
    expect(approve.args[0]).toBe(SLOT);
    expect(approve.args[1]).toBe(2n * 10n ** 6n);
    // The contract rejects a non-zero msg.value on the ERC-20 path outright.
    expect(sent(writeContract, "buy").value).toBeUndefined();
  });

  it("buy does not approve when the allowance already covers it", async () => {
    const { client, writeContract } = harness({
      quoteBuy: 2n * 10n ** 6n,
      currency: ERC20,
      allowance: 10n ** 30n,
    });

    await client.buy({
      slot: SLOT,
      account: ACCOUNT,
      depositAmount: 10n ** 6n,
      selfAssessedPrice: 2n * 10n ** 6n,
    });

    expect(approvals(writeContract)).toHaveLength(0);
    expect(sent(writeContract, "buy")).toBeDefined();
  });

  it("topUp approves exactly the amount", async () => {
    const { client, writeContract } = harness({
      currency: ERC20,
      allowance: 0n,
    });

    await client.topUp(SLOT, 4n * 10n ** 6n);

    expect(sent(writeContract, "approve").args).toEqual([SLOT, 4n * 10n ** 6n]);
    expect(sent(writeContract, "topUp").value).toBeUndefined();
  });
});

describe("manager terms", () => {
  it("proposeTerms flags only the dimensions given", async () => {
    const { client, writeContract } = harness({});

    await client.proposeTerms(SLOT, { taxBps: 250n });

    expect(sent(writeContract, "proposeTerms").args).toEqual([
      250n,
      ZERO,
      ZERO_HOOK_DATA,
      true,
      false,
    ]);
  });

  it("proposeTerms treats a zero-address hook as DETACH, not as absent", async () => {
    const { client, writeContract } = harness({});

    await client.proposeTerms(SLOT, { hook: ZERO });

    // Presence decides, never truthiness. A `if (params.hook)` check would drop
    // the one intention that is spelled with a zero address.
    expect(sent(writeContract, "proposeTerms").args).toEqual([
      0n,
      ZERO,
      ZERO_HOOK_DATA,
      false,
      true,
    ]);
  });

  it("proposeTerms sends both when both are given", async () => {
    const { client, writeContract } = harness({});
    await client.proposeTerms(SLOT, { taxBps: 100n, hook: HOOK });
    expect(sent(writeContract, "proposeTerms").args).toEqual([
      100n,
      HOOK,
      ZERO_HOOK_DATA,
      true,
      true,
    ]);
  });

  it("proposeTerms refuses an empty proposal rather than reverting on-chain", async () => {
    const { client, writeContract } = harness({});
    await expect(client.proposeTerms(SLOT, {})).rejects.toThrow(
      /nothing to propose/i,
    );
    expect(sent(writeContract, "proposeTerms")).toBeUndefined();
  });
});

describe("creation", () => {
  const base: SlotInit = {
    recipient: ACCOUNT,
    currency: ERC20,
    manager: ZERO,
    hook: ZERO,
    taxBps: 500n,
    minDepositSeconds: 86_400n,
    mutableTax: false,
    mutableHook: false,
  };

  it("createSlot sends the nine-field tuple to the factory", async () => {
    const { client, writeContract } = harness({});

    await client.createSlot({ ...base, hook: HOOK });

    const call = sent(writeContract, "createSlot");
    expect(call.address).toBe(FACTORY);
    expect(call.args[0]).toEqual({
      ...base,
      hook: HOOK,
      // Supplied by `encodeSlotInit`, not by the caller — viem encodes a struct
      // BY NAME, so a missing key would silently encode a zero.
      hookData: ZERO_HOOK_DATA,
    });
  });

  it("a mutable slot without a manager is refused before it costs gas", async () => {
    // `initialize` reverts on this, and the revert names no field.
    expect(() => assertSlotInit({ ...base, mutableTax: true })).toThrow(
      /needs a manager/i,
    );
  });

  it("an immutable slot WITH a manager is refused too", async () => {
    // The symmetric half, and the surprising one: immutability is a fact about
    // the slot, not a promise about somebody's restraint, so a manager on an
    // all-immutable slot is rejected rather than left there looking
    // authoritative.
    expect(() => assertSlotInit({ ...base, manager: MANAGER })).toThrow(
      /must have no manager/i,
    );
  });

  it("a zero tax is refused — nobody could ever be liquidated off it", () => {
    expect(() => assertSlotInit({ ...base, taxBps: 0n })).toThrow(/taxBps/i);
    expect(() => assertSlotInit({ ...base, taxBps: 10_001n })).toThrow(
      /taxBps/i,
    );
  });
});

describe("reads", () => {
  it("pending reports isEmpty when nothing is queued", async () => {
    const { client } = harness({
      pending: [0n, ZERO, false, false, 0n],
      hasRipeTerms: false,
    });
    const pending = await client.pending(SLOT);
    expect(pending.isEmpty).toBe(true);
    expect(pending.hook).toBe(ZERO);
    expect(pending.applies).toBe(false);
    // Nothing queued has no ripening date to show.
    expect(pending.appliesAt).toBe(0n);
  });

  it("pending unpacks a queued hook change", async () => {
    const { client } = harness({
      pending: [0n, HOOK, false, true, 1234n],
      hasRipeTerms: false,
    });
    const pending = await client.pending(SLOT);
    expect(pending).toEqual({
      taxBps: 0n,
      hook: HOOK,
      hasTax: false,
      hasHook: true,
      proposedAt: 1234n,
      // proposedAt + TERMS_DELAY (1 day).
      appliesAt: 1234n + 86_400n,
      applies: false,
      isEmpty: false,
    });
  });

  it("pending asks the CHAIN whether the queued terms are ripe", async () => {
    // `TERMS_DELAY` split two facts that used to be one: what is queued, and
    // whether the next transition will take it. A client inferring the second
    // from `proposedAt` infers it against the browser's clock, which is not the
    // clock `_applyPending` reads.
    const { client, readContract } = harness({
      pending: [500n, ZERO, true, false, 1234n],
      hasRipeTerms: true,
    });

    const pending = await client.pending(SLOT);
    expect(pending.applies).toBe(true);
    expect(
      readContract.mock.calls.map((c: any[]) => c[0].functionName),
    ).toContain("hasRipeTerms");
  });

  it("arrearsOf is asked per account", async () => {
    const { client, readContract } = harness({ arrearsOf: 42n });
    expect(await client.arrearsOf(SLOT, MANAGER)).toBe(42n);
    const read = readContract.mock.calls.find(
      (c: any[]) => c[0].functionName === "arrearsOf",
    )![0];
    // The debt follows the ACCOUNT, not the seat.
    expect(read.args).toEqual([MANAGER]);
  });

  it("hookFlags passes the snapshotted struct through", async () => {
    const flags = {
      beforeBuy: true,
      beforeSelfAssess: true,
      afterBuy: false,
      afterRelease: false,
      afterLiquidate: false,
      afterSettle: false,
      strict: false,
    };
    const { client } = harness({ hookFlags: flags });
    expect(await client.hookFlags(SLOT)).toEqual(flags);
  });

  it("minDepositFor rounds UP, matching _minDepositFor's ceilDiv", () => {
    const { client } = harness({});
    // Rounding down is what once made a funding requirement vanish on a low
    // price and a short window, leaving the slot claimable for nothing.
    expect(client.minDepositFor(1n, 1n, 1n)).toBe(1n);
    expect(client.minDepositFor(100n, 0n, 60n)).toBe(0n);
    // No minimum configured means no floor at all — a legal, and load-bearing,
    // configuration.
    expect(client.minDepositFor(10n ** 18n, 10_000n, 0n)).toBe(0n);
    // 30 days at 100% of a 30-day month is the whole price.
    expect(client.minDepositFor(10n ** 18n, 10_000n, 2_592_000n)).toBe(
      10n ** 18n,
    );
  });

  it("claim defaults to the connected account but takes any", async () => {
    const { client, writeContract } = harness({});
    await client.claim(SLOT);
    expect(sent(writeContract, "claim").args).toEqual([ACCOUNT]);
  });
});

describe("guards", () => {
  it("buy rejects a zero self-assessed price without touching the chain", async () => {
    const { client, readContract } = harness({});
    await expect(
      client.buy({
        slot: SLOT,
        account: ACCOUNT,
        depositAmount: 1n,
        selfAssessedPrice: 0n,
      }),
    ).rejects.toThrow(/selfAssessedPrice/);
    expect(readContract).not.toHaveBeenCalled();
  });

  it("selfAssess rejects a price above MAX_PRICE", async () => {
    const { client, writeContract } = harness({});
    await expect(client.selfAssess(SLOT, 2n ** 128n)).rejects.toThrow(
      /MAX_PRICE/,
    );
    expect(sent(writeContract, "selfAssess")).toBeUndefined();
  });
});

describe("operator approvals belong to a tenure, not to an address", () => {
  const OPERATOR = "0x8888888888888888888888888888888888888888" as const;

  /** Seating somebody bumps the tenure, and the new tenure has no operators. */
  const seatingVoidsApprovals = (
    functionName: string,
    _args: readonly unknown[],
    state: Record<string, unknown>,
  ) => {
    if (functionName === "buy" || functionName === "sell") {
      state.tenureId = (state.tenureId as bigint) + 1n;
      state.isOperator = false;
    }
  };

  it("an approval granted under one tenure is gone under the next", async () => {
    const { client } = harness(
      {
        isOperator: true,
        tenureId: 3n,
        quoteBuy: 10n ** 18n,
        currency: NATIVE_CURRENCY_ADDRESS,
      },
      seatingVoidsApprovals,
    );

    expect(await client.isOperator(SLOT, OPERATOR)).toBe(true);

    // Somebody else takes the slot. No transaction from the occupant, the
    // operator, or anyone acting for them.
    await client.buy({
      slot: SLOT,
      account: ACCOUNT,
      depositAmount: 10n ** 17n,
      selfAssessedPrice: 2n * 10n ** 18n,
    });

    expect(await client.tenureId(SLOT)).toBe(4n);
    // Silently false. There is no event for this — the tenure ending IS the
    // expiry, which is why nothing may cache the answer.
    expect(await client.isOperator(SLOT, OPERATOR)).toBe(false);
  });

  it("isOperator hits the chain every call — nothing memoizes it", async () => {
    const { client, readContract } = harness({ isOperator: true });

    await client.isOperator(SLOT, OPERATOR);
    await client.isOperator(SLOT, OPERATOR);

    // A client that answered the second call from a cache would hand back an
    // approval that may have expired between the two.
    expect(
      readContract.mock.calls.filter(
        (c: any[]) => c[0].functionName === "isOperator",
      ),
    ).toHaveLength(2);
  });

  it("setOperator sends the pair to the slot unchanged", async () => {
    const { client, writeContract } = harness({});

    await client.setOperator(SLOT, OPERATOR, true);
    expect(sent(writeContract, "setOperator").args).toEqual([OPERATOR, true]);

    const revoke = harness({});
    await revoke.client.setOperator(SLOT, OPERATOR, false);
    expect(sent(revoke.writeContract, "setOperator").args).toEqual([
      OPERATOR,
      false,
    ]);
  });

  it("slotState carries tenureId, so a cache can be keyed on it", async () => {
    const { client } = harness({
      occupant: ACCOUNT,
      price: 1n,
      deposit: 1n,
      taxOwed: 0n,
      isVacant: false,
      isInsolvent: false,
      secondsUntilLiquidation: 10n,
      currency: ERC20,
      taxBps: 250n,
      minDepositSeconds: 0n,
      recipient: ACCOUNT,
      manager: ZERO,
      hook: ZERO,
      hookData: ZERO_HOOK_DATA,
      hookFlags: {
        beforeBuy: false,
        beforeSelfAssess: false,
        afterBuy: false,
        afterRelease: false,
        afterLiquidate: false,
        afterSettle: false,
        strict: false,
      },
      pending: [0n, ZERO, false, false, 0n],
      hasRipeTerms: false,
      mutableTax: false,
      mutableHook: false,
      occupiedSince: 1700000000n,
      lastSettled: 1700000000n,
      collectedTax: 0n,
      tenureId: 12n,
    });

    expect((await client.slotState(SLOT)).tenureId).toBe(12n);
  });
});

/**
 * `manageTerms` batches a reprice with a deposit move, and the ORDER is the
 * whole reason it exists. `selfAssess` ends with `_requireFunded(_deposit,
 * newPrice)` and `withdraw` with `_requireFunded(left, _price)`, so funding has
 * to precede a price rise and a price cut has to precede the withdrawal it
 * frees. Get the order wrong and each half fails in exactly the case it was
 * added for — which no type can catch, so it is pinned here.
 */
describe("manageTerms batches a reprice with a deposit move", () => {
  const decodeNames = (calldata: readonly `0x${string}`[]) =>
    calldata.map((d) => d.slice(0, 10));

  it("funds BEFORE repricing, so a price rise can clear the funding check", async () => {
    const { client, writeContract } = harness({
      currency: ERC20,
      allowance: 10n ** 30n,
    });

    await client.manageTerms(SLOT, { newPrice: 500n, topUpAmount: 100n });

    const call = writeContract.mock.calls.at(-1)?.[0];
    expect(call.functionName).toBe("multicall");
    const [topUp, selfAssess] = decodeNames(call.args[0]);
    // topUp's selector first, selfAssess's second.
    expect(call.args[0]).toHaveLength(2);
    expect(topUp).not.toBe(selfAssess);
  });

  it("reprices BEFORE withdrawing, so a price cut releases the deposit", async () => {
    const { client, writeContract } = harness({ currency: ERC20 });

    await client.manageTerms(SLOT, { newPrice: 100n, withdrawAmount: 50n });

    const call = writeContract.mock.calls.at(-1)?.[0];
    expect(call.functionName).toBe("multicall");
    expect(call.args[0]).toHaveLength(2);
  });

  it("sends a native top-up as its own transaction, never inside multicall", async () => {
    // `multicall` is non-payable, so `msg.value` is zero inside it and a native
    // topUp would revert InvalidValue.
    const { client, writeContract } = harness({
      currency: NATIVE_CURRENCY_ADDRESS,
    });

    await client.manageTerms(SLOT, { newPrice: 500n, topUpAmount: 100n });

    const names = writeContract.mock.calls.map((c: any[]) => c[0].functionName);
    expect(names[0]).toBe("topUp");
    expect(writeContract.mock.calls[0][0].value).toBe(100n);
    // The reprice follows separately — one call, so no multicall wrapper.
    expect(names).not.toContain("multicall");
  });

  it("refuses to add to and take from the deposit at once", async () => {
    const { client } = harness({ currency: ERC20 });
    await expect(
      client.manageTerms(SLOT, { topUpAmount: 1n, withdrawAmount: 1n }),
    ).rejects.toThrow(/cannot add to and take from/);
  });

  it("refuses an empty submission", async () => {
    const { client } = harness({ currency: ERC20 });
    await expect(client.manageTerms(SLOT, {})).rejects.toThrow(/nothing to do/);
  });
});

/**
 * Cancelling is PER-DIMENSION on chain — `cancelTerms(bool,bool)`. The SDK
 * used to send no arguments at all, which cannot even encode. Pinned because
 * the two dimensions may belong to different people and a blanket cancel would
 * let one manager destroy the other's queued change silently.
 */
describe("cancelTerms is per-dimension", () => {
  it("sends both flags by default", async () => {
    const { client, writeContract } = harness({});
    await client.cancelTerms(SLOT);
    expect(writeContract.mock.calls.at(-1)?.[0].args).toEqual([true, true]);
  });

  it("cancels the tax alone without touching the hook", async () => {
    const { client, writeContract } = harness({});
    await client.cancelTerms(SLOT, true, false);
    expect(writeContract.mock.calls.at(-1)?.[0].args).toEqual([true, false]);
  });

  it("refuses to cancel nothing", async () => {
    const { client } = harness({});
    await expect(client.cancelTerms(SLOT, false, false)).rejects.toThrow(
      /nothing to cancel/,
    );
  });
});

describe("simulateBuy — the balance guard", () => {
  /**
   * The allowance skip used to swallow this. A first-time ERC-20 buy grants
   * its allowance as part of sending, so the simulation is skipped — and the
   * balance check went with it, which is how a shortfall reached the chain as
   * `ERC20InsufficientBalance` after the user had paid gas.
   */
  it("refuses before sending when the buyer cannot cover the quote", async () => {
    const { client, writeContract } = harness({
      currency: ERC20,
      quoteBuy: 1_000n,
      allowance: 0n, // would skip the simulation entirely
      balanceOf: 999n, // one short
    });

    await expect(
      client.simulateBuy({
        slot: SLOT,
        account: ACCOUNT,
        depositAmount: 10n,
        selfAssessedPrice: 990n,
      }),
    ).rejects.toThrow(/insufficient balance/);

    expect(writeContract).not.toHaveBeenCalled();
  });

  it("stays silent when the balance covers it but the allowance does not", async () => {
    const { client } = harness({
      currency: ERC20,
      quoteBuy: 1_000n,
      allowance: 0n,
      balanceOf: 1_000n, // exactly enough
    });

    // Skipped, not refused: the approve is part of sending, so there is
    // nothing to learn from simulating against a state that will not exist.
    await expect(
      client.simulateBuy({
        slot: SLOT,
        account: ACCOUNT,
        depositAmount: 10n,
        selfAssessedPrice: 990n,
      }),
    ).resolves.toBeUndefined();
  });

  it("does not read a balance on a native slot", async () => {
    const { client } = harness({
      currency: ZERO,
      quoteBuy: 1_000n,
      // `balanceOf` deliberately absent — the double throws on an unexpected
      // read, so this fails loudly if the native path ever asks for one.
    });

    await expect(
      client.simulateBuy({
        slot: SLOT,
        account: ACCOUNT,
        depositAmount: 10n,
        selfAssessedPrice: 990n,
      }),
    ).resolves.toBeUndefined();
  });
});
