import {
  compositeHookAbi,
  minimumTenureHookAbi,
  slotAbi,
  slotFactoryAbi,
} from "@0xslots/contracts/slots";
import {
  type Address,
  type Chain,
  erc20Abi,
  type Hash,
  type PublicClient,
  type WalletClient,
  zeroAddress,
} from "viem";
import { SlotsError } from "../errors";
import { isNativeCurrency } from "../native";

// ─── Protocol constants ───────────────────────────────────────────────────────
//
// Mirrored from SlotStorage.sol. Duplicated rather than read, because every one
// of them is a compile-time constant on-chain: an RPC round trip could only ever
// return the same number, and a client that has to be online to tell you your
// tax is out of range is a worse client.

/** Ceiling on a self-assessed price — `type(uint128).max`. */
export const MAX_PRICE = 2n ** 128n - 1n;
/** Ceiling on the monthly tax rate, in basis points. */
export const MAX_TAX_BPS = 10_000n;
export const BASIS_POINTS = 10_000n;
/** The tax period. Basis points are per 30 days, not per year. */
export const MONTH_SECONDS = 30n * 24n * 60n * 60n;

// ─── Creation ─────────────────────────────────────────────────────────────────

/**
 * Everything a slot needs at birth. Mirrors `SlotInit` in SlotAccounting.sol.
 *
 * Two fields are load-bearing in a way the types cannot express, both checked
 * in `initialize`:
 *
 * - `manager` is required exactly when something is mutable and FORBIDDEN
 *   otherwise. "Immutable" is a fact about the slot, not a promise about
 *   somebody's restraint — so a manager on an all-immutable slot reverts rather
 *   than sitting there looking authoritative. {@link assertSlotInit} checks this
 *   before you spend gas finding out.
 * - `taxPercentage` may not be zero. A zero-tax slot would accrue nothing, so
 *   nobody could ever be liquidated off it.
 */
export interface SlotInit {
  /** Where tax goes. Never zero. */
  recipient: Address;
  /** The token tax and price are denominated in. {@link zeroAddress} = native ETH. */
  currency: Address;
  /** May change what this slot allows. Zero on a fully immutable slot. */
  manager: Address;
  /** The single extension point. Zero for none. */
  hook: Address;
  /** Basis points per 30 days. 1..10000. */
  taxPercentage: bigint;
  /** Minimum runway, in seconds, a buyer must fund. Zero means no minimum. */
  minDepositSeconds: bigint;
  mutableTax: boolean;
  mutableHook: boolean;
}

/**
 * Build the exact tuple the factory expects.
 *
 * viem encodes a struct argument BY COMPONENT NAME, so a stray or misspelled key
 * encodes a zero for the field it was meant to fill and says nothing about it.
 * Listing the eight fields here makes a missing one a type error in this file
 * rather than a zero address on-chain — which is how the previous SDK and its
 * checked-in ABIs once drifted together, agreeing with each other and
 * disagreeing with the chain.
 */
function encodeSlotInit(init: SlotInit) {
  return {
    recipient: init.recipient,
    currency: init.currency,
    manager: init.manager,
    hook: init.hook,
    taxPercentage: init.taxPercentage,
    minDepositSeconds: init.minDepositSeconds,
    mutableTax: init.mutableTax,
    mutableHook: init.mutableHook,
  } as const;
}

