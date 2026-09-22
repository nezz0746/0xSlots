import { slotAbi } from "@0xslots/contracts/slots";
import { encodeFunctionData } from "viem";
import { describe, expect, it, vi } from "vitest";
import { NATIVE_CURRENCY_ADDRESS } from "../native";
import { decodeFunctionData } from "viem";
import {
  ALL_TERMS,
  assertSlotInit,
  NO_MODULE,
  SCOPE_BITS,
  TERMS,
  type SlotInit,
  SlotsClient,
  unpackScopes,
  ZERO_SETTINGS,
} from "./client";

const TAX_TERMS_NONE = {
  recipient: "0x0000000000000000000000000000000000000000" as const,
  rateBps: 0,
  minRunwaySeconds: 0,
};

const SLOT = "0x1111111111111111111111111111111111111111" as const;
const ACCOUNT = "0x2222222222222222222222222222222222222222" as const;
const ERC20 = "0x3333333333333333333333333333333333333333" as const;
const MODULE = "0x4444444444444444444444444444444444444444" as const;
const ID = "0x1111111111111111111111111111111111111111111111111111111111111111" as const;
const FACTORY = "0x5555555555555555555555555555555555555555" as const;
const MANAGER = "0x6666666666666666666666666666666666666666" as const;
const TAKER = "0x9999999999999999999999999999999999999999" as const;
const ZERO = "0x0000000000000000000000000000000000000000" as const;
const OFFER_BOOK = "0x8888888888888888888888888888888888888888" as const;

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
    offerBookAddress: OFFER_BOOK,
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
 * The whole point of the seam under test: `publicClient` is the module's RPC and
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
    // account's debt now, so quoting for anyone else answers a different
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
    // The connected wallet pays; `seated` occupies and owes any debt. A
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
  const TAX0 = { recipient: ZERO, rateBps: 0, minRunwaySeconds: 0 };

  it("proposeTerms masks only the terms given", async () => {
    const { client, writeContract } = harness({});

    await client.proposeTerms(SLOT, { taxRateBps: 250 });

    expect(sent(writeContract, "proposeTerms").args).toEqual([
      { ...TAX0, rateBps: 250 },
      NO_MODULE,
      TERMS.TAX_RATE,
    ]);
  });

  it("proposeTerms treats a zero-address module as DETACH, not as absent", async () => {
    const { client, writeContract } = harness({});

    await client.proposeTerms(SLOT, { moduleTerms: NO_MODULE });

    // Presence decides, never truthiness.
    expect(sent(writeContract, "proposeTerms").args).toEqual([
      TAX0,
      NO_MODULE,
      TERMS.MODULE,
    ]);
  });

  it("proposeTerms combines terms into one mask", async () => {
    const { client, writeContract } = harness({});
    await client.proposeTerms(SLOT, {
      taxRateBps: 100,
      recipient: MANAGER,
      moduleTerms: { target: MODULE },
    });
    expect(sent(writeContract, "proposeTerms").args).toEqual([
      { recipient: MANAGER, rateBps: 100, minRunwaySeconds: 0 },
      { target: MODULE, settings: ZERO_SETTINGS },
      TERMS.TAX_RATE | TERMS.RECIPIENT | TERMS.MODULE,
    ]);
  });

  it("module data without a module is refused before it costs gas", async () => {
    const { client } = harness({});
    await expect(
      client.proposeTerms(SLOT, {
        moduleTerms: { target: ZERO, settings: `0x${"1".padStart(64, "0")}` },
      }),
    ).rejects.toThrow(/need a module/);
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
    currency: ERC20,
    manager: ZERO,
    mutableTax: false,
    mutableRecipient: false,
    mutableModule: false,
    taxTerms: { recipient: ACCOUNT, rateBps: 500, minRunwaySeconds: 86_400 },
  };

  it("createSlot sends the full tuple to the factory", async () => {
    const { client, writeContract } = harness({});

    await client.createSlot({ ...base, moduleTerms: { target: MODULE } });

    const call = sent(writeContract, "createSlot");
    expect(call.address).toBe(FACTORY);
    expect(call.args[0]).toEqual({
      ...base,
      // Filled by `encodeSlotInit`: viem encodes a struct BY NAME, so a missing
      // key would silently encode a zero.
      moduleTerms: { target: MODULE, settings: ZERO_SETTINGS },
    });
  });

  it("a mutable slot without a manager is refused before it costs gas", () => {
    expect(() => assertSlotInit({ ...base, mutableTax: true })).toThrow(
      /needs a manager/i,
    );
  });

  it("an immutable slot WITH a manager is refused too", () => {
    expect(() => assertSlotInit({ ...base, manager: MANAGER })).toThrow(
      /must have no manager/i,
    );
  });

  it("a zero tax is refused — nobody could ever be liquidated off it", () => {
    expect(() =>
      assertSlotInit({ ...base, taxTerms: { ...base.taxTerms, rateBps: 0 } }),
    ).toThrow(/rateBps/i);
    expect(() =>
      assertSlotInit({ ...base, taxTerms: { ...base.taxTerms, rateBps: 10_001 } }),
    ).toThrow(/rateBps/i);
  });
});

