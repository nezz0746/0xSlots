import {
  slotCollectiveAbi,
  slotCollectiveFactoryAbi,
  slotCollectiveFactoryAddress,
} from "@0xslots/contracts/slots";
import {
  type Address,
  type Chain,
  encodeFunctionData,
  type Hash,
  type Hex,
  keccak256,
  type PublicClient,
  toBytes,
  type WalletClient,
  zeroAddress,
  zeroHash,
} from "viem";
import { SlotsError } from "../errors";
import type { HookOffer, HookTerms } from "./client";
import { NO_HOOK } from "./client";

/**
 * A collective's payout split. `totalAllocation` is derived from the
 * allocations, so it cannot disagree with them.
 */
export interface CollectiveSplit {
  recipients: readonly Address[];
  allocations: readonly bigint[];
  /** Share of a distribution paid to whoever calls it, where 1_000_000 is 100%. At most 65_535. Default 0. */
  distributionIncentive?: number;
}

/** Who governs a new collective. Only `admin` is required. */
export interface CollectiveRoles {
  admin: Address;
  taxManagers?: readonly Address[];
  hookManagers?: readonly Address[];
  splitManagers?: readonly Address[];
}

export interface CreateCollectiveParams {
  split: CollectiveSplit;
  roles: CollectiveRoles;
}

/** How the Splits contracts name native ETH, for {@link CollectivesClient.distribute}. */
export const SPLITS_NATIVE_TOKEN: Address = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

/** The roles a collective recognises, by name. */
export type CollectiveRole = "admin" | "tax" | "hook" | "split";

/** The on-chain role ids. `admin` is OpenZeppelin's `DEFAULT_ADMIN_ROLE`. */
export const COLLECTIVE_ROLES: Record<CollectiveRole, Hex> = {
  admin: zeroHash,
  tax: keccak256(toBytes("TAX_MANAGER_ROLE")),
  hook: keccak256(toBytes("POLICY_MANAGER_ROLE")),
  split: keccak256(toBytes("SPLIT_MANAGER_ROLE")),
};

export interface CollectivesClientConfig {
  publicClient?: PublicClient;
  walletClient?: WalletClient;
  /** The `SlotCollectiveFactory`. Defaults to the one deployed on the wallet's chain. */
  factoryAddress?: Address;
}

/** Throw on the splits `SlotCollective` refuses, before spending gas. */
export function assertCollectiveSplit(split: CollectiveSplit, where: string): void {
  if (split.recipients.length === 0)
    throw new SlotsError(where, "a split needs at least one recipient");
  if (split.recipients.length !== split.allocations.length)
    throw new SlotsError(where, "recipients and allocations differ in length");
  if (split.recipients.some((r) => r === zeroAddress))
    throw new SlotsError(where, "a recipient must not be the zero address");
  if (split.allocations.reduce((a, b) => a + b, 0n) === 0n)
    throw new SlotsError(where, "allocations must not sum to zero");
  const incentive = split.distributionIncentive ?? 0;
  if (!Number.isInteger(incentive) || incentive < 0 || incentive > 65_535)
    throw new SlotsError(where, "distributionIncentive must fit in uint16");
}

function encodeSplit(split: CollectiveSplit) {
  return {
    recipients: [...split.recipients],
    allocations: [...split.allocations],
    totalAllocation: split.allocations.reduce((a, b) => a + b, 0n),
    distributionIncentive: split.distributionIncentive ?? 0,
  };
}

const many = (slots: Address | readonly Address[]): readonly Address[] =>
  typeof slots === "string" ? [slots] : slots;

/**
 * Reads and writes for slot collectives: a payout split that is also the
 * manager of the slots that name it.
 *
 * Every governance write takes one slot or many. One slot calls the single
 * relay; several call its `*Batch` form in one transaction.
 */
export class CollectivesClient {
  private readonly _publicClient?: PublicClient;
  private readonly _walletClient?: WalletClient;
  private readonly _factory?: Address;

  constructor(config: CollectivesClientConfig) {
    this._publicClient = config.publicClient;
    this._walletClient = config.walletClient;
    this._factory = config.factoryAddress;
  }

  private get publicClient(): PublicClient {
    if (!this._publicClient)
      throw new SlotsError("CollectivesClient", "No publicClient provided");
    return this._publicClient;
  }

  private get wallet(): WalletClient {
    if (!this._walletClient)
      throw new SlotsError("CollectivesClient", "No walletClient provided");
    return this._walletClient;
  }

  private get chain(): Chain {
    const chain = this.wallet.chain;
    if (!chain)
      throw new SlotsError("CollectivesClient", "WalletClient must have a chain");
    return chain;
  }

