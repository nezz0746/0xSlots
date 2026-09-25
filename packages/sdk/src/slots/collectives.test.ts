import { decodeFunctionData, keccak256, toBytes, zeroHash } from "viem";
import { slotCollectiveAbi } from "@0xslots/contracts/slots";
import { describe, expect, it, vi } from "vitest";

import { NO_MODULE } from "./client";
import {
  COLLECTIVE_ROLES,
  type CollectiveSplit,
  CollectivesClient,
  SPLITS_NATIVE_TOKEN,
} from "./collectives";

const FACTORY = "0x5555555555555555555555555555555555555555" as const;
const COLLECTIVE = "0x1111111111111111111111111111111111111111" as const;
const ACCOUNT = "0x2222222222222222222222222222222222222222" as const;
const ALICE = "0x3333333333333333333333333333333333333333" as const;
const BOB = "0x4444444444444444444444444444444444444444" as const;
const SLOT_A = "0x6666666666666666666666666666666666666666" as const;
const SLOT_B = "0x7777777777777777777777777777777777777777" as const;
const ZERO = "0x0000000000000000000000000000000000000000" as const;

function harness(reads: Record<string, unknown> = {}) {
  const writeContract = vi.fn(async (_args: any) => "0xhash");
  const readContract = vi.fn(async ({ functionName }: any) => {
    if (!(functionName in reads))
      throw new Error(`unexpected read: ${functionName}`);
    return reads[functionName];
  });
  const client = new CollectivesClient({
    factoryAddress: FACTORY,
    publicClient: { readContract } as any,
    walletClient: {
      writeContract,
      account: { address: ACCOUNT },
      chain: { id: 84532 },
    } as any,
  });
  const last = () => writeContract.mock.calls.at(-1)![0];
  return { client, writeContract, readContract, last };
}

const split: CollectiveSplit = {
  recipients: [ALICE, BOB],
  allocations: [60n, 40n],
};

describe("createCollective", () => {
  it("derives the total and fills empty role lists", async () => {
    const { client, last } = harness();
    await client.createCollective({ split, roles: { admin: ALICE } });
    expect(last()).toMatchObject({
      address: FACTORY,
      functionName: "createCollective",
      args: [
        { recipients: [ALICE, BOB], allocations: [60n, 40n], totalAllocation: 100n, distributionIncentive: 0 },
        { admin: ALICE, taxManagers: [], policyManagers: [], splitManagers: [] },
      ],
    });
  });

  it("refuses splits and roles the collective would reject", async () => {
    const { client, writeContract } = harness();
    await expect(
      client.createCollective({ split: { recipients: [], allocations: [] }, roles: { admin: ALICE } }),
    ).rejects.toThrow(/recipient/);
    await expect(
      client.createCollective({ split: { recipients: [ALICE], allocations: [0n] }, roles: { admin: ALICE } }),
    ).rejects.toThrow(/sum to zero/);
    await expect(
      client.createCollective({ split: { recipients: [ALICE], allocations: [1n, 2n] }, roles: { admin: ALICE } }),
    ).rejects.toThrow(/length/);
    await expect(client.createCollective({ split, roles: { admin: ZERO } })).rejects.toThrow(/admin/);
    expect(writeContract).not.toHaveBeenCalled();
  });
});

describe("governance relays", () => {
  it("uses the single relay for one slot and the batch for several", async () => {
    const { client, last } = harness();
    await client.proposeTax(COLLECTIVE, SLOT_A, 750);
    expect(last()).toMatchObject({ address: COLLECTIVE, functionName: "proposeTax", args: [SLOT_A, 750] });

    await client.proposeTax(COLLECTIVE, [SLOT_A, SLOT_B], 750);
    expect(last()).toMatchObject({ functionName: "proposeTaxBatch", args: [[SLOT_A, SLOT_B], 750] });

    await client.proposeModule(COLLECTIVE, [SLOT_A, SLOT_B]);
    expect(last()).toMatchObject({ functionName: "proposeModuleBatch", args: [[SLOT_A, SLOT_B], NO_MODULE] });

    await client.cancelModuleProposal(COLLECTIVE, SLOT_B);
    expect(last()).toMatchObject({ functionName: "cancelModuleProposal", args: [SLOT_B] });

    await client.cancelAllProposals(COLLECTIVE, [SLOT_A, SLOT_B]);
    expect(last()).toMatchObject({ functionName: "cancelAllProposalsBatch", args: [[SLOT_A, SLOT_B]] });
  });

  it("refuses a tax outside 1..10000 and an empty slot list", async () => {
    const { client, writeContract } = harness();
    await expect(client.proposeTax(COLLECTIVE, SLOT_A, 0)).rejects.toThrow(/taxRateBps/);
    await expect(client.proposeTax(COLLECTIVE, SLOT_A, 10_001)).rejects.toThrow(/taxRateBps/);
    await expect(client.sweep(COLLECTIVE, [])).rejects.toThrow(/at least one/);
    expect(writeContract).not.toHaveBeenCalled();
  });
});

