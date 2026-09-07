import { describe, expect, it, vi } from "vitest";

import { NATIVE_CURRENCY_ADDRESS } from "../native";
import {
  assertCollectionInit,
  type CollectionInit,
  CollectionsClient,
  depositFor,
} from "./collections";

const FACTORY = "0x5555555555555555555555555555555555555555" as const;
const COLLECTION = "0x1111111111111111111111111111111111111111" as const;
const ACCOUNT = "0x2222222222222222222222222222222222222222" as const;
const ERC20 = "0x3333333333333333333333333333333333333333" as const;
const ZERO = "0x0000000000000000000000000000000000000000" as const;

/**
 * A viem-shaped double, in the same shape as `client.test.ts`: an unexpected
 * read THROWS rather than returning a default, so a method that quietly stops
 * asking the chain something fails here instead of shipping.
 */
function harness(reads: Record<string, unknown>) {
  const writeContract = vi.fn(async () => "0xhash");
  const readContract = vi.fn(async ({ functionName }: any) => {
    if (!(functionName in reads))
      throw new Error(`unexpected read: ${functionName}`);
    return reads[functionName];
  });

  const client = new CollectionsClient({
    factoryAddress: FACTORY,
    publicClient: { readContract } as any,
    walletClient: {
      writeContract,
      account: { address: ACCOUNT },
      chain: { id: 84532 },
    } as any,
  });
  return { client, writeContract, readContract };
}

const terms = (currency: string) => ({
  recipient: ACCOUNT,
  currency,
  manager: ZERO,
  hook: COLLECTION,
  taxBps: 1000n,
  minDepositSeconds: 604800n,
  mutableTax: false,
  mutableHook: false,
});

const sent = (w: ReturnType<typeof vi.fn>, name: string) =>
  w.mock.calls.find((c: any[]) => c[0].functionName === name)?.[0];

describe("minting", () => {
  it("a native mint attaches the collection's own quoted total", async () => {
    const { client, writeContract } = harness({
      quoteMint: [3n * 10n ** 18n, 2n * 10n ** 18n, 10n ** 18n],
      terms: terms(NATIVE_CURRENCY_ADDRESS),
    });

    await client.mint(COLLECTION, 2n * 10n ** 18n);

    const call = sent(writeContract, "mint");
    expect(call.value).toBe(3n * 10n ** 18n);
    expect(call.args).toEqual([2n * 10n ** 18n]);
  });

  it("an ERC-20 mint attaches no value", async () => {
    const { client, writeContract } = harness({
      quoteMint: [3n * 10n ** 18n, 2n * 10n ** 18n, 10n ** 18n],
      terms: terms(ERC20),
    });

    await client.mint(COLLECTION, 2n * 10n ** 18n);
    expect(sent(writeContract, "mint").value).toBeUndefined();
  });

  /**
   * The natural mistake, and the expensive one. `mint` pulls the whole total to
   * the COLLECTION before splitting it, so an allowance to the slot leaves the
   * mint reverting on a transfer nobody expected.
   */
  it("approval goes to the collection, for the total, not the valuation", async () => {
    const { client, writeContract } = harness({
      quoteMint: [3n * 10n ** 18n, 2n * 10n ** 18n, 10n ** 18n],
      terms: terms(ERC20),
    });

    await client.approveMint(COLLECTION, 2n * 10n ** 18n);

    const call = sent(writeContract, "approve");
    expect(call.address).toBe(ERC20);
    expect(call.args).toEqual([COLLECTION, 3n * 10n ** 18n]);
  });

  it("a native collection refuses an approval rather than sending a useless one", async () => {
    const { client } = harness({
      quoteMint: [1n, 1n, 0n],
      terms: terms(NATIVE_CURRENCY_ADDRESS),
    });
    await expect(client.approveMint(COLLECTION, 1n)).rejects.toThrow(/native/);
  });

  it("setBaseURI writes to the collection itself, verbatim", async () => {
    const { client, writeContract } = harness({});

    await client.setBaseURI(COLLECTION, "https://art.example/meta/");

    const call = sent(writeContract, "setBaseURI");
    expect(call.address).toBe(COLLECTION);
    // Verbatim, trailing slash included: `tokenURI` is this plus the id, so
    // normalising it here would silently change what every token resolves to.
    expect(call.args).toEqual(["https://art.example/meta/"]);
  });

  it("a zero valuation is refused before it reaches the chain", async () => {
    const { client, writeContract } = harness({});
    await expect(client.mint(COLLECTION, 0n)).rejects.toThrow(/> 0/);
    expect(writeContract).not.toHaveBeenCalled();
  });
});