describe("reads", () => {
  it("pending reports isEmpty when nothing is queued", async () => {
    const { client } = harness({
      pendingTerms: { taxTerms: TAX_TERMS_NONE, moduleTerms: NO_MODULE, scopes: 0, mask: 0, proposedAt: 0n, ripe: false },
    });
    const pending = await client.pending(SLOT);
    expect(pending.isEmpty).toBe(true);
    expect(pending.hasModule).toBe(false);
    expect(pending.applies).toBe(false);
    // Nothing queued has no ripening date to show.
    expect(pending.appliesAt).toBe(0n);
  });

  it("pending unpacks a queued module change", async () => {
    const module = { ...NO_MODULE, target: MODULE };
    const { client } = harness({
      pendingTerms: { taxTerms: TAX_TERMS_NONE, moduleTerms: module, scopes: 0, mask: TERMS.MODULE, proposedAt: 1234n, ripe: false },
    });
    const pending = await client.pending(SLOT);
    expect(pending).toEqual({
      taxTerms: TAX_TERMS_NONE,
      moduleTerms: module,
      scopes: 0,
      mask: TERMS.MODULE,
      hasTaxRate: false,
      hasRecipient: false,
      hasMinRunway: false,
      hasModule: true,
      hasScopes: false,
      proposedAt: 1234n,
      // proposedAt + TERMS_DELAY (1 day).
      appliesAt: 1234n + 86_400n,
      applies: false,
      isEmpty: false,
    });
  });

  it("pending asks the CHAIN whether the queued terms are ripe", async () => {
    const { client, readContract } = harness({
      pendingTerms: {
        taxTerms: { ...TAX_TERMS_NONE, rateBps: 500 },
        moduleTerms: NO_MODULE,
        scopes: 0,
        mask: TERMS.TAX_RATE,
        proposedAt: 1234n,
        ripe: true,
      },
    });

    const pending = await client.pending(SLOT);
    expect(pending.applies).toBe(true);
    expect(
      readContract.mock.calls.map((c: any[]) => c[0].functionName),
    ).toContain("pendingTerms");
  });

  it("debtOf is asked per account", async () => {
    const { client, readContract } = harness({ debtOf: 42n });
    expect(await client.debtOf(SLOT, MANAGER)).toBe(42n);
    const read = readContract.mock.calls.find(
      (c: any[]) => c[0].functionName === "debtOf",
    )![0];
    // The debt follows the ACCOUNT, not the seat.
    expect(read.args).toEqual([MANAGER]);
  });

  it("scopes passes the accepted struct through", async () => {
    const scopes = {
      beforeBuy: true,
      beforeSelfAssess: true,
      afterBuy: false,
      afterRelease: false,
      afterLiquidate: false,
      afterSettle: false,
      strict: false,
    };
    const { client } = harness({ scopes: scopes });
    expect(await client.scopes(SLOT)).toEqual(scopes);
  });

  it("grantStatus names both differences", async () => {
    const accepted = { scopes: SCOPE_BITS.afterSettle, feeBps: 100, feeRecipient: MODULE };
    const declared = { ...accepted, feeBps: 200 };
    const { client } = harness({ grantStatus: [accepted, declared, true, false] });
    expect(await client.grantStatus(SLOT)).toEqual({
      accepted,
      declared,
      feeDiffers: true,
      scopesDiffer: false,
    });
  });

  it("grant sends the reviewed offer as the pin", async () => {
    const { client, writeContract } = harness({});
    const expected = { scopes: SCOPE_BITS.afterBuy, feeBps: 0, feeRecipient: ZERO };
    await client.grant(SLOT, expected);
    expect(sent(writeContract, "grant").args).toEqual([expected]);
  });

  it("unpackScopes follows ScopesLib's bit order", () => {
    expect(unpackScopes(SCOPE_BITS.beforeBuy | SCOPE_BITS.strict)).toEqual({
      beforeBuy: true,
      beforeSelfAssess: false,
      afterBuy: false,
      afterRelease: false,
      afterLiquidate: false,
      afterSettle: false,
      strict: true,
    });
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
      getSlotInfo: {
        currency: ERC20,
        manager: ZERO,
        mutableTax: false,
        mutableRecipient: false,
        mutableModule: false,
        terms: {
          taxTerms: { recipient: ACCOUNT, rateBps: 250, minRunwaySeconds: 0 },
          moduleTerms: NO_MODULE,
          manifest: { scopes: 0, feeBps: 0, feeRecipient: ZERO },
        },
        scopes: {
          beforeBuy: false,
          beforeSelfAssess: false,
          afterBuy: false,
          afterRelease: false,
          afterLiquidate: false,
          afterSettle: false,
          strict: false,
        },
        occupant: ACCOUNT,
        price: 1n,
        deposit: 1n,
        occupiedSince: 1700000000n,
        tenureId: 12n,
        lastSettled: 1700000000n,
        taxOwed: 0n,
        collectedTax: 0n,
        isVacant: false,
        isInsolvent: false,
        secondsUntilLiquidation: 10n,
        pending: {
          taxTerms: TAX_TERMS_NONE,
          moduleTerms: NO_MODULE,
          scopes: 0,
          mask: 0,
          proposedAt: 0n,
          ripe: false,
        },
      },
    });

    const state = await client.slotState(SLOT);
    expect(state.tenureId).toBe(12n);
    expect(state.taxRateBps).toBe(250n);
    expect(state.pending.isEmpty).toBe(true);
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
 * Cancelling takes a mask and clears only those terms, so one role retracting
 * its change never erases another's.
 */
describe("cancelTerms takes a mask", () => {
  it("cancels everything by default", async () => {
    const { client, writeContract } = harness({});
    await client.cancelTerms(SLOT);
    expect(writeContract.mock.calls.at(-1)?.[0].args).toEqual([ALL_TERMS]);
  });

  it("cancels one term alone", async () => {
    const { client, writeContract } = harness({});
    await client.cancelTerms(SLOT, TERMS.TAX_RATE);
    expect(writeContract.mock.calls.at(-1)?.[0].args).toEqual([TERMS.TAX_RATE]);
  });

  it("refuses to cancel nothing", async () => {
    const { client } = harness({});
    await expect(client.cancelTerms(SLOT, 0)).rejects.toThrow(
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

describe("acceptOffer", () => {
  const BOOK = "0x7777777777777777777777777777777777777777" as const;

  function bookClient() {
    const writeContract = vi.fn(async () => "0xhash");
    const client = new SlotsClient({
      offerBookAddress: BOOK,
      walletClient: {
        writeContract,
        account: { address: ACCOUNT },
        chain: { id: CHAIN_ID },
      } as any,
    });
    return { client, writeContract };
  }

  it("sends the fill to the book with the seller's minimum price", async () => {
    const { client, writeContract } = bookClient();
    await client.acceptOffer(SLOT, 3n, 90n);
    const call = (writeContract.mock.calls.at(-1) as any[])[0];
    expect(call.address).toBe(BOOK);
    expect(call.functionName).toBe("acceptOffer");
    expect(call.args).toEqual([SLOT, 3n, 90n]);
  });

  it("refuses an unpinned price rather than accepting any repricing", async () => {
    const { client, writeContract } = bookClient();
    await expect(client.acceptOffer(SLOT, 3n, 0n)).rejects.toThrow(/minPrice/);
    expect(writeContract).not.toHaveBeenCalled();
  });
});

describe("offer book", () => {
  const raw = (bidder: string, price: bigint) => ({
    bidder,
    price,
    deposit: 10n,
    expiry: 9_999_999_999n,
    cancelled: false,
    filled: false,
  });

  it("offerBoard keeps the book's live verdict and sorts by price", async () => {
    const { client, readContract } = harness({
      board: [[raw(ACCOUNT, 50n), raw(MANAGER, 90n), raw(TAKER, 70n)], [true, true, false]],
      liveCount: 2n,
      best: [true, 1n, raw(MANAGER, 90n)],
    });
    const board = await client.offerBoard(SLOT);
    expect(board.offers.map((o) => o.id)).toEqual([1n, 0n]);
    expect(board.liveCount).toBe(2n);
    expect(board.best).toMatchObject({ id: 1n, bidder: MANAGER, price: 90n });
    expect(readContract.mock.calls.every((c: any[]) => c[0].address === OFFER_BOOK)).toBe(true);
  });

  it("offerBoard has no best when the book found none", async () => {
    const { client } = harness({ board: [[], []], liveCount: 0n, best: [false, 0n, raw(ZERO, 0n)] });
    expect((await client.offerBoard(SLOT)).best).toBeUndefined();
  });

  it("postOffer sends to the book and refuses a past expiry", async () => {
    const { client, writeContract } = harness({});
    await client.postOffer({ slot: SLOT, price: 100n, deposit: 5n, expiry: 9_999_999_999n });
    expect(sent(writeContract, "offer")).toMatchObject({
      address: OFFER_BOOK,
      args: [SLOT, 100n, 5n, 9_999_999_999n],
    });
    await expect(
      client.postOffer({ slot: SLOT, price: 100n, deposit: 5n, expiry: 1n }),
    ).rejects.toThrow(/expiry/);
  });

  it("offerCost includes the bidder's debt on the slot", async () => {
    const { client } = harness({ debtOf: 7n });
    expect(await client.offerCost(SLOT, ACCOUNT, 100n, 5n)).toBe(112n);
  });

  it("authorizeOfferBook makes the book the occupant's operator", async () => {
    const { client, writeContract } = harness({});
    await client.authorizeOfferBook(SLOT);
    expect(sent(writeContract, "setOperator")).toMatchObject({
      address: SLOT,
      args: [OFFER_BOOK, true],
    });
  });

  it("approveOfferBook approves the book, not the slot", async () => {
    const { client, writeContract } = harness({ currency: ERC20, allowance: 0n });
    await client.approveOfferBook(SLOT, 100n);
    expect(sent(writeContract, "approve")).toMatchObject({ address: ERC20, args: [OFFER_BOOK, 100n] });
  });
});

describe("module reads", () => {
  it("checkSettings resolves ok when the module accepts", async () => {
    const { client } = harness({ checkSettings: undefined });
    expect(await client.checkSettings(MODULE, ZERO_SETTINGS)).toEqual({ ok: true });
  });

  it("checkSettings resolves with the reason when the module refuses", async () => {
    const { client } = harness({});
    const check = await client.checkSettings(MODULE, ZERO_SETTINGS);
    expect(check.ok).toBe(false);
  });

  it("moduleDefinition is null for a module that does not describe itself", async () => {
    const { client } = harness({});
    expect(await client.moduleDefinition(MODULE)).toBeNull();
  });

  it("moduleDefinition parses what the module answered", async () => {
    const definition = {
      version: 1,
      title: "Minimum tenure",
      description: "…",
      settings: {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        title: "Minimum tenure",
        type: "object",
        "x-settings-encoding": "inline",
        properties: { window: { type: "string", "x-maximum": "31536000" } },
        required: ["window"],
        "x-abi": [{ name: "window", type: "uint256" }],
      },
    };
    const { client } = harness({ definition: JSON.stringify(definition) });
    expect(await client.moduleDefinition(MODULE)).toEqual(definition);
  });

  it("moduleDefinition is null when the module answers something that is not JSON", async () => {
    const { client } = harness({ definition: "not json" });
    expect(await client.moduleDefinition(MODULE)).toBeNull();
  });

  it("moduleSettings decodes an inline word against x-abi", async () => {
    const { client } = harness({});
    const schema = {
      "x-settings-encoding": "inline",
      "x-abi": [{ name: "window", type: "uint256" }],
    } as never;
    expect(
      await client.moduleSettings(MODULE, schema, `0x${(604800).toString(16).padStart(64, "0")}`),
    ).toEqual({ window: "604800" });
  });

  it("moduleSettings resolves a registered id through the module's own store", async () => {
    const encoded = `0x${(604800).toString(16).padStart(64, "0")}` as const;
    const { client, readContract } = harness({ settingsById: encoded });
    const schema = {
      "x-settings-encoding": "registered",
      "x-abi": [{ name: "window", type: "uint256" }],
    } as never;
    expect(await client.moduleSettings(MODULE, schema, ID)).toEqual({ window: "604800" });
    expect(readContract.mock.calls.at(-1)![0]).toMatchObject({
      address: MODULE,
      functionName: "settingsById",
      args: [ID],
    });
  });

  it("readManifest asks the module about its settings", async () => {
    const offer = { scopes: 4, feeBps: 0, feeRecipient: ZERO };
    const { client, readContract } = harness({ manifest: offer });
    expect(await client.readManifest(MODULE, ZERO_SETTINGS)).toEqual(offer);
    const call = readContract.mock.calls.at(-1)![0];
    expect(call.address).toBe(MODULE);
    expect(call.args).toEqual([ZERO_SETTINGS]);
  });
});

describe("liquidateAndBuy", () => {
  const params = {
    slot: SLOT,
    account: TAKER,
    depositAmount: 100n,
    selfAssessedPrice: 1_000n,
  };

  it("batches liquidate and buy, pinning deposit plus debt", async () => {
    const { client, writeContract } = harness({
      currency: ERC20,
      isInsolvent: true,
      debtOf: 3n,
      allowance: 10n ** 30n,
    });
    await client.liquidateAndBuy(params);
    const call = sent(writeContract, "multicall");
    expect(call.address).toBe(SLOT);
    const [liq, buy] = call.args[0].map((data: `0x${string}`) =>
      decodeFunctionData({ abi: slotAbi, data }),
    );
    expect(liq.functionName).toBe("liquidate");
    expect(buy.functionName).toBe("buy");
    expect(buy.args).toEqual([TAKER, 1_000n, 100n, 103n]);
  });

  it("refuses a native slot, whose buy cannot ride a multicall", async () => {
    const { client, writeContract } = harness({ currency: ZERO, isInsolvent: true, debtOf: 0n });
    await expect(client.liquidateAndBuy(params)).rejects.toThrow(/native/);
    expect(writeContract).not.toHaveBeenCalled();
  });

  it("refuses a solvent occupant before sending", async () => {
    const { client } = harness({ currency: ERC20, isInsolvent: false, debtOf: 0n });
    await expect(client.liquidateAndBuy(params)).rejects.toThrow(/not insolvent/);
  });
});
