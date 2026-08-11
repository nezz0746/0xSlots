import {
  getSlotsHubAddress,
  MINIMUM_PRICE_POLICY_FACTORY,
  MINIMUM_TENURE_POLICY_FACTORY,
  minimumPricePolicyFactoryAbi,
  minimumTenurePolicyFactoryAbi,
  slotAbi,
  slotFactoryAbi,
} from "@0xslots/contracts";
import { GraphQLClient, gql } from "graphql-request";
import {
  type Address,
  type Chain,
  encodeFunctionData,
  erc20Abi,
  type Hash,
  type PublicClient,
  type WalletClient,
  zeroAddress as ZERO_ADDRESS,
} from "viem";
import { SlotsError } from "./errors";
import { getSdk } from "./generated/graphql";
import { FeedModuleClient } from "./modules/feed";
import { MetadataModuleClient } from "./modules/metadata";
import { isNativeCurrency } from "./native";

// ─── GraphQL Meta ─────────────────────────────────────────────────────────────

const META_QUERY = gql`
  query GetMeta {
    _meta {
      block {
        number
        hash
        timestamp
      }
      hasIndexingErrors
    }
  }
`;

export interface SubgraphMeta {
  _meta: {
    block: { number: number; hash: string; timestamp: number };
    hasIndexingErrors: boolean;
  };
}

// ─── Chain Config ─────────────────────────────────────────────────────────────

export enum SlotsChain {
  BASE = 8453,
  BASE_SEPOLIA = 84532,
}

export const SUBGRAPH_URLS: Record<SlotsChain, string> = {
  [SlotsChain.BASE_SEPOLIA]:
    "https://gateway.thegraph.com/api/subgraphs/id/Z361DLoMdPh9WAopH7shJP8WoXYAB9XeKrLUCTYjdZR",
  [SlotsChain.BASE]:
    "https://gateway.thegraph.com/api/subgraphs/id/4sZrdv1SFzN4KzE9jiWDRuUyM4CnCrmvQ54Rv1s65qUq",
};

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Which of a slot's three governable dimensions a pending update targets.
 *
 * A slot holds at most one pending update per kind — three in total — and each
 * can be proposed, inspected and cancelled independently. The numeric values
 * mirror the Solidity enum and are what goes on the wire; do not reorder them.
 */
export enum UpdateKind {
  Tax = 0,
  Utility = 1,
  Policy = 2,
}

export interface SlotConfig {
  mutableTax: boolean;
  /** The UTILITY — what the slot does. */
  mutableUtility?: boolean;
  /** @deprecated use `mutableUtility` */
  mutableModule?: boolean;
  /** The OCCUPANCY policy — whether forced sale applies, and on what terms. */
  mutablePolicy: boolean;
  /** address(0) when every flag is false. */
  manager: Address;
}

export interface SlotInitParams {
  taxPercentage: bigint;
  /** The utility contract, or the zero address for none. */
  utility?: Address;
  /** @deprecated use `utility` */
  module?: Address;
  liquidationBountyBps: bigint;
  minDepositSeconds: bigint;
  /** IOccupancyPolicy address, or zero for plain instant buy. */
  occupancyPolicy: Address;
}

/**
 * Build the exact tuples the factory expects.
 *
 * viem encodes a struct argument BY COMPONENT NAME, so an object carrying the
 * old `mutableModule` / `module` keys against the current ABI encodes nothing
 * for those fields. Both names are accepted here and normalised to the one the
 * contract declares, so a caller on either spelling produces the same calldata.
 *
 * This drifted silently once: the SDK and the checked-in ABIs were BOTH on the
 * old names, so they agreed with each other and disagreed with the chain. Doing
 * the mapping explicitly is what stops that happening again — a missing field
 * is now a type error here rather than a zero address on-chain.
 */
function encodeSlotConfig(config: SlotConfig) {
  return {
    mutableTax: config.mutableTax,
    mutableUtility: config.mutableUtility ?? config.mutableModule ?? false,
    mutablePolicy: config.mutablePolicy,
    manager: config.manager,
  } as const;
}

function encodeSlotInitParams(init: SlotInitParams) {
  return {
    taxPercentage: init.taxPercentage,
    utility: init.utility ?? init.module ?? ZERO_ADDRESS,
    liquidationBountyBps: init.liquidationBountyBps,
    minDepositSeconds: init.minDepositSeconds,
    occupancyPolicy: init.occupancyPolicy,
  } as const;
}

