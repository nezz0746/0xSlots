import { metadataModuleAbi, slotAbi } from "@0xslots/contracts";
import {
  type Address,
  type Chain,
  erc20Abi,
  type Hash,
  type PublicClient,
  type WalletClient,
} from "viem";
import { SlotsError } from "../errors";
import type { getSdk } from "../generated/graphql";
import { isNativeCurrency } from "../native";

const EXPECTED_MODULE_NAME = "AdLandModule";

/** Buy terms shared by both one-call entry points. */
export type BuyAndUpdateParams = {
  /** The slot contract to buy. */
  slot: Address;
  /** Deposit funding the tax escrow. */
  depositAmount: bigint;
  /** The new self-assessed price. Must be greater than zero. */
  selfAssessedPrice: bigint;
  /** The URI to publish once the slot is held. */
  uri: string;
};

/** An EIP-2612 signature, already produced by the caller. */
export type PermitSignature = {
  /** The allowance the signature grants. Must cover what the buy owes. */
  value: bigint;
  deadline: bigint;
  v: number;
  r: `0x${string}`;
  s: `0x${string}`;
};

/**
 * Module namespace for MetadataModule operations.
 * Accessible via `client.modules.metadata`.
 *
 * Read: subgraph queries for MetadataSlot entities
 * Write: `updateMetadata(moduleAddress, slot, uri)` on the MetadataModule contract
 * RPC read: `tokenURI(moduleAddress, slot)` on the MetadataModule contract
 */
export class MetadataModuleClient {
  private readonly sdk: ReturnType<typeof getSdk>;
  private readonly _publicClient?: PublicClient;
  private readonly _walletClient?: WalletClient;

  constructor(opts: {
    sdk: ReturnType<typeof getSdk>;
    publicClient?: PublicClient;
    walletClient?: WalletClient;
  }) {
    this.sdk = opts.sdk;
    this._publicClient = opts.publicClient;
    this._walletClient = opts.walletClient;
  }

  private get wallet(): WalletClient {
    if (!this._walletClient)
      throw new SlotsError("metadata", "No walletClient provided");
    return this._walletClient;
  }

  private get account(): Address {
    const account = this.wallet.account;
    if (!account)
      throw new SlotsError("metadata", "WalletClient must have an account");
    return account.address;
  }

  private get chain(): Chain {
    const chain = this.wallet.chain;
    if (!chain)
      throw new SlotsError("metadata", "WalletClient must have a chain");
    return chain;
  }

  private get publicClient(): PublicClient {
    if (!this._publicClient)
      throw new SlotsError("metadata", "No publicClient provided");
    return this._publicClient;
  }