describe("reading a collection", () => {
  it("one call gives a collection page everything it renders", async () => {
    const { client } = harness({
      name: "Bound",
      symbol: "BND",
      MAX_SUPPLY: 100n,
      totalMinted: 7n,
      owner: ACCOUNT,
      baseURI: "ipfs://x/",
      terms: terms(ERC20),
    });

    const c = await client.collection(COLLECTION);
    expect(c.name).toBe("Bound");
    expect(c.maxSupply).toBe(100n);
    expect(c.totalMinted).toBe(7n);
    expect(c.terms.taxBps).toBe(1000n);
  });

  it("the quote is read from the contract, not recomputed", async () => {
    const { client, readContract } = harness({
      quoteMint: [30n, 20n, 10n],
    });
    const q = await client.quoteMint(COLLECTION, 20n);
    expect(q).toEqual({ total: 30n, price: 20n, deposit: 10n });
    expect(readContract).toHaveBeenCalled();
  });
});

describe("assertCollectionInit", () => {
  const ok: CollectionInit = {
    name: "N",
    symbol: "N",
    maxSupply: 10n,
    currency: ERC20,
    taxBps: 1000n,
    minDepositSeconds: 604800n,
    recipient: ACCOUNT,
    manager: ZERO,
    owner: ACCOUNT,
  };

  it("accepts a sound one", () => {
    expect(() => assertCollectionInit(ok)).not.toThrow();
  });

  /** The trap the contract guards: a mint that escrows nothing is instantly
   *  liquidatable, so every token would be evictable in its mint block. */
  it("refuses a zero window", () => {
    expect(() =>
      assertCollectionInit({ ...ok, minDepositSeconds: 0n }),
    ).toThrow(/liquidatable/);
  });

  it("refuses a collection that can never mint", () => {
    expect(() => assertCollectionInit({ ...ok, maxSupply: 0n })).toThrow(
      /maxSupply/,
    );
  });

  it("refuses an out-of-range tax", () => {
    expect(() => assertCollectionInit({ ...ok, taxBps: 0n })).toThrow(/taxBps/);
    expect(() => assertCollectionInit({ ...ok, taxBps: 10_001n })).toThrow(
      /taxBps/,
    );
  });

  it("refuses a zero recipient or owner", () => {
    expect(() => assertCollectionInit({ ...ok, recipient: ZERO })).toThrow(
      /recipient/,
    );
    expect(() => assertCollectionInit({ ...ok, owner: ZERO })).toThrow(/owner/);
  });
});

describe("depositFor", () => {
  /**
   * Pinned against `SlotMath.depositFor`'s own output, run in Foundry. This
   * function is contract arithmetic reimplemented for a UI that has no contract
   * to ask yet — so the only thing keeping it honest is these numbers.
   */
  it("matches the contract, including its rounding direction", () => {
    const ONE = 10n ** 18n;
    expect(depositFor(ONE, 1000n, 604_800n)).toBe(23_333_333_333_333_334n);
    expect(depositFor(ONE, 250n, 2_592_000n)).toBe(25_000_000_000_000_000n);
    expect(depositFor(ONE, 1000n, 86_400n)).toBe(3_333_333_333_333_334n);
  });

  /** Rounding UP, and it is load-bearing: down let a window be bought free. */
  it("never rounds a non-zero requirement to zero", () => {
    expect(depositFor(1n, 1n, 1n)).toBe(1n);
  });

  it("asks nothing for a zero window", () => {
    expect(depositFor(10n ** 18n, 1000n, 0n)).toBe(0n);
  });
});