describe("money and roles", () => {
  it("distribute sends the encoded split, the token and the caller as distributor", async () => {
    const { client, last } = harness();
    await client.distribute(COLLECTIVE, split, ALICE);
    expect(last()).toMatchObject({
      functionName: "distribute",
      args: [{ totalAllocation: 100n }, ALICE, ACCOUNT],
    });
  });

  it("role names map to the contract's role ids", async () => {
    expect(COLLECTIVE_ROLES.admin).toBe(zeroHash);
    expect(COLLECTIVE_ROLES.tax).toBe(keccak256(toBytes("TAX_MANAGER_ROLE")));
    expect(COLLECTIVE_ROLES.policy).toBe(keccak256(toBytes("POLICY_MANAGER_ROLE")));
    expect(COLLECTIVE_ROLES.split).toBe(keccak256(toBytes("SPLIT_MANAGER_ROLE")));

    const { client, readContract } = harness({ hasRole: true });
    expect(await client.hasRole(COLLECTIVE, "split", BOB)).toBe(true);
    expect(readContract.mock.calls.at(-1)![0].args).toEqual([COLLECTIVE_ROLES.split, BOB]);
  });
});

describe("split and module offers", () => {
  it("setSplit sends the current split, the next one and native plus listed tokens", async () => {
    const { client, last } = harness();
    const next: CollectiveSplit = { recipients: [ALICE], allocations: [1n] };
    await client.setSplit(COLLECTIVE, split, next, [BOB]);
    expect(last()).toMatchObject({
      functionName: "setSplit",
      args: [
        { totalAllocation: 100n },
        { recipients: [ALICE], totalAllocation: 1n },
        [SPLITS_NATIVE_TOKEN, BOB],
      ],
    });
  });

  it("acceptFee and acceptScopes relay through the collective", async () => {
    const { client, last } = harness();
    const fee = { bps: 100, recipient: ALICE };
    await client.acceptFee(COLLECTIVE, SLOT_A, fee);
    expect(last()).toMatchObject({
      address: COLLECTIVE,
      functionName: "acceptFee",
      args: [SLOT_A, fee],
    });
    await client.acceptScopes(COLLECTIVE, SLOT_A, 4);
    expect(last()).toMatchObject({
      address: COLLECTIVE,
      functionName: "acceptScopes",
      args: [SLOT_A, 4],
    });
  });
});

describe("batch", () => {
  it("encodes each call into the collective's multicall", async () => {
    const { client, last } = harness();
    await client.batch(COLLECTIVE, [
      { functionName: "proposeTax", args: [SLOT_A, 750] },
      { functionName: "sweep", args: [[SLOT_A, SLOT_B]] },
    ]);
    const call = last();
    expect(call.functionName).toBe("multicall");
    const decoded = call.args[0].map((data: `0x${string}`) =>
      decodeFunctionData({ abi: slotCollectiveAbi, data }),
    );
    expect(decoded[0]).toMatchObject({ functionName: "proposeTax", args: [SLOT_A, 750] });
    expect(decoded[1]).toMatchObject({ functionName: "sweep", args: [[SLOT_A, SLOT_B]] });
  });

  it("refuses an empty batch", async () => {
    const { client } = harness();
    await expect(client.batch(COLLECTIVE, [])).rejects.toThrow(/at least one/);
  });
});
