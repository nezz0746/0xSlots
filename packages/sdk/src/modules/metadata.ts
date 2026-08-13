import { metadataModuleAbi } from "@0xslots/contracts";
import type { Address, Chain, Hash, PublicClient, WalletClient } from "viem";
import { SlotsError } from "../errors";
import type { getSdk } from "../generated/graphql";

const EXPECTED_MODULE_NAME = "AdLandModule";

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
    ...args: Parameters<
      ReturnType<typeof getSdk>["GetMetadataSlotsBySlots"]
    >
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
}