export interface CreateSlotParams {
  recipient: Address;
  currency: Address;
  config: SlotConfig;
  initParams: SlotInitParams;
}

export interface CreateSlotsParams extends CreateSlotParams {
  count: bigint;
}

export interface BuyParams {
  slot: Address;
  account: Address;
  depositAmount: bigint;
  selfAssessedPrice: bigint;
}

export interface SlotsClientConfig {
  chainId: SlotsChain;
  factoryAddress?: Address;
  publicClient?: PublicClient;
  walletClient?: WalletClient;
  subgraphUrl?: string;
  subgraphApiKey?: string;
  headers?: Record<string, string>;
}

// ─── Client ───────────────────────────────────────────────────────────────────

/**
 * Client for reading and writing 0xSlots protocol data.
 *
 * Reads come from a Graph Protocol subgraph (via graphql-request).
 * Writes go through a viem WalletClient and handle ERC-20 approvals automatically.
 *
 * @example
 * ```ts
 * const client = new SlotsClient({
 *   chainId: SlotsChain.BASE,
 *   publicClient,
 *   walletClient,
 * });
 * const slots = await client.getSlots({ first: 10 });
 * ```
 */
export class SlotsClient {
  private readonly sdk: ReturnType<typeof getSdk>;
  private readonly chainId: SlotsChain;
  private readonly gqlClient: GraphQLClient;
  private readonly _publicClient?: PublicClient;
  private readonly walletClient?: WalletClient;
  private readonly _factory?: Address;

  /** Module namespaces for protocol extensions. */
  public readonly modules: {
    metadata: MetadataModuleClient;
    feed: FeedModuleClient;
  };

  constructor(config: SlotsClientConfig) {
    this.chainId = config.chainId;
    this._publicClient = config.publicClient;
    this.walletClient = config.walletClient;
    this._factory = config.factoryAddress ?? getSlotsHubAddress(config.chainId);

    const url = config.subgraphUrl || SUBGRAPH_URLS[config.chainId];
    if (!url) throw new Error(`No subgraph URL for chain ${config.chainId}`);
    const headers: Record<string, string> = { ...config.headers };
    if (config.subgraphApiKey) {
      headers["Authorization"] = `Bearer ${config.subgraphApiKey}`;
    }
    this.gqlClient = new GraphQLClient(url, { headers });
    this.sdk = getSdk(this.gqlClient);

    this.modules = {
      metadata: new MetadataModuleClient({
        sdk: this.sdk,
        publicClient: config.publicClient,
        walletClient: config.walletClient,
      }),
      feed: new FeedModuleClient({
        sdk: this.sdk,
        chainId: config.chainId,
        publicClient: config.publicClient,
        walletClient: config.walletClient,
      }),
    };
  }

  // ─── Accessors ──────────────────────────────────────────────────────────────

  /** Returns the chain ID this client was configured for. */
  getChainId(): SlotsChain {
    return this.chainId;
  }
  /** Returns the underlying GraphQL client (for advanced usage). */
  getClient(): GraphQLClient {
    return this.gqlClient;
  }
  /** Returns the generated GraphQL SDK (for queries not wrapped by this client). */
  getSdk() {
    return this.sdk;
  }

  private get publicClient(): PublicClient {
    if (!this._publicClient) throw new Error("No publicClient provided");
    return this._publicClient;
  }

  private get factory(): Address {
    if (!this._factory) throw new Error("No factoryAddress provided");
    return this._factory;
  }

  private get wallet(): WalletClient {
    if (!this.walletClient) throw new Error("No walletClient provided");
    return this.walletClient;
  }

  private get account(): Address {
    const account = this.wallet.account;
    if (!account) throw new Error("WalletClient must have an account");
    return account.address;
  }

