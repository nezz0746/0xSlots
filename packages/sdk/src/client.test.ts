import { describe, expect, it, vi } from "vitest";
import { SlotsChain, SlotsClient } from "./client";
import { NATIVE_CURRENCY_ADDRESS } from "./tokens";

const SLOT = "0x1111111111111111111111111111111111111111" as const;
const ACCOUNT = "0x2222222222222222222222222222222222222222" as const;
const ERC20 = "0x3333333333333333333333333333333333333333" as const;

/**
 * A viem-shaped double. `reads` maps functionName -> value, so a test states
 * only what the path under test actually queries — an unexpected read throws
 * rather than silently returning a default, which is half the point of these
 * tests.
 */
function harness(reads: Record<string, unknown>) {
  // Approvals mutate state, so the double has to as well: a static allowance
  // would make the post-approval poll re-read the old value and throw, which
  // is a property of the fake, not of the code under test.
  const state = { ...reads };

  const writeContract = vi.fn(async ({ functionName, args }: any) => {
    if (functionName === "approve") state.allowance = args[1];
    return "0xhash";
  });

  const readContract = vi.fn(async ({ functionName }: any) => {
    if (!(functionName in state)) {
      throw new Error(`unexpected read: ${functionName}`);
    }
    return state[functionName];
  });

  const client = new SlotsClient({
    chainId: SlotsChain.BASE,
    subgraphUrl: "http://localhost/never-called",
    publicClient: {
      readContract,
      waitForTransactionReceipt: vi.fn(async () => ({ status: "success" })),
    } as any,
    walletClient: {
      writeContract,
      account: { address: ACCOUNT },
      chain: { id: SlotsChain.BASE },
    } as any,
  });

  return { client, writeContract, readContract };
}

const approvals = (writeContract: ReturnType<typeof vi.fn>) =>
  writeContract.mock.calls.filter(
    (c: any[]) => c[0].functionName === "approve",
  );

const sent = (writeContract: ReturnType<typeof vi.fn>, name: string) =>
  writeContract.mock.calls.find((c: any[]) => c[0].functionName === name)?.[0];

describe("native ETH slots", () => {
  it("buy attaches value equal to price + deposit and never approves", async () => {
    const { client, writeContract } = harness({
      price: 10n ** 18n,
      currency: NATIVE_CURRENCY_ADDRESS,
    });

    await client.buy({
      slot: SLOT,
      account: ACCOUNT,
      depositAmount: 5n * 10n ** 17n,
      selfAssessedPrice: 2n * 10n ** 18n,
    });

    const buy = sent(writeContract, "buy");
    expect(buy).toBeDefined();
    expect(buy.value).toBe(10n ** 18n + 5n * 10n ** 17n);
    expect(approvals(writeContract)).toHaveLength(0);
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

describe("ERC-20 slots are unchanged", () => {
  it("buy approves when the allowance is short, and sends no value", async () => {
    const { client, writeContract } = harness({
      price: 10n ** 6n,
      currency: ERC20,
      allowance: 0n,
    });

    await client.buy({
      slot: SLOT,
      account: ACCOUNT,
      depositAmount: 10n ** 6n,
      selfAssessedPrice: 2n * 10n ** 6n,
    });

    expect(approvals(writeContract)).toHaveLength(1);
    expect(sent(writeContract, "buy").value).toBeUndefined();
  });

  it("buy does not approve when the allowance already covers it", async () => {
    const { client, writeContract } = harness({
      price: 10n ** 6n,
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
  });
});