  private get account(): Address {
    const account = this.wallet.account;
    if (!account)
      throw new SlotsError("CollectivesClient", "WalletClient must have an account");
    return account.address;
  }

  private get factory(): Address {
    const chainId = this._walletClient?.chain?.id ?? this._publicClient?.chain?.id;
    const factory =
      this._factory ?? (chainId === undefined ? undefined : slotCollectiveFactoryAddress[chainId]);
    if (!factory)
      throw new SlotsError(
        "CollectivesClient",
        "No factoryAddress provided or deployed on this chain",
      );
    return factory;
  }

  private write(
    collective: Address,
    functionName: string,
    args: readonly unknown[],
  ): Promise<Hash> {
    return this.wallet.writeContract({
      address: collective,
      abi: slotCollectiveAbi,
      functionName,
      args,
      account: this.account,
      chain: this.chain,
    } as never);
  }

  private read<T>(collective: Address, functionName: string, args: readonly unknown[] = []) {
    return this.publicClient.readContract({
      address: collective,
      abi: slotCollectiveAbi,
      functionName,
      args,
    } as never) as Promise<T>;
  }

  // ─── Factory ────────────────────────────────────────────────────────────────

  /** Deploy a collective. Permissionless. */
  async createCollective(params: CreateCollectiveParams): Promise<Hash> {
    const args = this.createArgs(params);
    return this.wallet.writeContract({
      address: this.factory,
      abi: slotCollectiveFactoryAbi,
      functionName: "createCollective",
      args,
      account: this.account,
      chain: this.chain,
    });
  }

  /** The address {@link createCollective} would deploy, without sending anything. */
  async simulateCreateCollective(params: CreateCollectiveParams): Promise<Address> {
    const args = this.createArgs(params);
    const { result } = await this.publicClient.simulateContract({
      address: this.factory,
      abi: slotCollectiveFactoryAbi,
      functionName: "createCollective",
      args,
      account: this.account,
    });
    return result;
  }

  private createArgs(params: CreateCollectiveParams) {
    assertCollectiveSplit(params.split, "createCollective");
    if (params.roles.admin === zeroAddress)
      throw new SlotsError("createCollective", "admin must not be the zero address");
    return [
      encodeSplit(params.split),
      {
        admin: params.roles.admin,
        taxManagers: [...(params.roles.taxManagers ?? [])],
        hookManagers: [...(params.roles.hookManagers ?? [])],
        splitManagers: [...(params.roles.splitManagers ?? [])],
      },
    ] as const;
  }