  private get chain(): Chain {
    const chain = this.wallet.chain;
    if (!chain) throw new Error("WalletClient must have a chain");
    return chain;
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private assertPositive(value: bigint, name: string): void {
    if (value <= 0n) throw new SlotsError(name, `${name} must be > 0`);
  }

  private async query<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      throw new SlotsError(operation, error);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // READ — Subgraph Queries
  // ═══════════════════════════════════════════════════════════════════════════

  // Slot queries

  /** Fetch a paginated list of slots. */
  getSlots(...args: Parameters<ReturnType<typeof getSdk>["GetSlots"]>) {
    return this.query("getSlots", () => this.sdk.GetSlots(...args));
  }
  /** Fetch a single slot by its address. */
  getSlot(...args: Parameters<ReturnType<typeof getSdk>["GetSlot"]>) {
    return this.query("getSlot", () => this.sdk.GetSlot(...args));
  }
  /** Fetch all slots owned by a given recipient address. */
  getSlotsByRecipient(
    ...args: Parameters<ReturnType<typeof getSdk>["GetSlotsByRecipient"]>
  ) {
    return this.query("getSlotsByRecipient", () =>
      this.sdk.GetSlotsByRecipient(...args),
    );
  }
  /** Fetch all slots currently occupied by a given address. */
  getSlotsByOccupant(
    ...args: Parameters<ReturnType<typeof getSdk>["GetSlotsByOccupant"]>
  ) {
    return this.query("getSlotsByOccupant", () =>
      this.sdk.GetSlotsByOccupant(...args),
    );
  }
  /** Fetch a paginated list of slots with their metadata. */
  getSlotsWithMetadata(
    ...args: Parameters<ReturnType<typeof getSdk>["GetSlotsWithMetadata"]>
  ) {
    return this.query("getSlotsWithMetadata", () =>
      this.sdk.GetSlotsWithMetadata(...args),
    );
  }

  // Factory queries

  /** Fetch factory configuration. */
  getFactory() {
    return this.query("getFactory", () => this.sdk.GetFactory());
  }
  /** Fetch registered modules. */
  getModules(...args: Parameters<ReturnType<typeof getSdk>["GetModules"]>) {
    return this.query("getModules", () => this.sdk.GetModules(...args));
  }

  // Event queries

  /** Fetch slot deployed events with optional filters. */
  getSlotDeployedEvents(
    ...args: Parameters<ReturnType<typeof getSdk>["GetSlotDeployedEvents"]>
  ) {
    return this.query("getSlotDeployedEvents", () =>
      this.sdk.GetSlotDeployedEvents(...args),
    );
  }
  /** Fetch bought events with optional filters. */
  getBoughtEvents(
    ...args: Parameters<ReturnType<typeof getSdk>["GetBoughtEvents"]>
  ) {
    return this.query("getBoughtEvents", () =>
      this.sdk.GetBoughtEvents(...args),
    );
  }
  /** Fetch settled events with optional filters. */
  getSettledEvents(
    ...args: Parameters<ReturnType<typeof getSdk>["GetSettledEvents"]>
  ) {
    return this.query("getSettledEvents", () =>
      this.sdk.GetSettledEvents(...args),
    );
  }
  /** Fetch tax-collected events with optional filters. */
  getTaxCollectedEvents(
    ...args: Parameters<ReturnType<typeof getSdk>["GetTaxCollectedEvents"]>
  ) {
    return this.query("getTaxCollectedEvents", () =>
      this.sdk.GetTaxCollectedEvents(...args),
    );
  }
  /** Fetch all activity for a specific slot (all event types). */
  getSlotActivity(
    ...args: Parameters<ReturnType<typeof getSdk>["GetSlotActivity"]>
  ) {
    return this.query("getSlotActivity", () =>
      this.sdk.GetSlotActivity(...args),
    );
  }
  /** Fetch the most recent events across all slots. */
  getRecentEvents(
    ...args: Parameters<ReturnType<typeof getSdk>["GetRecentEvents"]>
  ) {
    return this.query("getRecentEvents", () =>
      this.sdk.GetRecentEvents(...args),
    );
  }

  // Account queries

  /** Fetch a single account by address. */
  getAccount(...args: Parameters<ReturnType<typeof getSdk>["GetAccount"]>) {
    return this.query("getAccount", () => this.sdk.GetAccount(...args));
  }
  /** Fetch a paginated list of accounts. */
  getAccounts(...args: Parameters<ReturnType<typeof getSdk>["GetAccounts"]>) {
    return this.query("getAccounts", () => this.sdk.GetAccounts(...args));
  }

  // AccountSlot queries

  /** Fetch a single account-slot interaction by composite ID ({account}-{slot}). */
  getAccountSlot(
    ...args: Parameters<ReturnType<typeof getSdk>["GetAccountSlot"]>
  ) {
    return this.query("getAccountSlot", () => this.sdk.GetAccountSlot(...args));
  }
  /** Fetch a paginated list of account-slot interactions. */
  getAccountSlots(
    ...args: Parameters<ReturnType<typeof getSdk>["GetAccountSlots"]>
  ) {
    return this.query("getAccountSlots", () =>
      this.sdk.GetAccountSlots(...args),
    );
  }

  // Individual event queries

  /** Fetch released events with optional filters. */
  getReleasedEvents(
    ...args: Parameters<ReturnType<typeof getSdk>["GetReleasedEvents"]>
  ) {
    return this.query("getReleasedEvents", () =>
      this.sdk.GetReleasedEvents(...args),
    );
  }
  /** Fetch liquidated events with optional filters. */
  getLiquidatedEvents(
    ...args: Parameters<ReturnType<typeof getSdk>["GetLiquidatedEvents"]>
  ) {
    return this.query("getLiquidatedEvents", () =>
      this.sdk.GetLiquidatedEvents(...args),
    );
  }
  /** Fetch deposited events with optional filters. */
  getDepositedEvents(
    ...args: Parameters<ReturnType<typeof getSdk>["GetDepositedEvents"]>
  ) {
    return this.query("getDepositedEvents", () =>
      this.sdk.GetDepositedEvents(...args),
    );
  }
  /** Fetch withdrawn events with optional filters. */
  getWithdrawnEvents(
    ...args: Parameters<ReturnType<typeof getSdk>["GetWithdrawnEvents"]>
  ) {
    return this.query("getWithdrawnEvents", () =>
      this.sdk.GetWithdrawnEvents(...args),
    );
  }
  /** Fetch price-updated events with optional filters. */
  getPriceUpdatedEvents(
    ...args: Parameters<ReturnType<typeof getSdk>["GetPriceUpdatedEvents"]>
  ) {
    return this.query("getPriceUpdatedEvents", () =>
      this.sdk.GetPriceUpdatedEvents(...args),
    );
  }

  // Meta

  /** Fetch subgraph indexing metadata (latest block, indexing errors). */
  getMeta(): Promise<SubgraphMeta> {
    return this.query("getMeta", () =>
      this.gqlClient.request<SubgraphMeta>(META_QUERY),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // READ — On-chain (RPC)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Read full slot info from on-chain (RPC, not subgraph).
   * @param slot - Slot contract address.
   * @returns On-chain slot info tuple.
   * @throws {SlotsError} If the RPC call fails.
   */
  getSlotInfo(slot: Address) {
    return this.query("getSlotInfo", () =>
      this.publicClient.readContract({
        address: slot,
        abi: slotAbi,
        functionName: "getSlotInfo",
      }),
    );
  }

  /**
   * Read full slot info for multiple slots in a single RPC call via multicall.
   * @param slots - Array of slot contract addresses.
   * @returns Array of results matching the input order.
   * @throws {SlotsError} If the multicall fails.
   */
  getSlotsInfo(slots: Address[]) {
    return this.query("getSlotsInfo", () =>
      this.publicClient.multicall({
        contracts: slots.map((address) => ({
          address,
          abi: slotAbi,
          functionName: "getSlotInfo" as const,
        })),
      }),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WRITE — Factory Functions
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Deploy a new slot via the factory contract.
   * @param params - Slot creation parameters (recipient, currency, config, initParams).
   * @returns Transaction hash.
   */
  async createSlot(params: CreateSlotParams): Promise<Hash> {
    return this.wallet.writeContract({
      address: this.factory,
      abi: slotFactoryAbi,
      functionName: "createSlot",
      args: [
        params.recipient,
        params.currency,
        encodeSlotConfig(params.config),
        encodeSlotInitParams(params.initParams),
      ],
      account: this.account,
      chain: this.chain,
    });
  }

  // ─── Minimum tenure policies ───────────────────────────────────────────────
  //
  // MinimumTenurePolicy holds its window in an immutable constructor arg, so a
  // given duration is one contract at one address. The factory deploys that
  // contract deterministically from the duration, which keeps the policy
  // stateless (nobody can lengthen protection under a sitting occupant) while
  // still allowing any duration. A duration is deployed once protocol-wide.

  /** Address the tenure policy for `tenureSeconds` has, or would have. */
  async predictTenurePolicy(tenureSeconds: bigint): Promise<Address> {
    return this.publicClient.readContract({
      address: this.tenurePolicyFactory(),
      abi: minimumTenurePolicyFactoryAbi,
      functionName: "predict",
      args: [tenureSeconds],
    }) as Promise<Address>;
  }

  /** Whether that policy already exists — lets callers skip a transaction. */
  async isTenurePolicyDeployed(tenureSeconds: bigint): Promise<boolean> {
    return this.publicClient.readContract({
      address: this.tenurePolicyFactory(),
      abi: minimumTenurePolicyFactoryAbi,
      functionName: "isDeployed",
      args: [tenureSeconds],
    }) as Promise<boolean>;
  }

  /**
   * Deploy the tenure policy for `tenureSeconds` if it does not exist yet.
   * Idempotent — safe to call when another caller deployed it first.
   *
   * Waits for the receipt rather than returning on broadcast. Callers deploy a
   * policy in order to immediately reference it, and `createSlot` reverts with
   * `InvalidModule_NoCode` while the CREATE2 address is still empty — which
   * surfaces as an opaque RPC gas-limit rejection, because a wallet whose
   * estimation reverts falls back to the block gas limit.
   */
  async deployTenurePolicy(tenureSeconds: bigint): Promise<Hash> {
    const hash = await this.wallet.writeContract({
      address: this.tenurePolicyFactory(),
      abi: minimumTenurePolicyFactoryAbi,
      functionName: "getOrDeploy",
      args: [tenureSeconds],
      account: this.account,
      chain: this.chain,
    });
    await this.publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }

  // ─── Minimum price policy ───────────────────────────────────────────────
  //
  // Same shape as tenure: the policy holds its terms in immutable constructor
  // args, so (currency, minPrice) is one contract at one address. The currency
  // is part of the key because the floor is a bare integer whose meaning
  // depends entirely on that token's decimals.

  /** Address the price policy for `(currency, minPrice)` has, or would have. */
  async predictPricePolicy(
    currency: Address,
    minPrice: bigint,
  ): Promise<Address> {
    return this.publicClient.readContract({
      address: this.pricePolicyFactory(),
      abi: minimumPricePolicyFactoryAbi,
      functionName: "predict",
      args: [currency, minPrice],
    }) as Promise<Address>;
  }

  /** Whether that policy already exists — lets callers skip a transaction. */
  async isPricePolicyDeployed(
    currency: Address,
    minPrice: bigint,
  ): Promise<boolean> {
    return this.publicClient.readContract({
      address: this.pricePolicyFactory(),
      abi: minimumPricePolicyFactoryAbi,
      functionName: "isDeployed",
      args: [currency, minPrice],
    }) as Promise<boolean>;
  }

  /**
   * Deploy the price policy for `(currency, minPrice)` if it does not exist.
   * Idempotent — safe to call when another caller deployed it first.
   *
   * Waits for the receipt for the same reason `deployTenurePolicy` does: the
   * caller is about to reference this address in `createSlot`, which reverts
   * `InvalidModule_NoCode` while the CREATE2 address is still empty.
   */
  async deployPricePolicy(currency: Address, minPrice: bigint): Promise<Hash> {
    const hash = await this.wallet.writeContract({
      address: this.pricePolicyFactory(),
      abi: minimumPricePolicyFactoryAbi,
      functionName: "getOrDeploy",
      args: [currency, minPrice],
      account: this.account,
      chain: this.chain,
    });
    await this.publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }

  private pricePolicyFactory(): Address {
    const addr = MINIMUM_PRICE_POLICY_FACTORY[this.chainId];
    if (!addr)
      throw new SlotsError(
        "Resolve price policy factory",
        new Error(
          `No MinimumPricePolicyFactory deployed on chain ${this.chainId}`,
        ),
      );
    return addr;
  }

  private tenurePolicyFactory(): Address {
    const addr = MINIMUM_TENURE_POLICY_FACTORY[this.chainId];
    if (!addr)
      throw new SlotsError(
        "Resolve tenure policy factory",
        new Error(
          `No MinimumTenurePolicyFactory deployed on chain ${this.chainId}`,
        ),
      );
    return addr;
  }

  /**
   * Deploy multiple identical slots in a single transaction via the factory contract.
   * @param params - Slot creation parameters including count.
   * @returns Transaction hash.
   */
  async createSlots(params: CreateSlotsParams): Promise<Hash> {
    return this.wallet.writeContract({
      address: this.factory,
      abi: slotFactoryAbi,
      functionName: "createSlots",
      args: [
        params.recipient,
        params.currency,
        encodeSlotConfig(params.config),
        encodeSlotInitParams(params.initParams),
        params.count,
      ],
      account: this.account,
      chain: this.chain,
    });
  }

  /**
   * Collect tax from multiple slots in a single transaction via the factory.
   * Skips slots that aren't registered or have nothing to collect.
   * @param slots - Array of slot contract addresses.
   * @returns Transaction hash.
   */
  async collectAll(slots: Address[]): Promise<Hash> {
    return this.wallet.writeContract({
      address: this.factory,
      abi: slotFactoryAbi,
      functionName: "collectAll",
      args: [slots],
      account: this.account,
      chain: this.chain,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WRITE — Slot Functions
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Buy a slot (or force-buy an occupied one).
   * Handles ERC-20 approval automatically; native ETH slots pay by value.
   * @param params - Buy parameters (slot address, deposit amount, self-assessed price).
   * @returns Transaction hash.
   * @throws {SlotsError} If depositAmount or selfAssessedPrice is not positive, or the transaction fails.
   */
  async buy(params: BuyParams): Promise<Hash> {
    this.assertPositive(params.depositAmount, "depositAmount");
    this.assertPositive(params.selfAssessedPrice, "selfAssessedPrice");

    // If the slot is occupied, the contract pulls currentPrice + depositAmount.
    const currentPrice = await this.publicClient.readContract({
      address: params.slot,
      abi: slotAbi,
      functionName: "price",
    });
    const approvalAmount = currentPrice + params.depositAmount;

    return this.withPayment(params.slot, approvalAmount, {
      to: params.slot,
      abi: slotAbi,
      functionName: "buy",
      args: [params.account, params.depositAmount, params.selfAssessedPrice],
    });
  }

  /**
   * Self-assess a new price for an occupied slot (occupant only).
   * @param slot - The slot contract address.
   * @param newPrice - The new self-assessed price (can be 0).
   * @returns Transaction hash.
   */
  async selfAssess(slot: Address, newPrice: bigint): Promise<Hash> {
    return this.wallet.writeContract({
      address: slot,
      abi: slotAbi,
      functionName: "selfAssess",
      args: [newPrice],
      account: this.account,
      chain: this.chain,
    });
  }

  /**
   * Top up deposit on a slot. Anyone can pay to extend the occupant's deposit.
   * Handles ERC-20 approval automatically; native ETH slots pay by value.
   * @param slot - The slot contract address.
   * @param amount - The amount to deposit (must be > 0).
   * @returns Transaction hash.
   * @throws {SlotsError} If amount is not positive, or the transaction fails.
   */
  async topUp(slot: Address, amount: bigint): Promise<Hash> {
    this.assertPositive(amount, "amount");
    return this.withPayment(slot, amount, {
      to: slot,
      abi: slotAbi,
      functionName: "topUp",
      args: [amount],
    });
  }

  /**
   * Withdraw from deposit (occupant only). Cannot go below minimum deposit.
   * @param slot - The slot contract address.
   * @param amount - The amount to withdraw (must be > 0).
   * @returns Transaction hash.
   * @throws {SlotsError} If amount is not positive, or the transaction fails.
   */
  async withdraw(slot: Address, amount: bigint): Promise<Hash> {
    this.assertPositive(amount, "amount");
    return this.wallet.writeContract({
      address: slot,
      abi: slotAbi,
      functionName: "withdraw",
      args: [amount],
      account: this.account,
      chain: this.chain,
    });
  }

  /**
   * Release a slot (occupant only). Returns remaining deposit to the occupant.
   * @param slot - The slot contract address.
   * @returns Transaction hash.
   */
  async release(slot: Address): Promise<Hash> {
    return this.wallet.writeContract({
      address: slot,
      abi: slotAbi,
      functionName: "release",
      account: this.account,
      chain: this.chain,
    });
  }

  /**
   * Collect accumulated tax (permissionless).
   * @param slot - The slot contract address.
   * @returns Transaction hash.
   */
  async collect(slot: Address): Promise<Hash> {
    return this.wallet.writeContract({
      address: slot,
      abi: slotAbi,
      functionName: "collect",
      account: this.account,
      chain: this.chain,
    });
  }

  /**
   * Liquidate an insolvent slot (permissionless). Caller receives bounty.
   * @param slot - The slot contract address.
   * @returns Transaction hash.
   */
  async liquidate(slot: Address): Promise<Hash> {
    return this.wallet.writeContract({
      address: slot,
      abi: slotAbi,
      functionName: "liquidate",
      account: this.account,
      chain: this.chain,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WRITE — Manager Functions
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Propose a tax rate update (manager only, slot must have mutableTax).
   * @param slot - The slot contract address.
   * @param newPct - The new tax percentage.
   * @returns Transaction hash.
   */
  async proposeTaxUpdate(slot: Address, newPct: bigint): Promise<Hash> {
    return this.wallet.writeContract({
      address: slot,
      abi: slotAbi,
      functionName: "proposeTaxUpdate",
      args: [newPct],
      account: this.account,
      chain: this.chain,
    });
  }

  /**
   * Propose a utility update (manager only, slot must have mutableUtility).
   * @param slot - The slot contract address.
   * @param newUtility - The new utility contract address, or the zero address
   *   to remove the utility entirely.
   * @returns Transaction hash.
   */
  async proposeUtilityUpdate(
    slot: Address,
    newUtility: Address,
  ): Promise<Hash> {
    return this.wallet.writeContract({
      address: slot,
      abi: slotAbi,
      functionName: "proposeUtilityUpdate",
      args: [newUtility],
      account: this.account,
      chain: this.chain,
    });
  }

  /**
   * @deprecated Use {@link proposeUtilityUpdate}. Kept for one release; it
   * targets the slot's deprecated `proposeModuleUpdate` selector, which simply
   * forwards to the same place.
   */
  async proposeModuleUpdate(slot: Address, newModule: Address): Promise<Hash> {
    return this.wallet.writeContract({
      address: slot,
      abi: slotAbi,
      functionName: "proposeModuleUpdate",
      args: [newModule],
      account: this.account,
      chain: this.chain,
    });
  }

  /**
   * Propose an occupancy-policy update (manager only, slot must have
   * mutablePolicy).
   *
   * Gated on its own flag rather than `mutableUtility`: swapping what a slot
   * does and swapping whether it can be taken from you are different promises,
   * and an occupant who accepted the first has not accepted the second.
   *
   * @param slot - The slot contract address.
   * @param newPolicy - The new IOccupancyPolicy address, or the zero address
   *   for plain Harberger rules with no policy at all.
   * @returns Transaction hash.
   */
  async proposePolicyUpdate(slot: Address, newPolicy: Address): Promise<Hash> {
    return this.wallet.writeContract({
      address: slot,
      abi: slotAbi,
      functionName: "proposePolicyUpdate",
      args: [newPolicy],
      account: this.account,
      chain: this.chain,
    });
  }

  /**
   * Cancel the pending update for ONE dimension, leaving the others queued
   * (manager only).
   *
   * Prefer this over {@link cancelPendingUpdates}. A slot can hold a pending
   * tax, utility and policy change at the same time, and the blanket version
   * drops all three — including proposals someone else queued.
   *
   * @param slot - The slot contract address.
   * @param kind - Which dimension to retract.
   * @returns Transaction hash.
   */
  async cancelPendingUpdate(slot: Address, kind: UpdateKind): Promise<Hash> {
    return this.wallet.writeContract({
      address: slot,
      abi: slotAbi,
      functionName: "cancelPendingUpdate",
      args: [kind],
      account: this.account,
      chain: this.chain,
    });
  }

  /**
   * Cancel EVERY pending update on the slot (manager only).
   *
   * Blunt by design — it clears tax, utility and policy together. Use
   * {@link cancelPendingUpdate} unless dropping all three is genuinely what
   * you mean.
   *
   * @param slot - The slot contract address.
   * @returns Transaction hash.
   */
  async cancelPendingUpdates(slot: Address): Promise<Hash> {
    return this.wallet.writeContract({
      address: slot,
      abi: slotAbi,
      functionName: "cancelPendingUpdates",
      account: this.account,
      chain: this.chain,
    });
  }

  /**
   * Set liquidation bounty bps (manager only).
   * @param slot - The slot contract address.
   * @param newBps - The new bounty in basis points (0-10000).
   * @returns Transaction hash.
   * @throws {SlotsError} If newBps is outside 0-10000, or the transaction fails.
   */
  async setLiquidationBounty(slot: Address, newBps: bigint): Promise<Hash> {
    if (newBps < 0n || newBps > 10000n)
      throw new SlotsError("setLiquidationBounty", "newBps must be 0-10000");
    return this.wallet.writeContract({
      address: slot,
      abi: slotAbi,
      functionName: "setLiquidationBounty",
      args: [newBps],
      account: this.account,
      chain: this.chain,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WRITE — Multicall
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Batch multiple slot calls into one transaction via multicall.
   * @param slot - The slot contract address.
   * @param calls - Array of function calls to batch.
   * @returns Transaction hash.
   * @throws {SlotsError} If calls array is empty, or the transaction fails.
   */
  async multicall(
    slot: Address,
    calls: { functionName: string; args?: any[] }[],
  ): Promise<Hash> {
    if (calls.length === 0)
      throw new SlotsError("multicall", "calls array must not be empty");
    const data = calls.map((call) =>
      encodeFunctionData({
        abi: slotAbi,
        functionName: call.functionName as any,
        args: call.args as any,
      }),
    );
    return this.wallet.writeContract({
      address: slot,
      abi: slotAbi,
      functionName: "multicall",
      args: [data],
      account: this.account,
      chain: this.chain,
    });
  }

  // ─── Internals ──────────────────────────────────────────────────────────────

  /**
   * Send `call`, paying `amount` the way this slot's currency requires.
   *
   * Native slots hold no allowance to grant, so the value rides on the
   * transaction itself. ERC-20 slots keep the approve → confirm on-chain →
   * execute sequence, skipping the approval when the existing allowance
   * already covers the amount.
   */
  private async withPayment(
    spender: Address,
    amount: bigint,
    call: {
      to: Address;
      abi: typeof slotAbi;
      functionName: "topUp" | "buy";
      args: readonly unknown[];
    },
  ): Promise<Hash> {
    const currency = await this.publicClient.readContract({
      address: spender,
      abi: slotAbi,
      functionName: "currency",
    });

    if (isNativeCurrency(currency)) {
      // No allowance exists to read or grant. The contract requires
      // msg.value to equal `amount` exactly.
      return this.wallet.writeContract({
        address: call.to,
        abi: call.abi,
        functionName: call.functionName,
        args: call.args as any,
        value: amount,
        account: this.account,
        chain: this.chain,
      });
    }

    const allowance = await this.publicClient.readContract({
      address: currency,
      abi: erc20Abi,
      functionName: "allowance",
      args: [this.account, spender],
    });

    if (allowance < amount) {
      const approveTx = await this.wallet.writeContract({
        address: currency,
        abi: erc20Abi,
        functionName: "approve",
        args: [spender, amount],
        account: this.account,
        chain: this.chain,
      });
      await this.publicClient.waitForTransactionReceipt({ hash: approveTx });

      // Poll until the allowance is visible on this RPC node (handles node lag).
      const confirmed = await this.pollUntil(
        () =>
          this.publicClient.readContract({
            address: currency,
            abi: erc20Abi,
            functionName: "allowance",
            args: [this.account, spender],
          }),
        (value) => value >= amount,
      );
      if (confirmed < amount) {
        throw new SlotsError(
          "withPayment",
          "Approval confirmed but on-chain allowance is still insufficient after retries",
        );
      }
    }

    return this.wallet.writeContract({
      address: call.to,
      abi: call.abi,
      functionName: call.functionName,
      args: call.args as any,
      account: this.account,
      chain: this.chain,
    });
  }

  /** Poll `check` every `delayMs` until it returns a truthy value or `maxAttempts` is exhausted. */
  private async pollUntil<T>(
    check: () => Promise<T>,
    predicate: (value: T) => boolean,
    { maxAttempts = 10, delayMs = 500 } = {},
  ): Promise<T> {
    let value: T = await check();
    for (let i = 1; i < maxAttempts && !predicate(value); i++) {
      await new Promise((res) => setTimeout(res, delayMs));
      value = await check();
    }
    return value;
  }
}

export function createSlotsClient(config: SlotsClientConfig): SlotsClient {
  return new SlotsClient(config);
}
