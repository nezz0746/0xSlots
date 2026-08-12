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
import * as Gen from "./generated/graphql";
import { getSdk } from "./generated/graphql";
import { FeedModuleClient } from "./modules/feed";
import { MetadataModuleClient } from "./modules/metadata";
import { isNativeCurrency } from "./native";

// ─── Indexer meta ─────────────────────────────────────────────────────────────

/**
 * Ponder's indexing status, keyed by chain name.
 *
 * Replaces the subgraph's `_meta { block { number hash timestamp } hasIndexingErrors }`,
 * which has no equivalent here: ponder halts on an indexing error rather than
 * serving stale data behind a flag, so "are there errors" is answered by the
 * endpoint being down, not by a boolean.
 */
const META_QUERY = gql`
  query GetMeta {
    _meta {
      status
    }
  }
`;

export interface ChainStatus {
  id: number;
  block: { number: number; timestamp: number } | null;
}

export interface IndexerMeta {
  _meta: { status: Record<string, ChainStatus> | null };
}

// ─── Chain Config ─────────────────────────────────────────────────────────────

export enum SlotsChain {
  BASE = 8453,
  BASE_SEPOLIA = 84532,
  /** Local anvil — see `pnpm dev:local` at the repo root. */
  ANVIL = 31337,
}

/**
 * The default read endpoint.
 *
 * ONE url for every chain, which is the shape change that matters most in the
 * move off the subgraph: a subgraph is one deployment per network, so the SDK
 * used to carry a `Record<SlotsChain, string>` and pick by chain. Ponder indexes
 * every chain into one database, so the chain is a `where: { chainId }` filter
 * on the query instead of a property of the endpoint — see `withChain`.
 */
export const DEFAULT_API_URL =
  "https://0xslots-production.up.railway.app/graphql";

/** The local indexer `pnpm dev:local` starts, for chain 31337. */
export const LOCAL_API_URL = "http://localhost:42069/graphql";

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
  /**
   * Which chain's rows to read.
   *
   * No longer selects an endpoint — one ponder deployment holds every chain —
   * so this is a filter applied to queries, not a routing decision.
   */
  chainId: SlotsChain;
  factoryAddress?: Address;
  publicClient?: PublicClient;
  walletClient?: WalletClient;
  /** Ponder GraphQL endpoint. Defaults to {@link DEFAULT_API_URL}. */
  apiUrl?: string;
  /**
   * Extra request headers.
   *
   * There is no `apiKey` shorthand: ponder serves the GraphQL API without
   * authentication, so a key bought nothing and — passed through
   * `NEXT_PUBLIC_*` — shipped a credential to the browser for no reason. The
   * shorthand was inherited from The Graph's gateway, which does reject
   * unauthenticated queries.
   *
   * Put a deployment behind auth yourself and the header still goes here:
   * `headers: { Authorization: \`Bearer ${token}\` }`.
   */
  headers?: Record<string, string>;
}

// ─── Client ───────────────────────────────────────────────────────────────────