  /** How many collectives the factory has deployed. */
  collectiveCount(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.factory,
      abi: slotCollectiveFactoryAbi,
      functionName: "collectiveCount",
    });
  }

  /** The `index`-th collective the factory deployed. */
  collectiveAt(index: bigint): Promise<Address> {
    return this.publicClient.readContract({
      address: this.factory,
      abi: slotCollectiveFactoryAbi,
      functionName: "collectives",
      args: [index],
    });
  }

  // ─── Governance: terms on managed slots ─────────────────────────────────────

  /** Queue a new tax rate on slots this collective manages. Tax managers or admin. */
  async proposeTax(
    collective: Address,
    slots: Address | readonly Address[],
    taxRateBps: number,
  ): Promise<Hash> {
    const list = many(slots);
    this.assertSlots(list, "proposeTax");
    if (!Number.isInteger(taxRateBps) || taxRateBps <= 0 || taxRateBps > 10_000)
      throw new SlotsError("proposeTax", "taxRateBps must be 1..10000");
    return list.length === 1
      ? this.write(collective, "proposeTax", [list[0], taxRateBps])
      : this.write(collective, "proposeTaxBatch", [list, taxRateBps]);
  }

  /**
   * Queue a new hook on slots this collective manages. Hook managers or admin.
   * `NO_HOOK` detaches.
   */
  async proposeHook(
    collective: Address,
    slots: Address | readonly Address[],
    hookTerms: HookTerms = NO_HOOK,
  ): Promise<Hash> {
    const list = many(slots);
    this.assertSlots(list, "proposeHook");
    return list.length === 1
      ? this.write(collective, "proposeHook", [list[0], hookTerms])
      : this.write(collective, "proposeHookBatch", [list, hookTerms]);
  }

  /**
   * Accept the attached hook's current offer on `slot`. Hook managers or admin.
   * `expected` is the offer reviewed; see `SlotsClient.hookOfferStatus`.
   */
  acceptHookOffer(collective: Address, slot: Address, expected: HookOffer): Promise<Hash> {
    return this.write(collective, "acceptHookOffer", [slot, expected]);
  }

  /** Drop a queued tax change. */
  cancelTaxProposal(collective: Address, slots: Address | readonly Address[]): Promise<Hash> {
    return this.cancel(collective, slots, "cancelTaxProposal");
  }

  /** Drop a queued hook change. */
  cancelHookProposal(collective: Address, slots: Address | readonly Address[]): Promise<Hash> {
    return this.cancel(collective, slots, "cancelHookProposal");
  }

  /** Drop everything queued. Admin only. */
  cancelAllProposals(collective: Address, slots: Address | readonly Address[]): Promise<Hash> {
    return this.cancel(collective, slots, "cancelAllProposals");
  }

  private async cancel(
    collective: Address,
    slots: Address | readonly Address[],
    fn: string,
  ): Promise<Hash> {
    const list = many(slots);
    this.assertSlots(list, fn);
    return list.length === 1
      ? this.write(collective, fn, [list[0]])
      : this.write(collective, `${fn}Batch`, [list]);
  }

  private assertSlots(slots: readonly Address[], where: string): void {
    if (slots.length === 0) throw new SlotsError(where, "pass at least one slot");
  }

  // ─── Money ──────────────────────────────────────────────────────────────────

  /** Pull collected tax from managed slots into the collective. Anyone may call. */
  async sweep(collective: Address, slots: readonly Address[]): Promise<Hash> {
    this.assertSlots(slots, "sweep");
    return this.write(collective, "sweep", [slots]);
  }

  /**
   * Pay the collective's balance of `token` out along `split`, which must be
   * the split in force. Native ETH is {@link SPLITS_NATIVE_TOKEN}. Anyone may
   * call.
   */
  distribute(
    collective: Address,
    split: CollectiveSplit,
    token: Address,
    distributor: Address = this.account,
  ): Promise<Hash> {
    return this.write(collective, "distribute", [encodeSplit(split), token, distributor]);
  }

  /**
   * Replace the split. Split managers or admin.
   *
   * Pays out every listed token under `current` first, so rent already
   * collected for the old recipients is not paid to the new ones. Native ETH
   * is always included; list every currency the collective's slots pay in.
   * Reverts while paused.
   */
  async setSplit(
    collective: Address,
    current: CollectiveSplit,
    next: CollectiveSplit,
    tokens: readonly Address[] = [],
  ): Promise<Hash> {
    assertCollectiveSplit(next, "setSplit");
    const all = [...new Set<Address>([SPLITS_NATIVE_TOKEN, ...tokens])];
    return this.write(collective, "setSplit", [encodeSplit(current), encodeSplit(next), all]);
  }

  /** Pause or resume distributions. Split managers or admin. */
  setPaused(collective: Address, paused: boolean): Promise<Hash> {
    return this.write(collective, "setPaused", [paused]);
  }

  /**
   * Run several collective calls in one transaction, through the collective's
   * `multicall`. Each call passes its own role check; if one reverts, all do.
   *
   * @example
   * ```ts
   * await collectives.batch(collective, [
   *   { functionName: "proposeTax", args: [slot, 750] },
   *   { functionName: "sweep", args: [[slot]] },
   * ]);
   * ```
   */
  async batch(
    collective: Address,
    calls: readonly { functionName: string; args: readonly unknown[] }[],
  ): Promise<Hash> {
    if (calls.length === 0) throw new SlotsError("batch", "pass at least one call");
    const data = calls.map((c) =>
      encodeFunctionData({ abi: slotCollectiveAbi, functionName: c.functionName, args: c.args } as never),
    );
    return this.write(collective, "multicall", [data]);
  }

  // ─── Roles and state ────────────────────────────────────────────────────────

  hasRole(collective: Address, role: CollectiveRole, account: Address): Promise<boolean> {
    return this.read<boolean>(collective, "hasRole", [COLLECTIVE_ROLES[role], account]);
  }

  grantRole(collective: Address, role: CollectiveRole, account: Address): Promise<Hash> {
    return this.write(collective, "grantRole", [COLLECTIVE_ROLES[role], account]);
  }

  revokeRole(collective: Address, role: CollectiveRole, account: Address): Promise<Hash> {
    return this.write(collective, "revokeRole", [COLLECTIVE_ROLES[role], account]);
  }

  /** The hash of the split in force. */
  splitHash(collective: Address): Promise<Hex> {
    return this.read<Hex>(collective, "splitHash");
  }

  paused(collective: Address): Promise<boolean> {
    return this.read<boolean>(collective, "paused");
  }
}

export function createCollectivesClient(config: CollectivesClientConfig): CollectivesClient {
  return new CollectivesClient(config);
}