/** Throw on the initialisations `Slot.initialize` refuses, before spending gas. */
export function assertSlotInit(init: SlotInit): void {
  if (init.recipient === zeroAddress)
    throw new SlotsError("createSlot", "recipient must not be the zero address");
  if (init.taxPercentage <= 0n || init.taxPercentage > MAX_TAX_BPS)
    throw new SlotsError(
      "createSlot",
      `taxPercentage must be 1..${MAX_TAX_BPS} basis points per 30 days`,
    );

  const mutable = init.mutableTax || init.mutableHook;
  if (mutable && init.manager === zeroAddress)
    throw new SlotsError(
      "createSlot",
      "a slot with mutableTax or mutableHook needs a manager",
    );
  if (!mutable && init.manager !== zeroAddress)
    throw new SlotsError(
      "createSlot",
      "a fully immutable slot must have no manager — the zero address is what makes it immutable",
    );
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * A hook's declared subscriptions, as the slot snapshotted them when it was
 * attached — not as the hook reports them today.
 *
 * `before` decides and may refuse; `after` records and cannot. That is the whole
 * interface. A flag being false means the callback is skipped entirely, so an
 * `afterBuy` that never fires is usually a hook that forgot to declare it.
 */
export interface HookFlags {
  beforeBuy: boolean;
  beforeSell: boolean;
  beforeSelfAssess: boolean;
  afterBuy: boolean;
  afterSell: boolean;
  afterRelease: boolean;
  afterLiquidate: boolean;
  afterSettle: boolean;
}

/** Terms the manager has queued, landing at the next occupancy transition. */
export interface PendingTerms {
  taxPercentage: bigint;
  hook: Address;
  hasTax: boolean;
  hasHook: boolean;
  proposedAt: bigint;
  /** True when nothing is queued — both `hasTax` and `hasHook` are false. */
  isEmpty: boolean;
}

/**
 * A change of terms to queue.
 *
 * Presence is the signal, not truthiness: `{ hook: zeroAddress }` means "detach
 * the hook", which is a real intention and the exact case a `if (params.hook)`
 * check would silently drop.
 */
export interface ProposeTermsParams {
  /** Basis points per 30 days. Omit to leave the tax alone. */
  taxPercentage?: bigint;
  /** The new hook, or {@link zeroAddress} to detach. Omit to leave it alone. */
  hook?: Address;
}

// ─── Signed sell orders ───────────────────────────────────────────────────────

/**
 * Terms a buyer signs so an occupant may sell them the slot.
 *
 * The occupant chooses nothing here. `price` AND `deposit` are both in the
 * digest, so the split is fixed by the party whose money it is — a buyer
 * approving exactly `price + deposit` could otherwise be sold `price + deposit,
 * 0`, the escrow half rebooked as seller proceeds and the buyer seated insolvent
 * on arrival.
 */
export interface SellOrder {
  slot: Address;
  buyer: Address;
  price: bigint;
  deposit: bigint;
  nonce: bigint;
  deadline: bigint;
}

/** EIP-712 types. Must match `SlotOrders.SELL_ORDER_TYPEHASH`. */
export const SELL_ORDER_TYPES = {
  SellOrder: [
    { name: "slot", type: "address" },
    { name: "buyer", type: "address" },
    { name: "price", type: "uint256" },
    { name: "deposit", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint64" },
  ],
} as const;

/** EIP-712 domain name. `keccak256("Slots")` in `SlotOrders._domainSeparator`. */
export const SELL_ORDER_DOMAIN_NAME = "Slots";
export const SELL_ORDER_DOMAIN_VERSION = "1";

export interface SignSellOrderParams {
  price: bigint;
  deposit: bigint;
  /** Unix seconds. The slot compares against `block.timestamp`. */
  deadline: bigint;
  /** Overrides the on-chain read. Pass one to sign several orders at once. */
  nonce?: bigint;
}

export interface SignedSellOrder {
  order: SellOrder;
  signature: `0x${string}`;
}

// ─── Params ───────────────────────────────────────────────────────────────────

export interface BuyParams {
  slot: Address;
  /**
   * Who gets SEATED. Deliberately separate from who pays: `msg.sender` funds the
   * buy, `account` occupies the slot, and no protocol permission connects them.
   * That is what lets a contract acquire a slot on someone's behalf.
   */
  account: Address;
  depositAmount: bigint;
  selfAssessedPrice: bigint;
}

/** Everything a slot will tell you about itself, in one call. */
export interface SlotState {
  occupant: Address;
  price: bigint;
  deposit: bigint;
  taxOwed: bigint;
  isVacant: boolean;
  isInsolvent: boolean;
  /** `2^256 - 1` when the occupant can never run dry, or the slot is vacant. */
  secondsUntilLiquidation: bigint;
  currency: Address;
  taxPercentage: bigint;
  minDepositSeconds: bigint;
  recipient: Address;
  manager: Address;
  hook: Address;
  hookFlags: HookFlags;
  pending: PendingTerms;
  /**
   * Which terms the manager may propose a change to.
   *
   * Part of the state rather than something a caller reads separately, because
   * these two decide whether `manager` is meaningful at all: a slot with both
   * false HAS no manager, and one with either true is required to have one.
   */
  mutableTax: boolean;
  mutableHook: boolean;
  /** Unix seconds. Zero when vacant. What a tenure window is measured from. */
  occupiedSince: bigint;
  /**
   * Bumped on every seating. Operator approvals are keyed to it, so a change
   * here silently voids every one of them.
   */
  tenureId: bigint;
}

export interface SlotsClientConfig {
  /** The hook-protocol `SlotFactory`. Only `createSlot` needs it. */
  factoryAddress?: Address;
  publicClient?: PublicClient;
  walletClient?: WalletClient;
}

// ─── Client ───────────────────────────────────────────────────────────────────

/**
 * `slotAbi` plus every hook error this package can name.
 *
 * A hook's veto reverts with the HOOK'S error, and viem decodes an error only
 * if it is in the ABI it was handed — so simulating against `slotAbi` alone
 * yields a bare four-byte selector, which is a hex string nobody can act on.
 * Extra error entries cost nothing: the function being called is still resolved
 * by name out of `slotAbi`.
 *
 * A hook this package has never heard of still degrades to the selector. That
 * is the honest floor for an open extension point, and it is strictly more than
 * a mined revert with no reason at all.
 */
const SIMULATION_ABI = [
  ...slotAbi,
  ...minimumTenureHookAbi.filter((entry) => entry.type === "error"),
  ...compositeHookAbi.filter((entry) => entry.type === "error"),
] as const;

/**
 * Client for the hook-based Slots protocol.
 *
 * Reads go straight to the chain. There is no indexer namespace here on purpose:
 * the ponder deployment indexes the previous protocol, and a read method that
 * silently returned rows from the wrong one would be worse than not having it.
 *
 * @example
 * ```ts
 * const client = new SlotsClient({ factoryAddress, publicClient, walletClient });
 * await client.buy({ slot, account, depositAmount: 10n ** 6n, selfAssessedPrice: 10n ** 7n });
 * ```
 */
export class SlotsClient {
  private readonly _publicClient?: PublicClient;
  private readonly _walletClient?: WalletClient;
  private readonly _factory?: Address;

  constructor(config: SlotsClientConfig) {
    this._publicClient = config.publicClient;
    this._walletClient = config.walletClient;
    this._factory = config.factoryAddress;
  }

  // ─── Accessors ──────────────────────────────────────────────────────────────

  private get publicClient(): PublicClient {
    if (!this._publicClient)
      throw new SlotsError("SlotsClient", "No publicClient provided");
    return this._publicClient;
  }

  private get wallet(): WalletClient {
    if (!this._walletClient)
      throw new SlotsError("SlotsClient", "No walletClient provided");
    return this._walletClient;
  }

  private get factory(): Address {
    if (!this._factory)
      throw new SlotsError("SlotsClient", "No factoryAddress provided");
    return this._factory;
  }

  private get account(): Address {
    const account = this.wallet.account;
    if (!account)
      throw new SlotsError("SlotsClient", "WalletClient must have an account");
    return account.address;
  }

  private get chain(): Chain {
    const chain = this.wallet.chain;
    if (!chain)
      throw new SlotsError("SlotsClient", "WalletClient must have a chain");
    return chain;
  }

  // Guarded writes below are `async` even where nothing is awaited. A method
  // typed `Promise<Hash>` that throws SYNCHRONOUSLY escapes `.catch()` and
  // escapes an un-awaited call, which is exactly how a rejected guard turns into
  // a button that looks alive and does nothing.
  private assertPositive(value: bigint, name: string): void {
    if (value <= 0n) throw new SlotsError(name, `${name} must be > 0`);
  }

  private assertPrice(value: bigint, name: string): void {
    this.assertPositive(value, name);
    if (value > MAX_PRICE)
      throw new SlotsError(name, `${name} must be <= MAX_PRICE (2^128 - 1)`);
  }

  /** Send a write to a slot as the connected account. */
  private write(
    slot: Address,
    functionName: string,
    args: readonly unknown[],
    value?: bigint,
  ): Promise<Hash> {
    return this.wallet.writeContract({
      address: slot,
      abi: slotAbi,
      functionName,
      args,
      ...(value === undefined ? {} : { value }),
      account: this.account,
      chain: this.chain,
    } as never);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // READ
  // ═══════════════════════════════════════════════════════════════════════════

  private read<T>(slot: Address, functionName: string, args?: readonly unknown[]) {
    return this.publicClient.readContract({
      address: slot,
      abi: slotAbi,
      functionName,
      ...(args ? { args } : {}),
    } as never) as Promise<T>;
  }

  /** Who holds the slot right now. {@link zeroAddress} when vacant. */
  occupant(slot: Address): Promise<Address> {
    return this.read<Address>(slot, "occupant");
  }

  /** The occupant's self-assessed price — what anyone may take the slot for. */
  price(slot: Address): Promise<bigint> {
    return this.read<bigint>(slot, "price");
  }

  /** The occupant's escrow. Tax is realised out of this. */
  deposit(slot: Address): Promise<bigint> {
    return this.read<bigint>(slot, "deposit");
  }

  /**
   * Tax accrued since the last settlement. The RAW debt — it may exceed the
   * deposit, and the amount by which it does is what is never collected.
   */
  taxOwed(slot: Address): Promise<bigint> {
    return this.read<bigint>(slot, "taxOwed");
  }

  /** True when the deposit can no longer cover what is owed. */
  isInsolvent(slot: Address): Promise<boolean> {
    return this.read<boolean>(slot, "isInsolvent");
  }

  isVacant(slot: Address): Promise<boolean> {
    return this.read<boolean>(slot, "isVacant");
  }

  /**
   * Seconds until the deposit runs out and {@link liquidate} becomes callable.
   *
   * `2^256 - 1` means never — either the slot is vacant, or the per-second tax
   * rounds to zero at this price.
   */
  secondsUntilLiquidation(slot: Address): Promise<bigint> {
    return this.read<bigint>(slot, "secondsUntilLiquidation");
  }

  /**
   * What {@link buy} will charge for `depositAmount`, straight from the slot.
   *
   * The payment rule is the CONTRACT'S promise now, not this client's
   * inference. Deriving it here meant reimplementing `_buy`'s arithmetic from
   * the outside and staying in step with it forever — and the derivation is
   * only correct because `_vacate()` zeroes `_price`, which nothing external
   * stated. Reading it turns a silent overpay into a mismatch the chain
   * reports.
   */
  quoteBuy(slot: Address, depositAmount: bigint): Promise<bigint> {
    return this.read<bigint>(slot, "quoteBuy", [depositAmount]);
  }

  /**
   * What {@link liquidateAndTake} will charge for `depositAmount`.
   *
   * A different number from {@link quoteBuy}, and the difference is invisible
   * from outside: the eviction vacates the slot before the purchase reads the
   * price, so there is no occupant left to buy out — while `price()` still
   * reads non-zero right up until the call lands.
   *
   * A quote, not a permission. It does not check solvency, and
   * `liquidateAndTake` still reverts unless the occupant is insolvent.
   */
  quoteLiquidateAndTake(slot: Address, depositAmount: bigint): Promise<bigint> {
    return this.read<bigint>(slot, "quoteLiquidateAndTake", [depositAmount]);
  }

  /** The slot's single extension point. {@link zeroAddress} when there is none. */
  hook(slot: Address): Promise<Address> {
    return this.read<Address>(slot, "hook");
  }

  /**
   * The hook's subscriptions AS SNAPSHOTTED when it was attached.
   *
   * Not what the hook's own `hooks()` says today: the snapshot is deliberate, so
   * a hook cannot widen its reach mid-tenure and start spending an occupant's
   * gas on callbacks they never agreed to.
   */
  hookFlags(slot: Address): Promise<HookFlags> {
    return this.read<HookFlags>(slot, "hookFlags");
  }

  /** Terms the manager has queued for the next occupancy transition. */
  async pending(slot: Address): Promise<PendingTerms> {
    const [taxPercentage, hook, hasTax, hasHook, proposedAt] = await this.read<
      readonly [bigint, Address, boolean, boolean, bigint]
    >(slot, "pending");
    return {
      taxPercentage,
      hook,
      hasTax,
      hasHook,
      proposedAt,
      isEmpty: !hasTax && !hasHook,
    };
  }

  /** The token this slot is denominated in. {@link zeroAddress} means native ETH. */
  currency(slot: Address): Promise<Address> {
    return this.read<Address>(slot, "currency");
  }

  /** Basis points per 30 days. */
  taxPercentage(slot: Address): Promise<bigint> {
    return this.read<bigint>(slot, "taxPercentage");
  }

  /** Owed to an address a push payment could not reach. Take it with {@link claim}. */
  withdrawableOf(slot: Address, account?: Address): Promise<bigint> {
    return this.read<bigint>(slot, "withdrawableOf", [account ?? this.account]);
  }

  /**
   * Whether `operator` may reprice on behalf of the CURRENT occupant.
   *
   * Scoped to the tenure, not to the address. An approval is keyed by
   * {@link tenureId} and dies the moment somebody else is seated — so this can
   * go from true to false with no transaction from the operator, the occupant,
   * or anyone acting for them.
   *
   * Always read it live. Accumulating `OperatorSet` events instead produces a
   * list that only ever grows, and it will show a previous occupant's bot as a
   * co-signer on an asking price its owner never approved anybody for.
   */
  isOperator(slot: Address, operator: Address): Promise<boolean> {
    return this.read<boolean>(slot, "isOperator", [operator]);
  }

  /**
   * Bumped every time somebody is seated. The key every operator approval hangs
   * off, and the thing to watch if you cache anything about the occupancy.
   *
   * There is no event for an approval expiring — the tenure ending IS the
   * expiry, and it is silent. A `Bought` log is the only signal that every
   * approval granted under the previous tenure is now void.
   */
  tenureId(slot: Address): Promise<bigint> {
    return this.read<bigint>(slot, "tenureId");
  }

  /** Everything above, in parallel. */
  async slotState(slot: Address): Promise<SlotState> {
    const [
      occupant,
      price,
      deposit,
      taxOwed,
      isVacant,
      isInsolvent,
      secondsUntilLiquidation,
      currency,
      taxPercentage,
      minDepositSeconds,
      recipient,
      manager,
      hook,
      hookFlags,
      pending,
      mutableTax,
      mutableHook,
      occupiedSince,
      tenureId,
    ] = await Promise.all([
      this.occupant(slot),
      this.price(slot),
      this.deposit(slot),
      this.taxOwed(slot),
      this.isVacant(slot),
      this.isInsolvent(slot),
      this.secondsUntilLiquidation(slot),
      this.currency(slot),
      this.taxPercentage(slot),
      this.read<bigint>(slot, "minDepositSeconds"),
      this.read<Address>(slot, "recipient"),
      this.read<Address>(slot, "manager"),
      this.hook(slot),
      this.hookFlags(slot),
      this.pending(slot),
      this.read<boolean>(slot, "mutableTax"),
      this.read<boolean>(slot, "mutableHook"),
      this.read<bigint>(slot, "occupiedSince"),
      this.tenureId(slot),
    ]);

    return {
      occupant,
      price,
      deposit,
      taxOwed,
      isVacant,
      isInsolvent,
      secondsUntilLiquidation,
      currency,
      taxPercentage,
      minDepositSeconds,
      recipient,
      manager,
      hook,
      hookFlags,
      pending,
      mutableTax,
      mutableHook,
      occupiedSince,
      tenureId,
    };
  }

  /**
   * The smallest deposit `minDepositSeconds` requires at `price`.
   *
   * Local arithmetic, matching `_minDepositFor` including its `ceilDiv` — a
   * short window on a low price rounds DOWN to zero, and rounding down is what
   * once made a funding requirement vanish.
   */
  minDepositFor(
    price: bigint,
    taxPercentage: bigint,
    minDepositSeconds: bigint,
  ): bigint {
    if (minDepositSeconds === 0n) return 0n;
    const numerator = price * taxPercentage * minDepositSeconds;
    const denominator = MONTH_SECONDS * BASIS_POINTS;
    return (numerator + denominator - 1n) / denominator;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WRITE — factory
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Deploy a slot.
   *
   * One creation function, and a new parameter goes into {@link SlotInit} rather
   * than into a suffixed second creator — a versioned entry point is a permanent
   * tax on every caller and every indexer, paid to avoid changing one struct.
   */
  async createSlot(init: SlotInit): Promise<Hash> {
    assertSlotInit(init);
    return this.wallet.writeContract({
      address: this.factory,
      abi: slotFactoryAbi,
      functionName: "createSlot",
      args: [encodeSlotInit(init)],
      account: this.account,
      chain: this.chain,
    });
  }

  /**
   * The address `createSlot` would produce, without sending anything.
   *
   * The factory returns the slot address, but a transaction hash does not carry
   * a return value — so read it here first, or pull it out of the `SlotCreated`
   * log afterwards.
   */
  async simulateCreateSlot(init: SlotInit): Promise<Address> {
    assertSlotInit(init);
    const { result } = await this.publicClient.simulateContract({
      address: this.factory,
      abi: slotFactoryAbi,
      functionName: "createSlot",
      args: [encodeSlotInit(init)],
      account: this.account,
    });
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WRITE — occupancy
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Take the slot, naming your own price.
   *
   * `msg.sender` PAYS and `account` is SEATED, and they are deliberately
   * separable — nothing in the protocol requires them to match.
   *
   * The amount moved comes from {@link quoteBuy} rather than from arithmetic
   * here — see that method for why the client no longer derives it.
   */
  async buy(params: BuyParams): Promise<Hash> {
    this.assertPositive(params.depositAmount, "depositAmount");
    this.assertPrice(params.selfAssessedPrice, "selfAssessedPrice");
    if (params.account === zeroAddress)
      throw new SlotsError("buy", "account must not be the zero address");

    const amount = await this.quoteBuy(params.slot, params.depositAmount);

    return this.withPayment(params.slot, amount, {
      functionName: "buy",
      args: [params.account, params.depositAmount, params.selfAssessedPrice],
    });
  }

  /**
   * Ask the chain what {@link buy} would do, WITHOUT sending it.
   *
   * A hook's veto is a `view` revert carrying the hook's own error —
   * `TenureNotElapsed(availableAt)`, not "execution reverted" — and that reason
   * is readable only from a simulation. Sent blind, the same veto arrives as a
   * MINED, reverted transaction whose receipt carries no reason at all, and the
   * best a UI can then say is "it failed", which is the least useful true thing
   * it could say.
   *
   * Throws on refusal, resolves on success. Costs one `eth_call`.
   */
  simulateBuy(params: BuyParams): Promise<void> {
    return this.simulateTake("buy", params);
  }

  /** {@link simulateBuy}, for the eviction path. */
  simulateLiquidateAndTake(params: BuyParams): Promise<void> {
    return this.simulateTake("liquidateAndTake", params);
  }

  /**
   * @dev The quote comes from the slot, exactly as the write path takes it —
   *      a simulation that guessed the payment differently would answer a
   *      question nobody is about to ask.
   */
  private async simulateTake(
    functionName: "buy" | "liquidateAndTake",
    params: BuyParams,
  ): Promise<void> {
    const [currency, amount] = await Promise.all([
      this.currency(params.slot),
      functionName === "buy"
        ? this.quoteBuy(params.slot, params.depositAmount)
        : this.quoteLiquidateAndTake(params.slot, params.depositAmount),
    ]);

    // An ERC-20 buy grants its allowance as part of SENDING, so simulating
    // before that has happened reverts on `ERC20InsufficientAllowance` every
    // time — a confident answer to a question nobody asked, and one that would
    // block a perfectly legal buy. There is nothing to learn from a simulation
    // run against a state the real call will not be made from, so it is skipped
    // rather than reported.
    if (!isNativeCurrency(currency)) {
      const allowance = await this.publicClient.readContract({
        address: currency,
        abi: erc20Abi,
        functionName: "allowance",
        args: [this.account, params.slot],
      });
      if (allowance < amount) return;
    }

    await this.publicClient.simulateContract({
      address: params.slot,
      abi: SIMULATION_ABI,
      functionName,
      args: [params.account, params.depositAmount, params.selfAssessedPrice],
      account: this.account,
      ...(isNativeCurrency(currency) ? { value: amount } : {}),
    } as never);
  }

  /**
   * Hand the slot you occupy to a buyer, on terms that buyer signed.
   *
   * You need no allowance of your own — the buyer's is what gets pulled. Pass
   * the order and signature exactly as they were produced: the slot re-verifies
   * the digest, so altering either fails rather than executing on other terms.
   *
   * ERC-20 only. Payment is pulled on the buyer's allowance and native ETH has
   * none, which is why {@link signSellOrder} refuses to sign one at all.
   */
  sell(slot: Address, order: SellOrder, signature: `0x${string}`): Promise<Hash> {
    return this.write(slot, "sell", [order, signature]);
  }

  /** Give up the slot and take back what is left of your deposit. */
  release(slot: Address): Promise<Hash> {
    return this.write(slot, "release", []);
  }

  /**
   * Evict an occupant whose deposit is empty. Anyone may call.
   *
   * There is no bounty — the reward is the slot. This leaves it VACANT, which is
   * only worth doing if you do not want the slot yourself: use
   * {@link liquidateAndTake} to evict and claim atomically, or you hand the
   * vacancy to whoever is watching the mempool.
   */
  liquidate(slot: Address): Promise<Hash> {
    return this.write(slot, "liquidate", []);
  }

  /**
   * Evict an insolvent occupant and take the slot, in one transaction.
   *
   * This is what makes "no bounty" honest: the reward for liquidating is the
   * slot, which only holds if the eviction and the claim are atomic — otherwise
   * the keeper vacates the slot and loses the race for it to whoever is watching
   * the mempool.
   *
   * Charges {@link quoteLiquidateAndTake}, which is a DIFFERENT number from
   * {@link quoteBuy} — the eviction vacates the slot before the purchase reads
   * the price, so there is no occupant left to buy out. Neither path derives its
   * amount from `price()` any more, and there are tests asserting exactly that
   * by omitting `price` from the double entirely.
   *
   * Both currencies work. `multicall` deliberately does not cover this: OZ's is
   * non-payable, so it was silently unreachable for native slots.
   */
  async liquidateAndTake(params: BuyParams): Promise<Hash> {
    this.assertPositive(params.depositAmount, "depositAmount");
    this.assertPrice(params.selfAssessedPrice, "selfAssessedPrice");
    if (params.account === zeroAddress)
      throw new SlotsError(
        "liquidateAndTake",
        "account must not be the zero address",
      );

    const amount = await this.quoteLiquidateAndTake(
      params.slot,
      params.depositAmount,
    );

    return this.withPayment(params.slot, amount, {
      functionName: "liquidateAndTake",
      args: [params.account, params.depositAmount, params.selfAssessedPrice],
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WRITE — holding
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Restate what you think the slot is worth. Raises or lowers your tax, and the
   * price at which anyone may take it from you.
   *
   * Callable by the occupant or an address they made an operator.
   */
  async selfAssess(slot: Address, newPrice: bigint): Promise<Hash> {
    this.assertPrice(newPrice, "newPrice");
    return this.write(slot, "selfAssess", [newPrice]);
  }

  /**
   * Add to the occupant's escrow.
   *
   * Permissionless: anyone may fund anyone's slot, which is what makes an
   * external keeper possible with no protocol permission at all.
   */
  async topUp(slot: Address, amount: bigint): Promise<Hash> {
    this.assertPositive(amount, "amount");
    return this.withPayment(slot, amount, {
      functionName: "topUp",
      args: [amount],
    });
  }

  /** Take back part of your escrow, keeping whatever `minDepositSeconds` requires. */
  async withdraw(slot: Address, amount: bigint): Promise<Hash> {
    this.assertPositive(amount, "amount");
    return this.write(slot, "withdraw", [amount]);
  }

  /**
   * Delegate repricing to `operator`. Occupant only.
   *
   * The grant does not survive the tenure: it is recorded against the current
   * {@link tenureId} and is void the moment the slot changes hands, with no
   * event marking it. There is nothing to revoke afterwards, and nothing an
   * incoming occupant has to clean up before setting their own.
   */
  setOperator(slot: Address, operator: Address, allowed: boolean): Promise<Hash> {
    return this.write(slot, "setOperator", [operator, allowed]);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WRITE — money out
  // ═══════════════════════════════════════════════════════════════════════════

  /** Flush accrued tax to the slot's recipient. Anyone may call. */
  collect(slot: Address): Promise<Hash> {
    return this.write(slot, "collect", []);
  }

  /**
   * Take a payout that could not be pushed to you.
   *
   * Anyone may call on anyone's behalf; the funds always go to `account`. This
   * exists because every payout in the protocol pushes and falls back to
   * crediting — a counterparty who cannot receive must never be able to make
   * themselves un-evictable by refusing payment.
   */
  claim(slot: Address, account?: Address): Promise<Hash> {
    return this.write(slot, "claim", [account ?? this.account]);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WRITE — manager
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Queue a change of terms. It lands at the next occupancy transition, never
   * immediately — the terms an occupant bought into hold for their whole tenure.
   *
   * Both dimensions travel in one call because they share one deferral and one
   * apply. Omit a field to leave it alone; pass `hook: zeroAddress` to detach the
   * hook, which is why presence rather than truthiness decides.
   */
  async proposeTerms(slot: Address, params: ProposeTermsParams): Promise<Hash> {
    const changeTax = params.taxPercentage !== undefined;
    const changeHook = params.hook !== undefined;
    if (!changeTax && !changeHook)
      throw new SlotsError(
        "proposeTerms",
        "nothing to propose — pass taxPercentage, hook, or both",
      );
    if (changeTax) {
      const tax = params.taxPercentage as bigint;
      if (tax <= 0n || tax > MAX_TAX_BPS)
        throw new SlotsError(
          "proposeTerms",
          `taxPercentage must be 1..${MAX_TAX_BPS} basis points per 30 days`,
        );
    }
    return this.write(slot, "proposeTerms", [
      params.taxPercentage ?? 0n,
      params.hook ?? zeroAddress,
      changeTax,
      changeHook,
    ]);
  }

  /** Drop whatever is queued. Manager only. */
  cancelProposal(slot: Address): Promise<Hash> {
    return this.write(slot, "cancelProposal", []);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Signed sell orders
  // ═══════════════════════════════════════════════════════════════════════════

  /** The next nonce this buyer should sign with on `slot`. */
  orderNonce(slot: Address, buyer?: Address): Promise<bigint> {
    return this.read<bigint>(slot, "orderNonce", [buyer ?? this.account]);
  }

  /** Whether a nonce has been burned — by a fill, or by {@link cancelSellOrder}. */
  orderUsed(slot: Address, nonce: bigint, buyer?: Address): Promise<boolean> {
    return this.read<boolean>(slot, "orderUsed", [buyer ?? this.account, nonce]);
  }

  /** The digest the slot will check, straight from the slot. */
  sellOrderHash(slot: Address, order: SellOrder): Promise<`0x${string}`> {
    return this.read<`0x${string}`>(slot, "sellOrderHash", [order]);
  }

  /**
   * Sign a sell order as the connected account. Off-chain and free.
   *
   * The EIP-712 `verifyingContract` is the SLOT, not the factory — every slot
   * recomputes its own domain separator, so a signature can never be replayed
   * onto a different one. That also means it cannot be cached: these are beacon
   * proxies, and the implementation's constructor runs once for all of them.
   *
   * Refuses on a native slot. `sell` pulls the buyer's funds on an allowance and
   * native ETH has none, so the order would be unfillable by construction.
   */
  async signSellOrder(
    slot: Address,
    params: SignSellOrderParams,
  ): Promise<SignedSellOrder> {
    this.assertPrice(params.price, "price");

    const currency = await this.currency(slot);
    if (isNativeCurrency(currency))
      throw new SlotsError(
        "signSellOrder",
        "This slot is priced in native ETH. Selling pulls the buyer's funds on " +
          "an allowance, and native ETH has none — the order could never be filled.",
      );

    const nonce = params.nonce ?? (await this.orderNonce(slot));

    const order: SellOrder = {
      slot,
      buyer: this.account,
      price: params.price,
      deposit: params.deposit,
      nonce,
      deadline: params.deadline,
    };

    const signature = await this.wallet.signTypedData({
      account: this.account,
      domain: {
        name: SELL_ORDER_DOMAIN_NAME,
        version: SELL_ORDER_DOMAIN_VERSION,
        chainId: this.chain.id,
        verifyingContract: slot,
      },
      types: SELL_ORDER_TYPES,
      primaryType: "SellOrder",
      message: order,
    });

    return { order, signature };
  }

  /**
   * Fund an order, then sign it.
   *
   * The allowance is granted to the SLOT, not to whatever venue the order gets
   * published on: the slot is what pulls when the occupant sells. Nothing on
   * chain checks it — an unfunded order is perfectly legal and simply never
   * executes — so granting it here is what makes the order real.
   *
   * Skips the approve when the existing allowance already covers `price +
   * deposit`, because re-approving a spender that has enough is a wallet
   * confirmation that buys nothing.
   */
  async makeSellOrder(
    slot: Address,
    params: SignSellOrderParams,
  ): Promise<SignedSellOrder> {
    this.assertPrice(params.price, "price");

    const currency = await this.currency(slot);
    if (isNativeCurrency(currency))
      throw new SlotsError(
        "makeSellOrder",
        "This slot is priced in native ETH. Selling pulls the buyer's funds on " +
          "an allowance, and native ETH has none — the order could never be filled.",
      );

    await this.ensureAllowance(currency, slot, params.price + params.deposit);

    return this.signSellOrder(slot, params);
  }

  /**
   * Burn one of your own nonces.
   *
   * A signed order is a standing authorisation that lives wherever it was
   * published; deleting it from one order book revokes nothing. Burning the
   * nonce kills every copy at once.
   */
  cancelSellOrder(slot: Address, nonce: bigint): Promise<Hash> {
    return this.write(slot, "cancelSellOrder", [nonce]);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Internals
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Send `call`, paying `amount` the way this slot's currency requires.
   *
   * Native slots hold no allowance to grant, so the value rides on the
   * transaction — and the contract demands `msg.value` equal the amount EXACTLY,
   * so overpaying reverts rather than refunding. ERC-20 slots keep the approve →
   * confirm → execute sequence, and send no value at all: the contract rejects a
   * non-zero `msg.value` on the ERC-20 path.
   */
  private async withPayment(
    slot: Address,
    amount: bigint,
    call: {
      functionName: "buy" | "topUp" | "liquidateAndTake";
      args: readonly unknown[];
    },
  ): Promise<Hash> {
    const currency = await this.currency(slot);

    if (isNativeCurrency(currency))
      return this.write(slot, call.functionName, call.args, amount);

    await this.ensureAllowance(currency, slot, amount);
    return this.write(slot, call.functionName, call.args);
  }

  /**
   * Grant `spender` an allowance of at least `amount`, if it does not have one.
   *
   * Split out of {@link withPayment} because {@link makeSellOrder} needs exactly
   * this and none of the rest — its last act is a signature, not a transaction.
   */
  private async ensureAllowance(
    currency: Address,
    spender: Address,
    amount: bigint,
  ): Promise<void> {
    const readAllowance = () =>
      this.publicClient.readContract({
        address: currency,
        abi: erc20Abi,
        functionName: "allowance",
        args: [this.account, spender],
      });

    if ((await readAllowance()) >= amount) return;

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
      readAllowance,
      (value) => value >= amount,
    );
    if (confirmed < amount)
      throw new SlotsError(
        "ensureAllowance",
        "Approval confirmed but on-chain allowance is still insufficient after retries",
      );
  }

  /** Poll `check` until `predicate` holds or `maxAttempts` is exhausted. */
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