  private async query<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      throw new SlotsError(operation, error);
    }
  }

  /**
   * Verify that a given address is a MetadataModule by calling `name()` on-chain.
   * @param moduleAddress - The module contract address to verify
   * @throws SlotsError if the contract doesn't return the expected name
   */
  private async verifyModule(moduleAddress: Address): Promise<void> {
    const name = await this.publicClient.readContract({
      address: moduleAddress,
      abi: metadataModuleAbi,
      functionName: "name",
    });
    if (name !== EXPECTED_MODULE_NAME) {
      throw new SlotsError(
        "metadata",
        `Contract at ${moduleAddress} is not a MetadataModule (name: "${name}")`,
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // READ — Subgraph
  // ═══════════════════════════════════════════════════════════════════════════

  /** Get all slots with metadata, ordered by most recently updated. */
  getSlots(...args: Parameters<ReturnType<typeof getSdk>["GetMetadataSlots"]>) {
    return this.query("metadata.getSlots", () =>
      this.sdk.GetMetadataSlots(...args),
    );
  }

  /** Get a single metadata slot by slot address. */
  getSlot(...args: Parameters<ReturnType<typeof getSdk>["GetMetadataSlot"]>) {
    return this.query("metadata.getSlot", () =>
      this.sdk.GetMetadataSlot(...args),
    );
  }

  /** Get all metadata slots for a given recipient. */
  getSlotsByRecipient(
    ...args: Parameters<ReturnType<typeof getSdk>["GetMetadataSlotsBySlots"]>
  ) {
    return this.query("metadata.getSlotsByRecipient", () =>
      this.sdk.GetMetadataSlotsBySlots(...args),
    );
  }

  /** Get metadata update history for a slot. */
  getUpdateHistory(
    ...args: Parameters<ReturnType<typeof getSdk>["GetMetadataUpdatedEvents"]>
  ) {
    return this.query("metadata.getUpdateHistory", () =>
      this.sdk.GetMetadataUpdatedEvents(...args),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // READ — RPC
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Read the current URI for a slot directly from chain (bypasses subgraph).
   * @param moduleAddress - The MetadataModule contract address (from the slot's on-chain module field)
   * @param slot - The slot contract address
   */
  async getURI(moduleAddress: Address, slot: Address): Promise<string> {
    return this.query(
      "metadata.getURI",
      () =>
        this.publicClient.readContract({
          address: moduleAddress,
          abi: metadataModuleAbi,
          functionName: "tokenURI",
          args: [slot],
        }) as Promise<string>,
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WRITE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Update the metadata URI for a slot. Only callable by the current occupant.
   * Verifies on-chain that the address is a MetadataModule before writing.
   * @param moduleAddress - The MetadataModule contract address (from the slot's on-chain module field)
   * @param slot - The slot contract address
   * @param uri - The new URI (e.g. ipfs://..., https://...)
   * @returns Transaction hash
   */
  async updateMetadata(
    moduleAddress: Address,
    slot: Address,
    uri: string,
  ): Promise<Hash> {
    await this.verifyModule(moduleAddress);
    return this.wallet.writeContract({
      address: moduleAddress,
      abi: metadataModuleAbi,
      functionName: "updateMetadata",
      args: [slot, uri],
      account: this.account,
      chain: this.chain,
    });
  }

  /**
   * Buy a slot and publish its URI in a single transaction.
   *
   * `updateMetadata` is occupant-only, so buying and publishing were two calls
   * that could not be reordered — and on a wallet without EIP-5792 the second
   * one failed, because the wallet's own RPC still had the previous occupant
   * when it estimated gas. This moves the sequencing on-chain: one call frame,
   * nothing observable in between.
   *
   * ERC-20 slots still need an `approve` first, so this is TWO wallet
   * confirmations for them — the module pulls payment, so the allowance goes to
   * the MODULE, not to the slot. For a single confirmation on a token that
   * implements EIP-2612, use {@link buyAndUpdateWithPermit}. Native slots are
   * paid by value and are always one.
   *
   * @param moduleAddress - The MetadataModule address (from the slot's `utility`)
   * @param params - Slot, deposit, price and URI
   * @returns Transaction hash of the buy-and-publish call
   * @throws {SlotsError} If the address is not a MetadataModule, or the price is not positive
   */
  async buyAndUpdate(
    moduleAddress: Address,
    params: BuyAndUpdateParams,
  ): Promise<Hash> {
    await this.verifyModule(moduleAddress);
    if (params.selfAssessedPrice <= BigInt(0)) {
      throw new SlotsError(
        "metadata.buyAndUpdate",
        "selfAssessedPrice must be greater than zero",
      );
    }

    const { currency, owed } = await this.buyCost(params);

    if (isNativeCurrency(currency)) {
      return this.writeBuyAndUpdate(moduleAddress, params, owed);
    }

    await this.ensureAllowance(currency, moduleAddress, owed);
    return this.writeBuyAndUpdate(moduleAddress, params, undefined);
  }

  /**
   * {@link buyAndUpdate}, preceded by an EIP-2612 permit.
   *
   * This is the one that reaches a SINGLE transaction for a plain EOA: a permit
   * is a signature rather than a transaction, so the approval folds into the
   * call. USDC on Base implements 2612, which is what makes it worth having.
   *
   * The signature is the caller's to produce — sign the token's `Permit` typed
   * data with `spender` set to `moduleAddress` and `value` covering
   * {@link quoteBuyCost}. A permit someone else front-runs is not a failure:
   * the module ignores a permit that no longer applies and relies on the
   * allowance it granted either way.
   *
   * @throws {SlotsError} If the slot is native — a native slot has no token to permit
   */
  async buyAndUpdateWithPermit(
    moduleAddress: Address,
    params: BuyAndUpdateParams,
    permit: PermitSignature,
  ): Promise<Hash> {
    await this.verifyModule(moduleAddress);
    if (params.selfAssessedPrice <= BigInt(0)) {
      throw new SlotsError(
        "metadata.buyAndUpdateWithPermit",
        "selfAssessedPrice must be greater than zero",
      );
    }

    const { currency } = await this.buyCost(params);
    if (isNativeCurrency(currency)) {
      throw new SlotsError(
        "metadata.buyAndUpdateWithPermit",
        "Slot is denominated in native currency and has no token to permit — use buyAndUpdate",
      );
    }

    return this.wallet.writeContract({
      address: moduleAddress,
      abi: metadataModuleAbi,
      functionName: "buyAndUpdateWithPermit",
      args: [
        params.slot,
        params.depositAmount,
        params.selfAssessedPrice,
        params.uri,
        permit.value,
        permit.deadline,
        permit.v,
        permit.r,
        permit.s,
      ],
      account: this.account,
      chain: this.chain,
    });
  }

  /**
   * What a buy will cost, and in what currency.
   *
   * Exposed because a permit has to be signed for an amount before the call is
   * made, and guessing that amount is how a permit ends up too small.
   *
   * @returns `currency` (the zero address for native slots) and `owed`
   */
  async quoteBuyCost(
    slot: Address,
    depositAmount: bigint,
  ): Promise<{ currency: Address; owed: bigint }> {
    return this.buyCost({ slot, depositAmount });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INTERNAL
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Mirrors `owedByBuyer` in `Slot.buy`: an occupied slot costs its standing
   * price on top of the deposit.
   *
   * A vacant slot always has a price of zero — `buy` is the only thing that
   * sets one, and `release`/`liquidate` clear it — so the single sum is right
   * either way and there is no occupancy read to get wrong.
   */
  private async buyCost(params: {
    slot: Address;
    depositAmount: bigint;
  }): Promise<{ currency: Address; owed: bigint }> {
    return this.query("metadata.buyCost", async () => {
      const [currency, price] = await Promise.all([
        this.publicClient.readContract({
          address: params.slot,
          abi: slotAbi,
          functionName: "currency",
        }) as Promise<Address>,
        this.publicClient.readContract({
          address: params.slot,
          abi: slotAbi,
          functionName: "price",
        }) as Promise<bigint>,
      ]);
      return { currency, owed: price + params.depositAmount };
    });
  }

  /** Approve `spender` for `amount` if the standing allowance falls short. */
  private async ensureAllowance(
    currency: Address,
    spender: Address,
    amount: bigint,
  ): Promise<void> {
    if (amount === BigInt(0)) return;

    const allowance = (await this.publicClient.readContract({
      address: currency,
      abi: erc20Abi,
      functionName: "allowance",
      args: [this.account, spender],
    })) as bigint;
    if (allowance >= amount) return;

    const hash = await this.wallet.writeContract({
      address: currency,
      abi: erc20Abi,
      functionName: "approve",
      args: [spender, amount],
      account: this.account,
      chain: this.chain,
    });
    await this.publicClient.waitForTransactionReceipt({ hash });
  }

  private writeBuyAndUpdate(
    moduleAddress: Address,
    params: BuyAndUpdateParams,
    value: bigint | undefined,
  ): Promise<Hash> {
    return this.wallet.writeContract({
      address: moduleAddress,
      abi: metadataModuleAbi,
      functionName: "buyAndUpdate",
      args: [
        params.slot,
        params.depositAmount,
        params.selfAssessedPrice,
        params.uri,
      ],
      account: this.account,
      chain: this.chain,
      ...(value === undefined ? {} : { value }),
    });
  }
}