/**
 * Client for reading and writing 0xSlots protocol data.
 *
 * Reads come from a Ponder GraphQL API (via graphql-request); one deployment
 * serves every chain, so `chainId` filters rows rather than choosing a host.
 * Writes go through a viem WalletClient and handle ERC-20 approvals automatically.
 *
 * @example
 * ```ts
 * const client = new SlotsClient({
 *   chainId: SlotsChain.BASE,
 *   publicClient,
 *   walletClient,
 * });
 * const { items, totalCount } = (await client.getSlots({ limit: 10 })).slots;
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

    // One endpoint for every chain — the chain is a query filter now, not a
    // routing decision, so there is nothing to resolve per chainId.
    const url = config.apiUrl || DEFAULT_API_URL;

    this.gqlClient = new GraphQLClient(url, { headers: { ...config.headers } });
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
  // READ — Indexer queries
  //
  // Every list method merges `chainId` into `where` before sending. One ponder
  // deployment holds every chain, so an unfiltered query returns base and
  // base-sepolia rows interleaved — a caller who forgets the filter gets a
  // plausible-looking result that is quietly wrong. Passing `chainId`
  // explicitly in `where` still wins, for the rare cross-chain read.
  //
  // Results are `{ items, totalCount, pageInfo }`. Pagination is `limit` with
  // either `offset` or the `after`/`before` cursors from `pageInfo`; the
  // subgraph's `first`/`skip` are gone, as is its `block:` time-travel argument,
  // which has no ponder equivalent.
  // ═══════════════════════════════════════════════════════════════════════════

  /** Merge the client's chain into a query's `where`, without overriding it. */
  private withChain<V extends { where?: unknown } | undefined>(vars?: V): V {
    const where = (vars as { where?: Record<string, unknown> } | undefined)
      ?.where;
    return {
      ...(vars ?? {}),
      where: { chainId: this.chainId, ...(where ?? {}) },
    } as V;
  }

  // Slot queries

  /** Fetch a paginated page of slots. */
  getSlots(variables?: Gen.GetSlotsQueryVariables) {
    return this.query("getSlots", () =>
      this.sdk.GetSlots(this.withChain(variables)),
    );
  }
  /** Fetch a single slot by its address. */
  getSlot(variables: Gen.GetSlotQueryVariables) {
    return this.query("getSlot", () => this.sdk.GetSlot(variables));
  }
  /** Slots paying out to a given recipient. */
  getSlotsByRecipient(variables: Gen.GetSlotsByRecipientQueryVariables) {
    return this.query("getSlotsByRecipient", () =>
      this.sdk.GetSlotsByRecipient({ chainId: this.chainId, ...variables }),
    );
  }
  /** Slots currently occupied by a given address. */
  getSlotsByOccupant(variables: Gen.GetSlotsByOccupantQueryVariables) {
    return this.query("getSlotsByOccupant", () =>
      this.sdk.GetSlotsByOccupant({ chainId: this.chainId, ...variables }),
    );
  }
  /** Slots with their current metadata row joined. */
  getSlotsWithMetadata(variables?: Gen.GetSlotsWithMetadataQueryVariables) {
    return this.query("getSlotsWithMetadata", () =>
      this.sdk.GetSlotsWithMetadata(this.withChain(variables)),
    );
  }

  // Factory queries

  /** Factory row for this chain. */
  getFactory() {
    return this.query("getFactory", () =>
      this.sdk.GetFactory({ chainId: this.chainId }),
    );
  }
  /** Registered utility modules. */
  getModules(variables?: Gen.GetModulesQueryVariables) {
    return this.query("getModules", () =>
      this.sdk.GetModules(this.withChain(variables)),
    );
  }

  // Event queries

  getSlotDeployedEvents(variables?: Gen.GetSlotDeployedEventsQueryVariables) {
    return this.query("getSlotDeployedEvents", () =>
      this.sdk.GetSlotDeployedEvents(this.withChain(variables)),
    );
  }
  getBoughtEvents(variables?: Gen.GetBoughtEventsQueryVariables) {
    return this.query("getBoughtEvents", () =>
      this.sdk.GetBoughtEvents(this.withChain(variables)),
    );
  }
  getReleasedEvents(variables?: Gen.GetReleasedEventsQueryVariables) {
    return this.query("getReleasedEvents", () =>
      this.sdk.GetReleasedEvents(this.withChain(variables)),
    );
  }
  getLiquidatedEvents(variables?: Gen.GetLiquidatedEventsQueryVariables) {
    return this.query("getLiquidatedEvents", () =>
      this.sdk.GetLiquidatedEvents(this.withChain(variables)),
    );
  }
  getPriceUpdatedEvents(variables?: Gen.GetPriceUpdatedEventsQueryVariables) {
    return this.query("getPriceUpdatedEvents", () =>
      this.sdk.GetPriceUpdatedEvents(this.withChain(variables)),
    );
  }
  getDepositedEvents(variables?: Gen.GetDepositedEventsQueryVariables) {
    return this.query("getDepositedEvents", () =>
      this.sdk.GetDepositedEvents(this.withChain(variables)),
    );
  }
  getWithdrawnEvents(variables?: Gen.GetWithdrawnEventsQueryVariables) {
    return this.query("getWithdrawnEvents", () =>
      this.sdk.GetWithdrawnEvents(this.withChain(variables)),
    );
  }
  getSettledEvents(variables?: Gen.GetSettledEventsQueryVariables) {
    return this.query("getSettledEvents", () =>
      this.sdk.GetSettledEvents(this.withChain(variables)),
    );
  }
  /**
   * Per-address tax attribution.
   *
   * `taxPaid` is the figure that means money actually moved — it is capped by
   * the remaining deposit, so it falls short of `taxOwed` for an occupant going
   * insolvent. Reconstructing contributions from price x time over-credits.
   */
  getTaxPaidEvents(variables?: Gen.GetTaxPaidEventsQueryVariables) {
    return this.query("getTaxPaidEvents", () =>
      this.sdk.GetTaxPaidEvents(this.withChain(variables)),
    );
  }
  getTaxCollectedEvents(variables?: Gen.GetTaxCollectedEventsQueryVariables) {
    return this.query("getTaxCollectedEvents", () =>
      this.sdk.GetTaxCollectedEvents(this.withChain(variables)),
    );
  }
  /** Every event type for one slot, in a single round trip. */
  getSlotActivity(variables: Gen.GetSlotActivityQueryVariables) {
    return this.query("getSlotActivity", () =>
      this.sdk.GetSlotActivity(variables),
    );
  }
  /** Recent activity across all slots. Caller merges and sorts by timestamp. */
  getRecentEvents(variables?: Gen.GetRecentEventsQueryVariables) {
    return this.query("getRecentEvents", () =>
      this.sdk.GetRecentEvents({ chainId: this.chainId, ...variables }),
    );
  }

  // Refunds and operators

  /**
   * Outstanding refund credits. A non-zero `balance` means the slot owes
   * someone money — a push that failed and was credited for later claim, which
   * is what keeps liquidation unconditional.
   */
  getSlotRefunds(variables?: Gen.GetSlotRefundsQueryVariables) {
    return this.query("getSlotRefunds", () =>
      this.sdk.GetSlotRefunds(this.withChain(variables)),
    );
  }
  /** Operator approvals. An operator may selfAssess and topUp, never withdraw. */
  getSlotOperators(variables?: Gen.GetSlotOperatorsQueryVariables) {
    return this.query("getSlotOperators", () =>
      this.sdk.GetSlotOperators(this.withChain(variables)),
    );
  }

  // Account queries

  getAccount(variables: Gen.GetAccountQueryVariables) {
    return this.query("getAccount", () => this.sdk.GetAccount(variables));
  }
  getAccounts(variables?: Gen.GetAccountsQueryVariables) {
    return this.query("getAccounts", () => this.sdk.GetAccounts(variables));
  }
  /** An account plus its slots, as recipient and as occupant. */
  getAccountWithSlots(variables: Gen.GetAccountWithSlotsQueryVariables) {
    return this.query("getAccountWithSlots", () =>
      this.sdk.GetAccountWithSlots({ chainId: this.chainId, ...variables }),
    );
  }

  // AccountSlot queries

  /** Composite key — the subgraph's synthetic "{account}-{slot}" id is gone. */
  getAccountSlot(variables: Gen.GetAccountSlotQueryVariables) {
    return this.query("getAccountSlot", () =>
      this.sdk.GetAccountSlot(variables),
    );
  }
  getAccountSlots(variables?: Gen.GetAccountSlotsQueryVariables) {
    return this.query("getAccountSlots", () =>
      this.sdk.GetAccountSlots(this.withChain(variables)),
    );
  }

  // Meta

  /**
   * Indexing status per chain.
   *
   * The subgraph's `hasIndexingErrors` has no counterpart: ponder stops rather
   * than serving stale rows behind a flag, so an erroring indexer shows up as a
   * failed request, not a `true` here.
   */
  getMeta(): Promise<IndexerMeta> {
    return this.query("getMeta", () =>
      this.gqlClient.request<IndexerMeta>(META_QUERY),
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
