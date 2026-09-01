import { describe, expect, it, vi } from "vitest";
import { NATIVE_CURRENCY_ADDRESS } from "../native";
import {
  assertSlotInit,
  SELL_ORDER_DOMAIN_NAME,
  SELL_ORDER_DOMAIN_VERSION,
  type SlotInit,
  SlotsClient,
} from "./client";

const SLOT = "0x1111111111111111111111111111111111111111" as const;
const ACCOUNT = "0x2222222222222222222222222222222222222222" as const;
const ERC20 = "0x3333333333333333333333333333333333333333" as const;
const HOOK = "0x4444444444444444444444444444444444444444" as const;
const FACTORY = "0x5555555555555555555555555555555555555555" as const;
const MANAGER = "0x6666666666666666666666666666666666666666" as const;
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
    publicClient: {
      readContract,
      simulateContract: vi.fn(async () => ({ result: SLOT })),
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

const approvals = (writeContract: ReturnType<typeof vi.fn>) =>
  writeContract.mock.calls.filter((c: any[]) => c[0].functionName === "approve");

const sent = (writeContract: ReturnType<typeof vi.fn>, name: string) =>
  writeContract.mock.calls.find((c: any[]) => c[0].functionName === name)?.[0];

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

    expect(readContract.mock.calls.map((c: any[]) => c[0].functionName)).toEqual(
      ["quoteBuy", "currency"],
    );
  });

  it("buy passes the deposit to the quote, not the self-assessed price", async () => {
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
    expect(quote.args).toEqual([5n * 10n ** 17n]);
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

describe("signed sell orders", () => {
  const DAY = 86_400n;
  const PRICE = 70n * 10n ** 6n;
  const DEPOSIT = 10n ** 6n;

  it("makeSellOrder approves the SLOT for price + deposit", async () => {
    const { client, writeContract } = harness({
      currency: ERC20,
      allowance: 0n,
      orderNonce: 0n,
    });

    await client.makeSellOrder(SLOT, {
      price: PRICE,
      deposit: DEPOSIT,
      deadline: DAY,
    });

    const approve = sent(writeContract, "approve");
    // Not a book, not the factory: `Slot.sell` pulls `price + deposit` from the
    // buyer itself, so the slot is the only address an allowance here can help.
    expect(approve.args[0]).toBe(SLOT);
    expect(approve.args[1]).toBe(PRICE + DEPOSIT);
  });

  it("makeSellOrder skips the approval when the allowance already covers it", async () => {
    const { client, writeContract, signTypedData } = harness({
      currency: ERC20,
      allowance: 10n ** 30n,
      orderNonce: 0n,
    });

    await client.makeSellOrder(SLOT, {
      price: PRICE,
      deposit: DEPOSIT,
      deadline: DAY,
    });

    // Raising a bid inside an allowance you already granted is one prompt, not
    // two.
    expect(approvals(writeContract)).toHaveLength(0);
    expect(signTypedData).toHaveBeenCalledOnce();
  });

  it("signSellOrder signs over the SLOT's own EIP-712 domain", async () => {
    const { client, signTypedData } = harness({
      currency: ERC20,
      orderNonce: 7n,
    });

    await client.signSellOrder(SLOT, {
      price: PRICE,
      deposit: DEPOSIT,
      deadline: DAY,
    });

    const signed = signTypedData.mock.calls[0]![0] as any;
    // Every slot recomputes its own separator, so `verifyingContract` is the
    // slot and never the factory — a signature cannot be replayed onto another.
    expect(signed.domain.verifyingContract).toBe(SLOT);
    expect(signed.domain.name).toBe(SELL_ORDER_DOMAIN_NAME);
    expect(signed.domain.name).toBe("Slots");
    expect(signed.domain.version).toBe(SELL_ORDER_DOMAIN_VERSION);
    expect(signed.domain.chainId).toBe(CHAIN_ID);
    expect(signed.primaryType).toBe("SellOrder");
  });

  it("signSellOrder puts BOTH price and deposit in the message, at the read nonce", async () => {
    const { client, signTypedData } = harness({
      currency: ERC20,
      orderNonce: 7n,
    });

    const { order, signature } = await client.signSellOrder(SLOT, {
      price: PRICE,
      deposit: DEPOSIT,
      deadline: DAY,
    });

    // The split is fixed by the party whose money it is. A digest over price
    // alone would let the occupant rebook the escrow half as their own proceeds
    // and seat the buyer insolvent on arrival.
    const signed = signTypedData.mock.calls[0]![0] as any;
    expect(signed.message.price).toBe(PRICE);
    expect(signed.message.deposit).toBe(DEPOSIT);
    expect(signed.message.nonce).toBe(7n);
    expect(signed.message.slot).toBe(SLOT);
    expect(signed.message.buyer).toBe(ACCOUNT);
    expect(order).toEqual(signed.message);
    expect(signature).toBe("0xsignature");
  });

  it("signSellOrder honours an explicit nonce without reading one", async () => {
    // No `orderNonce` in the double: passing a nonce must skip the read
    // entirely, which is what lets a bidder sign several orders in one go.
    const { client, signTypedData } = harness({ currency: ERC20 });

    await client.signSellOrder(SLOT, {
      price: PRICE,
      deposit: DEPOSIT,
      deadline: DAY,
      nonce: 42n,
    });

    expect((signTypedData.mock.calls[0]![0] as any).message.nonce).toBe(42n);
  });

  it("refuses to sign an order against a native slot", async () => {
    const { client, signTypedData } = harness({
      currency: NATIVE_CURRENCY_ADDRESS,
    });

    await expect(
      client.signSellOrder(SLOT, {
        price: PRICE,
        deposit: DEPOSIT,
        deadline: DAY,
      }),
    ).rejects.toThrow(/native ETH/i);
    expect(signTypedData).not.toHaveBeenCalled();
  });

  it("sell passes the buyer's order through verbatim and approves nothing", async () => {
    // No reads at all in the double: the seller supplies no terms of their own,
    // and needs no allowance — the buyer's is what gets pulled.
    const { client, writeContract } = harness({});

    const order = {
      slot: SLOT,
      buyer: ACCOUNT,
      price: PRICE,
      deposit: DEPOSIT,
      nonce: 0n,
      deadline: DAY,
    };
    await client.sell(SLOT, order, "0xsig");

    expect(approvals(writeContract)).toHaveLength(0);
    expect(sent(writeContract, "sell").args).toEqual([order, "0xsig"]);
    expect(sent(writeContract, "sell").address).toBe(SLOT);
  });

  it("cancelSellOrder burns the nonce on the slot", async () => {
    const { client, writeContract } = harness({});
    await client.cancelSellOrder(SLOT, 3n);
    const call = sent(writeContract, "cancelSellOrder");
    expect(call.address).toBe(SLOT);
    expect(call.args).toEqual([3n]);
  });

  it("orderNonce defaults to the connected account", async () => {
    const { client, readContract } = harness({ orderNonce: 9n });
    expect(await client.orderNonce(SLOT)).toBe(9n);
    expect(readContract.mock.calls[0]![0].args).toEqual([ACCOUNT]);
  });
});

describe("manager terms", () => {
  it("proposeTerms flags only the dimensions given", async () => {
    const { client, writeContract } = harness({});

    await client.proposeTerms(SLOT, { taxPercentage: 250n });

    expect(sent(writeContract, "proposeTerms").args).toEqual([
      250n,
      ZERO,
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
      false,
      true,
    ]);
  });

  it("proposeTerms sends both when both are given", async () => {
    const { client, writeContract } = harness({});
    await client.proposeTerms(SLOT, { taxPercentage: 100n, hook: HOOK });
    expect(sent(writeContract, "proposeTerms").args).toEqual([
      100n,
      HOOK,
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
    taxPercentage: 500n,
    minDepositSeconds: 86_400n,
    mutableTax: false,
    mutableHook: false,
  };

  it("createSlot sends the eight-field tuple to the factory", async () => {
    const { client, writeContract } = harness({});

    await client.createSlot({ ...base, hook: HOOK });

    const call = sent(writeContract, "createSlot");
    expect(call.address).toBe(FACTORY);
    expect(call.args[0]).toEqual({ ...base, hook: HOOK });
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
    expect(() => assertSlotInit({ ...base, taxPercentage: 0n })).toThrow(
      /taxPercentage/i,
    );
    expect(() => assertSlotInit({ ...base, taxPercentage: 10_001n })).toThrow(
      /taxPercentage/i,
    );
  });
});

describe("reads", () => {
  it("pending reports isEmpty when nothing is queued", async () => {
    const { client } = harness({ pending: [0n, ZERO, false, false, 0n] });
    const pending = await client.pending(SLOT);
    expect(pending.isEmpty).toBe(true);
    expect(pending.hook).toBe(ZERO);
  });

  it("pending unpacks a queued hook change", async () => {
    const { client } = harness({ pending: [0n, HOOK, false, true, 1234n] });
    const pending = await client.pending(SLOT);
    expect(pending).toEqual({
      taxPercentage: 0n,
      hook: HOOK,
      hasTax: false,
      hasHook: true,
      proposedAt: 1234n,
      isEmpty: false,
    });
  });

  it("hookFlags passes the snapshotted struct through", async () => {
    const flags = {
      beforeBuy: true,
      beforeSell: true,
      beforeSelfAssess: true,
      afterBuy: false,
      afterSell: false,
      afterRelease: false,
      afterLiquidate: false,
      afterSettle: false,
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

describe("liquidateAndTake", () => {
  it("pays its OWN quote on a native slot, and never reads the price", async () => {
    // `price` and `quoteBuy` are both absent from the double. The eviction
    // vacates the slot before the buy half runs, so what is owed is neither the
    // live price nor what `buy` would charge — reaching for either is the bug,
    // and here each is an unexpected read that throws.
    const { client, writeContract, readContract } = harness({
      quoteLiquidateAndTake: 4n * 10n ** 17n,
      currency: NATIVE_CURRENCY_ADDRESS,
    });

    await client.liquidateAndTake({
      slot: SLOT,
      account: ACCOUNT,
      depositAmount: 4n * 10n ** 17n,
      selfAssessedPrice: 3n * 10n ** 18n,
    });

    const call = sent(writeContract, "liquidateAndTake");
    expect(call.address).toBe(SLOT);
    expect(call.value).toBe(4n * 10n ** 17n);
    expect(call.args).toEqual([ACCOUNT, 4n * 10n ** 17n, 3n * 10n ** 18n]);
    // `buy` demands an EXACT msg.value, so overpaying by the stale price would
    // revert rather than refund.
    expect(readContract.mock.calls.map((c: any[]) => c[0].functionName)).toEqual(
      ["quoteLiquidateAndTake", "currency"],
    );
    expect(approvals(writeContract)).toHaveLength(0);
  });

  it("approves the SLOT for the deposit on an ERC-20 slot, and sends no value", async () => {
    const { client, writeContract } = harness({
      quoteLiquidateAndTake: 5n * 10n ** 6n,
      currency: ERC20,
      allowance: 0n,
    });

    await client.liquidateAndTake({
      slot: SLOT,
      account: ACCOUNT,
      depositAmount: 5n * 10n ** 6n,
      selfAssessedPrice: 20n * 10n ** 6n,
    });

    expect(sent(writeContract, "approve").args).toEqual([SLOT, 5n * 10n ** 6n]);
    expect(sent(writeContract, "liquidateAndTake").value).toBeUndefined();
  });

  it("skips the approval when the allowance already covers the deposit", async () => {
    const { client, writeContract } = harness({
      quoteLiquidateAndTake: 5n * 10n ** 6n,
      currency: ERC20,
      allowance: 10n ** 30n,
    });

    await client.liquidateAndTake({
      slot: SLOT,
      account: ACCOUNT,
      depositAmount: 5n * 10n ** 6n,
      selfAssessedPrice: 20n * 10n ** 6n,
    });

    expect(approvals(writeContract)).toHaveLength(0);
    expect(sent(writeContract, "liquidateAndTake")).toBeDefined();
  });

  it("seats `account` while the connected wallet pays, exactly as buy does", async () => {
    const { client, writeContract } = harness({
      quoteLiquidateAndTake: 1n,
      currency: NATIVE_CURRENCY_ADDRESS,
    });
    const seated = "0x7777777777777777777777777777777777777777" as const;

    await client.liquidateAndTake({
      slot: SLOT,
      account: seated,
      depositAmount: 1n,
      selfAssessedPrice: 10n,
    });

    const call = sent(writeContract, "liquidateAndTake");
    expect(call.args[0]).toBe(seated);
    expect(call.account).toBe(ACCOUNT);
  });

  it("rejects a zero self-assessed price without touching the chain", async () => {
    const { client, readContract } = harness({});
    await expect(
      client.liquidateAndTake({
        slot: SLOT,
        account: ACCOUNT,
        depositAmount: 1n,
        selfAssessedPrice: 0n,
      }),
    ).rejects.toThrow(/selfAssessedPrice/);
    expect(readContract).not.toHaveBeenCalled();
  });

  it("plain liquidate still sends no value and takes no arguments", async () => {
    // The atomic path is an ADDITION; `liquidate` keeps its old signature for
    // keepers that genuinely only want the slot vacated.
    const { client, writeContract } = harness({});
    await client.liquidate(SLOT);
    const call = sent(writeContract, "liquidate");
    expect(call.args).toEqual([]);
    expect(call.value).toBeUndefined();
  });
});

describe("the two quotes are not interchangeable", () => {
  it("buy and liquidateAndTake each ask their OWN quote for the same deposit", async () => {
    // Both stubs present and deliberately different. This is the distinction the
    // contract split into two functions because it is invisible from outside —
    // a client that called one quote for both paths would pass every other test
    // in this file.
    const deposit = 10n ** 6n;
    const reads = {
      quoteBuy: 900n,
      quoteLiquidateAndTake: 7n,
      currency: NATIVE_CURRENCY_ADDRESS,
    };
    const params = {
      slot: SLOT,
      account: ACCOUNT,
      depositAmount: deposit,
      selfAssessedPrice: 10n ** 7n,
    };

    const buyRun = harness(reads);
    await buyRun.client.buy(params);
    expect(sent(buyRun.writeContract, "buy").value).toBe(900n);

    const takeRun = harness(reads);
    await takeRun.client.liquidateAndTake(params);
    expect(sent(takeRun.writeContract, "liquidateAndTake").value).toBe(7n);
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

  it("a sale voids approvals the same way a buy does", async () => {
    const { client } = harness(
      { isOperator: true, tenureId: 1n },
      seatingVoidsApprovals,
    );

    await client.sell(
      SLOT,
      {
        slot: SLOT,
        buyer: ACCOUNT,
        price: 1n,
        deposit: 1n,
        nonce: 0n,
        deadline: 1n,
      },
      "0xsig",
    );

    expect(await client.isOperator(SLOT, OPERATOR)).toBe(false);
    expect(await client.tenureId(SLOT)).toBe(2n);
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
      taxPercentage: 250n,
      minDepositSeconds: 0n,
      recipient: ACCOUNT,
      manager: ZERO,
      hook: ZERO,
      hookFlags: {
        beforeBuy: false,
        beforeSell: false,
        beforeSelfAssess: false,
        afterBuy: false,
        afterSell: false,
        afterRelease: false,
        afterLiquidate: false,
        afterSettle: false,
      },
      pending: [0n, ZERO, false, false, 0n],
      mutableTax: false,
      mutableHook: false,
      occupiedSince: 1700000000n,
      tenureId: 12n,
    });

    expect((await client.slotState(SLOT)).tenureId).toBe(12n);
  });
});
