import {
  minimumTenureModuleAbi,
  offerBookAbi,
  offerBookAddress,
  slotAbi,
  slotFactoryAbi,
  slotLensAbi,
  slotLensAddress,
} from "@0xslots/contracts/slots";
import {
  type AbiParameter,
  type Address,
  type Chain,
  decodeAbiParameters,
  encodeFunctionData,
  erc20Abi,
  type Hash,
  type Hex,
  type PublicClient,
  size,
  type WalletClient,
  zeroAddress,
} from "viem";
import { decodedRevert, SlotsError } from "../errors";
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
/** `Slot.MAX_MIN_RUNWAY`: a year. The escrow floor scales with the runway. */
export const MAX_MIN_RUNWAY_SECONDS = 365 * 24 * 60 * 60;
export const BASIS_POINTS = 10_000n;
/** The tax period. Basis points are per 30 days, not per year. */
export const MONTH_SECONDS = 30n * 24n * 60n * 60n;
/**
 * How long queued terms must sit before a transition may apply them.
 *
 * `pending.proposedAt + TERMS_DELAY` is the instant `hasRipeTerms()` starts
 * answering true. Mirrored here so a UI can say WHEN a queued change becomes
 * ripe without a second round trip — but whether it IS ripe should still come
 * from {@link SlotsClient.hasRipeTerms}, which asks the chain's clock rather
 * than the browser's.
 */
export const TERMS_DELAY_SECONDS = 60n * 60n;

/** "This module configured nothing": empty settings. */
export const NO_SETTINGS = "0x" as const;

/**
 * Term bits for `proposeTerms` and `cancelTerms`. Mirrors `TermsLib`.
 * `MODULE` always covers the whole {@link ModuleTerms}. `SCOPES` is never
 * proposed: it is queued by {@link SlotsClient.acceptScopes}.
 */
export const TERMS = {
  TAX_RATE: 1,
  RECIPIENT: 2,
  MIN_RUNWAY: 4,
  MODULE: 8,
  SCOPES: 16,
} as const;
export const ALL_TERMS = 31;

// ─── Terms ────────────────────────────────────────────────────────────────────

/** What the slot charges and who receives it. Mirrors `TaxTerms`. */
export interface TaxTerms {
  /** Receives the rent, less any module fee. Never zero. */
  recipient: Address;
  /** Basis points of the declared price per 30 days. 1..10000. */
  rateBps: number;
  /** Runway a buyer must fund, in seconds. Zero means no minimum. */
  minRunwaySeconds: number;
}

/** The slot's module and its configuration. Mirrors `ModuleTerms`. */
export interface ModuleTerms {
  /** The module contract. {@link zeroAddress} for none, with `settings` empty too. */
  module: Address;
  /**
   * This slot's settings for the module: `abi.encode` of the fields its
   * metadata's `x-abi` lists. Opaque to the slot. {@link NO_SETTINGS} for none.
   */
  settings: Hex;
}

/**
 * A module's share of collected tax, and who receives it. Declared by the
 * module; the slot keeps a copy from when it attached or its manager last
 * accepted. Mirrors `ModuleFee`.
 */
export interface ModuleFee {
  /** Basis points of collected tax. 0..10000. */
  bps: number;
  recipient: Address;
}

/** Scope bits a module declares and a slot stores. Mirrors `ScopesLib`. */
export const SCOPE_BITS = {
  beforeBuy: 1,
  beforeSelfAssess: 2,
  afterBuy: 4,
  afterRelease: 8,
  afterLiquidate: 16,
  afterSettle: 32,
  afterCallbacksMustSucceed: 64,
  onInstall: 128,
  onUninstall: 256,
} as const;

export const NO_MODULE: ModuleTerms = { module: zeroAddress, settings: NO_SETTINGS };

// ─── Creation ─────────────────────────────────────────────────────────────────

/**
 * Everything a slot needs at birth. Mirrors `SlotInit`.
 *
 * `manager` is required exactly when any `mutable*` flag is set, and must be
 * the zero address otherwise. {@link assertSlotInit} checks this before gas.
 */
export interface SlotInit {
  /** The token tax and price are denominated in. {@link zeroAddress} = native ETH. */
  currency: Address;
  manager: Address;
  /** Tax rate and minimum runway can change. */
  mutableTax: boolean;
  mutableRecipient: boolean;
  mutableModule: boolean;
  taxTerms: TaxTerms;
  /** Omit for no module. */
  moduleTerms?: Partial<ModuleTerms> & { module: Address };
}

function fullModuleTerms(terms?: Partial<ModuleTerms> & { module: Address }): ModuleTerms {
  return {
    module: terms?.module ?? zeroAddress,
    settings: terms?.settings ?? NO_SETTINGS,
  };
}

/** The exact tuple the factory expects. viem encodes structs by name. */
function encodeSlotInit(init: SlotInit) {
  return {
    currency: init.currency,
    manager: init.manager,
    mutableTax: init.mutableTax,
    mutableRecipient: init.mutableRecipient,
    mutableModule: init.mutableModule,
    taxTerms: {
      recipient: init.taxTerms.recipient,
      rateBps: init.taxTerms.rateBps,
      minRunwaySeconds: init.taxTerms.minRunwaySeconds,
    },
    moduleTerms: fullModuleTerms(init.moduleTerms),
  } as const;
}

function assertTaxTerms(taxTerms: Partial<TaxTerms>, mask: number, where: string) {
  if (mask & TERMS.RECIPIENT && (!taxTerms.recipient || taxTerms.recipient === zeroAddress))
    throw new SlotsError(where, "recipient must not be the zero address");
  if (mask & TERMS.TAX_RATE) {
    const tax = taxTerms.rateBps ?? 0;
    if (tax <= 0 || tax > Number(MAX_TAX_BPS))
      throw new SlotsError(where, `rateBps must be 1..${MAX_TAX_BPS} basis points per 30 days`);
  }
  if (mask & TERMS.MIN_RUNWAY) {
    const min = taxTerms.minRunwaySeconds ?? 0;
    if (min < 0 || min > MAX_MIN_RUNWAY_SECONDS)
      throw new SlotsError(
        where,
        `minRunwaySeconds must be 0..${MAX_MIN_RUNWAY_SECONDS} (a year)`,
      );
  }
}

function assertModule(terms: ModuleTerms, where: string) {
  if (terms.module === zeroAddress && size(terms.settings) !== 0)
    throw new SlotsError(where, "module settings need a module — pass one, or drop the settings");
}

/** Throw on the initialisations `Slot.initialize` refuses, before spending gas. */
export function assertSlotInit(init: SlotInit): void {
  const anyMutable = init.mutableTax || init.mutableRecipient || init.mutableModule;
  if (anyMutable && init.manager === zeroAddress)
    throw new SlotsError("createSlot", "a slot with anything mutable needs a manager");
  if (!anyMutable && init.manager !== zeroAddress)
    throw new SlotsError(
      "createSlot",
      "a fully immutable slot must have no manager — the zero address is what makes it immutable",
    );
  assertTaxTerms(init.taxTerms, ALL_TERMS, "createSlot");
  assertModule(fullModuleTerms(init.moduleTerms), "createSlot");
}

// ─── Modules ────────────────────────────────────────────────────────────────────

/**
 * A module's scopes, as the slot accepted them when it was
 * attached — not as the module reports them today.
 *
 * `before` decides and may refuse; `after` records and cannot. That is the whole
 * interface. A flag being false means the callback is skipped entirely, so an
 * `afterBuy` that never fires is usually a module that forgot to declare it.
 */
export interface Scopes {
  beforeBuy: boolean;
  beforeSelfAssess: boolean;
  afterBuy: boolean;
  afterRelease: boolean;
  afterLiquidate: boolean;
  afterSettle: boolean;
  onInstall: boolean;
  onUninstall: boolean;
  /**
   * Not a callback — a mode. The module's `after` calls run uncapped and their
   * revert propagates, so its writes cannot be silently dropped.
   *
   * A slot whose module declares this is only as evictable as that module: a
   * failing `afterLiquidate` blocks the eviction rather than being swallowed.
   * Surface it wherever a user commits funds to a slot.
   */
  afterCallbacksMustSucceed: boolean;
}

/** Scope bits (see {@link SCOPE_BITS}) as {@link Scopes}. */
export function unpackScopes(scopes: number): Scopes {
  const has = (bit: number) => (scopes & bit) !== 0;
  return {
    beforeBuy: has(SCOPE_BITS.beforeBuy),
    beforeSelfAssess: has(SCOPE_BITS.beforeSelfAssess),
    afterBuy: has(SCOPE_BITS.afterBuy),
    afterRelease: has(SCOPE_BITS.afterRelease),
    afterLiquidate: has(SCOPE_BITS.afterLiquidate),
    afterSettle: has(SCOPE_BITS.afterSettle),
    onInstall: has(SCOPE_BITS.onInstall),
    onUninstall: has(SCOPE_BITS.onUninstall),
    afterCallbacksMustSucceed: has(SCOPE_BITS.afterCallbacksMustSucceed),
  };
}

/** {@link Scopes} back to bits. */
export function packScopes(scopes: Scopes): number {
  return (Object.keys(SCOPE_BITS) as (keyof typeof SCOPE_BITS)[]).reduce(
    (bits, name) => (scopes[name] ? bits | SCOPE_BITS[name] : bits),
    0,
  );
}

/** Everything queued for the next buy. Mirrors `Pending`. */
export interface Pending {
  /** Only the fields named by `mask` are meaningful. */
  taxTerms: TaxTerms;
  /** Meaningful when `hasModule`. */
  moduleTerms: ModuleTerms;
  /**
   * With `hasModule`: the scopes reviewed for the proposed module. With
   * `hasScopes`: new scopes accepted from the attached one.
   */
  scopes: number;
  /** With `hasModule`: the fee reviewed for the proposed module. */
  fee: ModuleFee;
  /** Which terms are queued. See {@link TERMS}. */
  mask: number;
  hasTaxRate: boolean;
  hasRecipient: boolean;
  hasMinRunway: boolean;
  hasModule: boolean;
  hasScopes: boolean;
  proposedAt: bigint;
  /**
   * The instant this becomes ripe — `proposedAt + TERMS_DELAY`. Zero when
   * nothing is queued. Render it; branch on {@link applies}.
   */
  appliesAt: bigint;
  /**
   * `hasRipeTerms()` — whether the next buy will actually land these terms,
   * answered against the chain's clock.
   */
  applies: boolean;
  /** True when nothing is queued. */
  isEmpty: boolean;
}

/**
 * A change of terms to queue. Presence is the signal, not truthiness:
 * `{ moduleTerms: NO_MODULE }` means "detach the module".
 */
export interface ProposeTermsParams {
  /** Basis points per 30 days. */
  taxRateBps?: number;
  recipient?: Address;
  minRunwaySeconds?: number;
  /** The whole module terms. Its scopes and fee are the module's own, read when it attaches. */
  moduleTerms?: Partial<ModuleTerms> & { module: Address };
}

/** Every term in force. Mirrors `Terms`. */
export interface SlotTerms {
  taxTerms: TaxTerms;
  moduleTerms: ModuleTerms;
}

/**
 * `uiMetadata()`, declared here rather than taken from a generated ABI.
 *
 * Optional surface that any module may implement, so borrowing one module's
 * ABI to call it on another would tie this to whichever module happened to be
 * generated.
 */
const moduleMetadataAbi = [
  {
    type: "function",
    name: "uiMetadata",
    stateMutability: "pure",
    inputs: [],
    outputs: [{ type: "string" }],
  },
] as const;

/** One `x-abi` entry: viem's own `AbiParameter`, in encoding order. */
export interface ModuleSettingsParam {
  name: string;
  type: string;
}

/**
 * The configuration half of a module's metadata: a JSON Schema 2020-12
 * document, passable to `react-jsonschema-form` or AJV untouched, plus the
 * `x-` conventions the protocol adds.
 *
 * Every value is a string — a `uint64` bound does not survive `JSON.parse` as a
 * number — so ranges travel as `x-minimum` / `x-maximum` strings and the
 * module's own `validateSettings` remains the authority on what is accepted.
 */
export interface ModuleSettingsSchema {
  $schema: string;
  title: string;
  type: "object";
  properties: Record<string, Record<string, unknown>>;
  required: string[];
  /** Whether a slot may carry no configuration at all. */
  "x-optional"?: boolean;
  "x-abi": ModuleSettingsParam[];
}

/** What a module says it is. `IModuleMetadata.uiMetadata`, parsed. */
export interface ModuleMetadata {
  version: number;
  title: string;
  description: string;
  docs?: string;
  /** Absent for a module that takes no settings. */
  settings?: ModuleSettingsSchema;
}

/** Whether a module accepts a configuration, and why not. */
export type SettingsCheck = { ok: true } | { ok: false; reason: string };

/** One entry on the OfferBook. `id` is what `acceptOffer` and `cancelOffer` take. */
export interface BookOffer {
  id: bigint;
  bidder: Address;
  price: bigint;
  deposit: bigint;
  expiry: bigint;
  cancelled: boolean;
  filled: boolean;
}

/** A slot's standing offers, as the book judges them. */
export interface OfferBoard {
  /** Live offers only, highest price first. */
  offers: BookOffer[];
  /** `liveCount`: what a badge should show. */
  liveCount: bigint;
  /** The book's best live, funded offer, if any. */
  best?: BookOffer;
}

/** A standing bid to post. Posting moves no funds. */
export interface PostOfferParams {
  slot: Address;
  price: bigint;
  /** The escrow the bidder will fund if accepted. */
  deposit: bigint;
  /** Unix seconds. */
  expiry: bigint;
}

/** Every constant a slot runs under, as `SlotLens.getSlotConstants` reports them. */
export interface SlotConstants {
  maxPrice: bigint;
  maxTaxBps: bigint;
  basisPoints: bigint;
  month: bigint;
  moduleCallbackGasLimit: bigint;
  nativePayoutGasLimit: bigint;
  termsDelay: bigint;
  maxMinRunway: bigint;
  /** `TERM_*` bits for `proposeTerms` and `cancelTerms`. */
  termTaxRate: number;
  termRecipient: number;
  termMinRunway: number;
  termModule: number;
  termScopes: number;
}

/** What the attached module declares today, beside what the slot copied. */
export interface ModuleUpdate {
  current: { scopes: number; fee: ModuleFee };
  /** `null` when there is no module, or it does not answer. */
  declared: { scopes: number; fee: ModuleFee } | null;
  /** {@link SlotsClient.acceptFee} would change the fee, at once (a rise needs `mutableRecipient`). */
  feeDiffers: boolean;
  /**
   * {@link SlotsClient.acceptScopes} would queue new scopes for the next buy.
   * False when the module is immutable, those scopes are already queued, or a
   * new module is queued.
   */
  scopesDiffer: boolean;
}

// ─── Selling ──────────────────────────────────────────────────────────────────
//
// There is no `SellOrder` any more. The core carried `sell` — an occupant
// submitting a buyer's EIP-712 order — and it was a SECOND seating path: it
// reset the tenure like `buy` but ran `beforeSell` instead of `beforeBuy`, so a
// module author had two doors to police.
//
// A consensual sale is now `selfAssess` then `buy`, performed by the OfferBook
// inside the occupant's own transaction. The occupant makes the book their
// operator (`setOperator`), the bidder posts an offer on-chain, and the
// occupant accepts it. Nothing is signed off-chain, so nothing here mirrors a
// digest, a nonce or a domain.

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
  /**
   * A ceiling on the TOTAL charged. Omit and the client uses the quote it just
   * read, which is what you almost always want.
   *
   * The sitting price is read at EXECUTION, not when you quoted it, so the
   * occupant can raise it between your simulation and your inclusion and take
   * the whole allowance you granted. Native slots are incidentally safe — `buy`
   * checks `msg.value` for equality — but an ERC-20 buy had nothing bounding it
   * at all, which is the hole this closes.
   *
   * `0n` DISABLES the ceiling. It is spelled as a value rather than as an
   * absence so that opting out is a thing a caller did on purpose: omitting the
   * field gets the protection, and only `maxPayment: 0n` gives it up.
   */
  maxPayment?: bigint;
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
  taxRateBps: bigint;
  minRunwaySeconds: bigint;
  recipient: Address;
  /** Zero means nothing can ever change. */
  manager: Address;
  mutableTax: boolean;
  mutableRecipient: boolean;
  mutableModule: boolean;
  module: Address;
  /** The module's configuration: bytes only the module can interpret. */
  settings: Hex;
  /** The module's callbacks, as this slot accepted them. */
  scopes: Scopes;
  /** The module's share of collected tax, as this slot accepted it. */
  fee: ModuleFee;
  pending: Pending;
  /** Unix seconds. Zero when vacant. What a tenure window is measured from. */
  occupiedSince: bigint;
  /**
   * Tax already settled into the contract and awaiting a `collect`.
   *
   * Distinct from `taxOwed`, which is what is still accruing OUT of the
   * deposit. What a `collect` actually pays the recipient is this plus whatever
   * `_settle` can still take, so a UI gating the button on either half alone
   * hides it in a real case: on `collectedTax` alone it vanishes for any slot
   * untouched since occupancy, and on `taxOwed` alone it strands tax already
   * settled on a slot that has since been vacated.
   */
  collectedTax: bigint;
  /**
   * Unix seconds of the last settlement — the anchor `taxOwed` is measured from.
   *
   * Exposed because `taxOwed` is a pure function of it and the block timestamp:
   *
   *   price * taxRateBps * (now - lastSettled) / (MONTH * BASIS_POINTS)
   *
   * so a client holding this can reproduce the figure for any instant without
   * asking the chain again. That is what lets a runway actually count down
   * between reads instead of sitting still until the next poll.
   */
  lastSettled: bigint;
  /**
   * Bumped on every seating. Operator approvals are keyed to it, so a change
   * here silently voids every one of them.
   */
  tenureId: bigint;
}

export interface SlotsClientConfig {
  /** The v1 `SlotFactory`. Only `createSlot` needs it. */
  factoryAddress?: Address;
  /**
   * The `OfferBook`. Only {@link SlotsClient.acceptOffer} needs it, and it
   * defaults to the book deployed on the wallet's chain.
   */
  offerBookAddress?: Address;
  /**
   * The `SlotLens`. {@link SlotsClient.slotState}, {@link SlotsClient.slotStates}
   * and {@link SlotsClient.moduleUpdate} read through it, and it defaults to
   * the lens deployed on the chain.
   */
  lensAddress?: Address;
  publicClient?: PublicClient;
  walletClient?: WalletClient;
}

// ─── Client ───────────────────────────────────────────────────────────────────

/**
 * `slotAbi` plus every module error this package can name.
 *
 * A module's veto reverts with the MODULE'S error, and viem decodes an error only
 * if it is in the ABI it was handed — so simulating against `slotAbi` alone
 * yields a bare four-byte selector, which is a hex string nobody can act on.
 * Extra error entries cost nothing: the function being called is still resolved
 * by name out of `slotAbi`.
 *
 * A module this package has never heard of still degrades to the selector. That
 * is the honest floor for an open extension point, and it is strictly more than
 * a mined revert with no reason at all.
 */
/** `OfferBook.Offer` as viem decodes it. */
type RawOffer = Omit<BookOffer, "id">;

/** Board entries read per `boardPage` call. Far under any RPC's gas budget. */
const BOARD_PAGE = 200n;

const SIMULATION_ABI = [
  ...slotAbi,
  ...minimumTenureModuleAbi.filter((entry) => entry.type === "error"),
] as const;

/**
 * Client for the v1 Slots protocol.
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
  private readonly _offerBook?: Address;
  private readonly _lens?: Address;

  constructor(config: SlotsClientConfig) {
    this._publicClient = config.publicClient;
    this._walletClient = config.walletClient;
    this._factory = config.factoryAddress;
    this._offerBook = config.offerBookAddress;
    this._lens = config.lensAddress;
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

  /** The SlotLens this client reads through. */
  private get lens(): Address {
    const lens = this._lens ?? slotLensAddress[this.chain.id];
    if (!lens)
      throw new SlotsError("SlotsClient", "No lensAddress provided or deployed on this chain");
    return lens;
  }

  /** A read on the lens. */
  private readLens<T>(functionName: string, args: readonly unknown[]) {
    return this.publicClient.readContract({
      address: this.lens,
      abi: slotLensAbi,
      functionName,
      args,
    } as never) as Promise<T>;
  }

  /** The OfferBook this client sends to. */
  private get offerBook(): Address {
    const book = this._offerBook ?? offerBookAddress[this.chain.id];
    if (!book)
      throw new SlotsError("SlotsClient", "No offerBookAddress provided or deployed on this chain");
    return book;
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

  private read<T>(
    slot: Address,
    functionName: string,
    args?: readonly unknown[],
  ) {
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
  quoteBuy(
    slot: Address,
    account: Address,
    depositAmount: bigint,
  ): Promise<bigint> {
    return this.read<bigint>(slot, "quoteBuy", [account, depositAmount]);
  }

  /**
   * Tax the occupant owes beyond an emptied deposit, this tenure. A top-up
   * pays it first, and so does the price a buyer pays them. It ends with the
   * tenure, so it is zero for anyone not seated and never part of a quote.
   */
  debtOf(slot: Address, account: Address): Promise<bigint> {
    return this.read<bigint>(slot, "debtOf", [account]);
  }

  /**
   * Whether queued terms are ripe enough to land at the next transition.
   *
   * A transition is WHERE terms land; `TERMS_DELAY` is WHEN they may. Before
   * this existed a proposal bound the very next buyer in the same block, which
   * is what the timelock was written to stop. Anything that prices against the
   * pending rate — `minDepositForBuy` on-chain, a deposit sizer off it — has to
   * agree with `_applyPending` about this, in both directions.
   *
   * False when nothing at all is queued.
   */
  hasRipeTerms(slot: Address): Promise<boolean> {
    return this.read<boolean>(slot, "hasRipeTerms");
  }

  /** The slot's single extension point. {@link zeroAddress} when there is none. */
  module(slot: Address): Promise<Address> {
    return this.read<Address>(slot, "module");
  }

  /**
   * The module's scopes AS ACCEPTED by this slot.
   *
   * Not what the module's own `modules()` says today: the snapshot is deliberate, so
   * a module cannot widen its reach mid-tenure and start spending an occupant's
   * gas on callbacks they never agreed to.
   */
  scopes(slot: Address): Promise<Scopes> {
    return this.read<Scopes>(slot, "scopes");
  }

  /**
   * Terms the manager has queued for the next buy.
   *
   * Two reads, not one, and the second is the whole reason: the struct says
   * WHAT is queued and `hasRipeTerms()` says whether the next buy will
   * take it. Those were the same fact until `TERMS_DELAY` was wired up, and a
   * caller left to infer the second from `proposedAt` and its own clock is
   * inferring it against the wrong clock.
   */
  async pending(slot: Address): Promise<Pending> {
    const [p, ripe] = await Promise.all([
      this.read<PendingResult>(slot, "pending"),
      this.hasRipeTerms(slot),
    ]);
    return toPending(p, ripe);
  }

  /** The token this slot is denominated in. {@link zeroAddress} means native ETH. */
  currency(slot: Address): Promise<Address> {
    return this.read<Address>(slot, "currency");
  }

  /** Basis points per 30 days. */
  taxRateBps(slot: Address): Promise<bigint> {
    return this.read<bigint>(slot, "taxRateBps");
  }

  /** Owed to an address a push payment could not reach. Take it with {@link claim}. */
  claimableOf(slot: Address, account?: Address): Promise<bigint> {
    return this.read<bigint>(slot, "claimableOf", [account ?? this.account]);
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

  /** Every term in force: tax terms and module terms. */
  terms(slot: Address): Promise<SlotTerms> {
    return this.read<SlotTerms>(slot, "terms");
  }

  /** The module's fee as this slot accepted it. What payouts use. */
  fee(slot: Address): Promise<ModuleFee> {
    return this.read<ModuleFee>(slot, "fee");
  }

  /** Who may propose terms. Zero when nothing about the slot can change. */
  manager(slot: Address): Promise<Address> {
    return this.read<Address>(slot, "manager");
  }

  /** Tax settled into the slot and not yet paid out. */
  collectedTax(slot: Address): Promise<bigint> {
    return this.read<bigint>(slot, "collectedTax");
  }

  /** Unix seconds tax has been settled up to. */
  lastSettled(slot: Address): Promise<bigint> {
    return this.read<bigint>(slot, "lastSettled");
  }

  /** Unix seconds the current tenure began. Zero when vacant. */
  occupiedSince(slot: Address): Promise<bigint> {
    return this.read<bigint>(slot, "occupiedSince");
  }

  /**
   * The escrow floor at `price` under the terms in force: what `selfAssess` and
   * `withdraw` enforce. {@link minDepositForBuy} uses ripe queued terms instead.
   */
  minDepositToHold(slot: Address, price: bigint): Promise<bigint> {
    return this.read<bigint>(slot, "minDepositToHold", [price]);
  }

  /** Runway a buyer must fund, in seconds. */
  minRunwaySeconds(slot: Address): Promise<bigint> {
    return this.read<bigint>(slot, "minRunwaySeconds");
  }

  // ─── Modules ──────────────────────────────────────────────────────────────────

  /**
   * The scopes `module` asks for on a slot configured with `settings`, as it
   * declares them today. Not what any slot accepted: that is {@link scopes}.
   */
  readScopes(module: Address, settings: Hex = NO_SETTINGS): Promise<number> {
    return this.publicClient.readContract({
      address: module,
      abi: minimumTenureModuleAbi,
      functionName: "scopes",
      args: [settings],
    }) as Promise<number>;
  }

  /**
   * The fee `module` asks for on a slot configured with `settings`, as it
   * declares it today. Not what any slot accepted: that is {@link fee}.
   */
  readFee(module: Address, settings: Hex = NO_SETTINGS): Promise<ModuleFee> {
    return this.publicClient.readContract({
      address: module,
      abi: minimumTenureModuleAbi,
      functionName: "fee",
      args: [settings],
    }) as Promise<ModuleFee>;
  }

  /**
   * Ask `module` whether it accepts `settings`, the same check a slot runs when the
   * module is proposed or attached. Resolves with the module's reason instead of
   * throwing, so a form can show it.
   */
  async validateSettings(module: Address, settings: Hex): Promise<SettingsCheck> {
    try {
      await this.publicClient.readContract({
        address: module,
        abi: minimumTenureModuleAbi,
        functionName: "validateSettings",
        args: [settings],
      });
      return { ok: true };
    } catch (error) {
      const short = (error as { shortMessage?: unknown }).shortMessage;
      return {
        ok: false,
        reason:
          decodedRevert(error) ??
          (typeof short === "string" ? short : String(error).split("\n")[0]),
      };
    }
  }

  /**
   * What a module says it is (`IModuleMetadata.uiMetadata`), parsed.
   *
   * `null` for a module that does not describe itself, that reverts, or that
   * answers with something that is not JSON — all of which are legal. The
   * caller falls back to the scopes, which still say whether the module may
   * refuse a buy.
   *
   * The answer is fixed by the module's code, so it can be cached by address
   * indefinitely.
   */
  async moduleMetadata(module: Address): Promise<ModuleMetadata | null> {
    try {
      const raw = await this.publicClient.readContract({
        address: module,
        abi: moduleMetadataAbi,
        functionName: "uiMetadata",
      });
      return JSON.parse(raw) as ModuleMetadata;
    } catch {
      return null;
    }
  }

  /**
   * A slot's module settings, decoded against the schema's `x-abi` — how a
   * client reads back a configuration it did not write, for any module.
   *
   * `null` when the settings are empty or do not decode.
   */
  moduleSettings(
    schema: ModuleSettingsSchema,
    settings: Hex,
  ): Record<string, string> | null {
    if (size(settings) === 0) return null;
    try {
      const values = decodeAbiParameters(
        schema["x-abi"] as readonly AbiParameter[],
        settings,
      );
      return Object.fromEntries(
        schema["x-abi"].map((p, i) => [p.name, String(values[i])]),
      );
    } catch {
      return null;
    }
  }

  /** The whole slot, as of one block, in one call. */
  async slotState(slot: Address): Promise<SlotState> {
    return toSlotState(await this.readLens<SlotInfoResult>("getSlotInfo", [slot]));
  }

  /** Several slots, as of one block, in one call. Throws if any is not a slot. */
  /**
   * Every constant `slot` runs under, asked of the slot through the lens, so
   * a beacon upgrade can never leave a client on old numbers.
   */
  slotConstants(slot: Address): Promise<SlotConstants> {
    return this.readLens<SlotConstants>("getSlotConstants", [slot]);
  }

  /** Whether `slot` was created by this client's factory. */
  isSlot(slot: Address): Promise<boolean> {
    return this.publicClient.readContract({
      address: this.factory,
      abi: slotFactoryAbi,
      functionName: "isSlot",
      args: [slot],
    });
  }

  /** How many slots this client's factory has created. */
  slotCount(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.factory,
      abi: slotFactoryAbi,
      functionName: "slotCount",
    });
  }

  async slotStates(slots: readonly Address[]): Promise<SlotState[]> {
    if (slots.length === 0) return [];
    const infos = await this.readLens<readonly SlotInfoResult[]>("getSlotInfos", [slots]);
    return infos.map(toSlotState);
  }

  /**
   * The smallest deposit `minRunwaySeconds` requires at `price`.
   *
   * Local arithmetic, matching `_minDepositFor` including its `ceilDiv` — a
   * short window on a low price rounds DOWN to zero, and rounding down is what
   * once made a funding requirement vanish.
   */
  /**
   * The smallest deposit `buy` or `sell` will accept at `price`, asked of the
   * slot itself.
   *
   * Prefer this over {@link minDepositFor} anywhere a BUY is being sized.
   * A buy applies queued terms before its funding check — a buyer funds the
   * terms they are buying INTO, not the ones currently on display. Sizing from `taxRateBps()` underquotes through
   * exactly the window where a tax rise is queued, and the buy then reverts
   * `InvalidDeposit` for reasons nothing on screen explains.
   *
   * `selfAssess` is deliberately not covered by it: repricing is not a
   * transition, applies nothing, and is checked against current terms — that is
   * what {@link minDepositFor} is still for.
   */
  minDepositForBuy(slot: Address, price: bigint): Promise<bigint> {
    return this.read<bigint>(slot, "minDepositForBuy", [price]);
  }

  minDepositFor(
    price: bigint,
    taxRateBps: bigint,
    minRunwaySeconds: bigint,
  ): bigint {
    if (minRunwaySeconds === 0n) return 0n;
    const numerator = price * taxRateBps * minRunwaySeconds;
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

  /**
   * Flush accrued tax out of many slots in one transaction.
   *
   * On the FACTORY rather than per slot, because the factory is the only thing
   * that knows which addresses it created — a standalone batcher would take the
   * array on trust. Nothing here is privileged: {@link collect} is permissionless
   * on every slot and the money always goes to that slot's own recipient, so
   * this is a gas convenience and not an authority.
   *
   * Each collection is isolated on chain. A slot that reverts —
   * `NothingToCollect` on one already flushed, or an `afterCallbacksMustSucceed` module that reverts
   * in `afterSettle` — leaves a zero in the result rather than failing the batch
   * for every other recipient. Addresses the factory did not create are skipped.
   *
   * ── Size it yourself ──────────────────────────────────────────────────────
   *
   * There is no cap here, and that is deliberate: the real limit is the block
   * gas limit, which differs per chain and per slot — a slot with an `afterCallbacksMustSucceed`
   * module costs far more to settle than a bare one. Call
   * {@link simulateCollectAll} first; it fails the same way the transaction
   * would, for free.
   */
  async collectAll(slots: readonly Address[]): Promise<Hash> {
    this.assertSomeSlots(slots, "collectAll");
    return this.wallet.writeContract({
      address: this.factory,
      abi: slotFactoryAbi,
      functionName: "collectAll",
      args: [slots as Address[]],
      account: this.account,
      chain: this.chain,
    });
  }

  /**
   * What {@link collectAll} would pay out, per slot, without sending anything.
   *
   * The useful half of the pair. A transaction hash carries no return value, so
   * "collect all — 1.24 ETH across 6 slots" can only be shown by simulating it;
   * and the zeroes tell you which slots are already flushed, unreachable to the
   * factory, or reverting, so a caller can drop them and send a smaller batch.
   *
   * Amounts are capped by each slot's deposit rather than being its raw
   * `taxOwed`: an insolvent slot pays what escrow it has and the remainder is
   * carried as debt against the occupant for the rest of their tenure, never
   * transferred to the recipient.
   */
  async simulateCollectAll(slots: readonly Address[]): Promise<bigint[]> {
    this.assertSomeSlots(slots, "simulateCollectAll");
    const { result } = await this.publicClient.simulateContract({
      address: this.factory,
      abi: slotFactoryAbi,
      functionName: "collectAll",
      args: [slots as Address[]],
      account: this.account,
    });
    return [...result];
  }

  /**
   * Flush one slot through the factory, and learn what moved.
   *
   * {@link collect} on the slot itself is the same money and one hop shorter, so
   * reach for that. This exists because it is what {@link collectAll} calls per
   * slot, and because it REVERTS rather than returning zero — `NotASlot` for an
   * address the factory did not create, and the slot's own revert otherwise.
   * Inside a batch those are swallowed into zeroes; on their own they are the
   * answer.
   */
  collectFrom(slot: Address): Promise<Hash> {
    return this.wallet.writeContract({
      address: this.factory,
      abi: slotFactoryAbi,
      functionName: "collectFrom",
      args: [slot],
      account: this.account,
      chain: this.chain,
    });
  }

  /**
   * An empty batch is a transaction that pays gas to do nothing.
   *
   * The contract accepts it — an empty loop is not an error — which is exactly
   * why it is worth catching here instead. A UI that maps over an empty
   * selection should not be able to prompt for a signature.
   */
  private assertSomeSlots(slots: readonly Address[], method: string): void {
    if (slots.length === 0)
      throw new SlotsError(
        method,
        "no slots given — nothing would be collected",
      );
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
   *
   * ── The ceiling is on by default ─────────────────────────────────────────
   *
   * The quote this call just read is also sent as `maxPayment`, so the
   * transaction pays what it was quoted or it reverts `PaymentAboveMax`. The
   * price is read at execution, so an occupant can raise it into a pending buy
   * and take the buyer's whole ERC-20 allowance; a client sending `0` there
   * reintroduces exactly that. Pass `maxPayment` yourself for headroom, or
   * `0n` to disable the ceiling deliberately.
   */
  async buy(params: BuyParams): Promise<Hash> {
    this.assertPositive(params.depositAmount, "depositAmount");
    this.assertPrice(params.selfAssessedPrice, "selfAssessedPrice");
    if (params.account === zeroAddress)
      throw new SlotsError("buy", "account must not be the zero address");

    const amount = await this.quoteBuy(
      params.slot,
      params.account,
      params.depositAmount,
    );

    return this.withPayment(params.slot, amount, {
      functionName: "buy",
      // Price before deposit, matching `Slot.buy`. The two are adjacent
      // `bigint`s and swapping them does not throw — it buys at the deposit and
      // escrows the price — so this array is the one place the order is
      // asserted for every caller of this SDK.
      args: [
        params.account,
        params.selfAssessedPrice,
        params.depositAmount,
        params.maxPayment ?? amount,
      ],
    });
  }

  /**
   * Ask the chain what {@link buy} would do, WITHOUT sending it.
   *
   * A module's veto is a `view` revert carrying the module's own error —
   * `TenureNotElapsed(availableAt)`, not "execution reverted" — and that reason
   * is readable only from a simulation. Sent blind, the same veto arrives as a
   * MINED, reverted transaction whose receipt carries no reason at all, and the
   * best a UI can then say is "it failed", which is the least useful true thing
   * it could say.
   *
   * Throws on refusal, resolves on success. Costs one `eth_call`.
   */
  async simulateBuy(params: BuyParams): Promise<void> {
    const [currency, amount] = await Promise.all([
      this.currency(params.slot),
      this.quoteBuy(params.slot, params.account, params.depositAmount),
    ]);

    // An ERC-20 buy grants its allowance as part of SENDING, so simulating
    // before that has happened reverts on `ERC20InsufficientAllowance` every
    // time — a confident answer to a question nobody asked, and one that would
    // block a perfectly legal buy. There is nothing to learn from a simulation
    // run against a state the real call will not be made from, so it is skipped
    // rather than reported.
    if (!isNativeCurrency(currency)) {
      const [allowance, balance] = await Promise.all([
        this.publicClient.readContract({
          address: currency,
          abi: erc20Abi,
          functionName: "allowance",
          args: [this.account, params.slot],
        }),
        this.publicClient.readContract({
          address: currency,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [this.account],
        }),
      ]);

      // Balance is checked BEFORE the allowance skip below, and that ordering
      // is the whole point. Skipping the simulation for a missing allowance
      // also skipped this, so a buyer short on the token learned it as
      // `ERC20InsufficientBalance` from a mined, reverted transaction — a
      // selector, after paying gas, for something knowable up front. The
      // allowance is genuinely unknowable before sending because the approve
      // is part of the send; the balance never was.
      if (balance < amount) {
        throw new SlotsError(
          "buy",
          new Error(
            `insufficient balance: need ${amount} of ${currency}, hold ${balance}`,
          ),
        );
      }

      if (allowance < amount) return;
    }

    const maxPayment = params.maxPayment ?? amount;

    await this.publicClient.simulateContract({
      address: params.slot,
      abi: SIMULATION_ABI,
      functionName: "buy",
      args: [
        params.account,
        params.selfAssessedPrice,
        params.depositAmount,
        maxPayment,
      ],
      account: this.account,
      ...(isNativeCurrency(currency) ? { value: amount } : {}),
    } as never);
  }

  /** Give up the slot and take back what is left of your deposit. */
  release(slot: Address): Promise<Hash> {
    return this.write(slot, "release", []);
  }

  /**
   * Evict an occupant whose deposit is empty. Anyone may call.
   *
   * There is no bounty — the reward is the slot. Evicting without taking it
   * hands the vacancy to whoever is watching the mempool; see
   * {@link liquidateAndBuy}.
   */
  liquidate(slot: Address): Promise<Hash> {
    return this.write(slot, "liquidate", []);
  }

  /**
   * Evict an insolvent occupant and take the slot in one transaction, through
   * the slot's `multicall`. ERC-20 slots only: `multicall` is not payable, so a
   * native slot needs `liquidate` then `buy`.
   *
   * The vacated slot charges the deposit alone, and that figure is pinned as
   * `maxPayment`.
   */
  async liquidateAndBuy(params: BuyParams): Promise<Hash> {
    this.assertPositive(params.depositAmount, "depositAmount");
    this.assertPrice(params.selfAssessedPrice, "selfAssessedPrice");
    if (params.account === zeroAddress)
      throw new SlotsError("liquidateAndBuy", "account must not be the zero address");

    const [currency, insolvent] = await Promise.all([
      this.currency(params.slot),
      this.isInsolvent(params.slot),
    ]);
    if (isNativeCurrency(currency))
      throw new SlotsError(
        "liquidateAndBuy",
        "native slots cannot batch a payable buy; call liquidate, then buy",
      );
    if (!insolvent)
      throw new SlotsError("liquidateAndBuy", "the occupant is not insolvent");

    const amount = params.depositAmount;
    await this.ensureAllowance(currency, params.slot, amount);
    return this.write(params.slot, "multicall", [
      [
        encodeFunctionData({ abi: slotAbi, functionName: "liquidate" }),
        encodeFunctionData({
          abi: slotAbi,
          functionName: "buy",
          args: [
            params.account,
            params.selfAssessedPrice,
            params.depositAmount,
            params.maxPayment ?? amount,
          ],
        }),
      ],
    ]);
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

  /** Take back part of your escrow, keeping whatever `minRunwaySeconds` requires. */
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
  setOperator(
    slot: Address,
    operator: Address,
    allowed: boolean,
  ): Promise<Hash> {
    return this.write(slot, "setOperator", [operator, allowed]);
  }

  // ─── OfferBook ──────────────────────────────────────────────────────────────

  private bookRead<T>(functionName: string, args: readonly unknown[]) {
    return this.publicClient.readContract({
      address: this.offerBook,
      abi: offerBookAbi,
      functionName,
      args,
    } as never) as Promise<T>;
  }

  /**
   * A slot's live offers, the book's live count and its best funded offer, as
   * the book itself judges them. Filled, cancelled and expired offers are left
   * out by the book's own verdict, never recomputed here.
   */
  async offerBoard(slot: Address): Promise<OfferBoard> {
    // Paged, because the board only grows and every entry costs the book four
    // foreign reads to judge: a few thousand dust bids would put a whole-board
    // `board()` past the RPC's gas budget for ever. `best` and `liveCount` come
    // from the same pages rather than two more whole-board calls.
    const count = await this.bookRead<bigint>("offerCount", [slot]);
    const pages: Promise<readonly [readonly RawOffer[], readonly boolean[]]>[] = [];
    for (let start = 0n; start < count; start += BOARD_PAGE) {
      pages.push(
        this.bookRead<readonly [readonly RawOffer[], readonly boolean[]]>(
          "boardPage",
          [slot, start, BOARD_PAGE],
        ),
      );
    }

    const live: BookOffer[] = [];
    let id = 0n;
    for (const [list, isLive] of await Promise.all(pages)) {
      list.forEach((o, i) => {
        if (isLive[i] === true) live.push({ ...o, id: id + BigInt(i) });
      });
      id += BigInt(list.length);
    }

    // The book's own rule: the highest price, and the lowest id among equals —
    // `bestIn` only moves on a strictly higher price.
    let best: BookOffer | undefined;
    for (const o of live) if (!best || o.price > best.price) best = o;

    const offers = [...live].sort((a, b) =>
      b.price > a.price ? 1 : b.price < a.price ? -1 : 0,
    );
    return {
      offers,
      liveCount: BigInt(live.length),
      ...(best ? { best } : {}),
    };
  }

  /** One offer by id, whatever its state. */
  async offerAt(slot: Address, id: bigint): Promise<BookOffer> {
    const o = await this.bookRead<RawOffer>("offerAt", [slot, id]);
    return { ...o, id };
  }

  /** Whether the bidder's balance and allowance to the book still cover the offer. */
  isOfferFundable(slot: Address, id: bigint): Promise<boolean> {
    return this.bookRead<boolean>("isFundable", [slot, id]);
  }

  /**
   * What accepting an offer at `price` and `deposit` would pull from the
   * bidder: the price and the deposit. The bidder's allowance to the book must
   * cover it. `slot` and `bidder` are kept for callers written when a bidder's
   * debt was part of the cost; debt now ends with the tenure.
   */
  async offerCost(
    _slot: Address,
    _bidder: Address,
    price: bigint,
    deposit: bigint,
  ): Promise<bigint> {
    return price + deposit;
  }

  /**
   * Post or replace the connected account's standing bid on `slot`. Posting
   * moves nothing; the book pulls payment only when the occupant accepts, so
   * {@link approveOfferBook} for {@link offerCost} first or the offer is not
   * fundable. Replacing keeps the same id.
   */
  async postOffer(params: PostOfferParams): Promise<Hash> {
    this.assertPrice(params.price, "price");
    if (params.deposit < 0n)
      throw new SlotsError("postOffer", "deposit must not be negative");
    if (params.expiry <= BigInt(Math.floor(Date.now() / 1000)))
      throw new SlotsError("postOffer", "expiry must be in the future");
    return this.wallet.writeContract({
      address: this.offerBook,
      abi: offerBookAbi,
      functionName: "offer",
      args: [params.slot, params.price, params.deposit, params.expiry],
      account: this.account,
      chain: this.chain,
    });
  }

  /** Withdraw the connected account's offer. Bidder only. */
  cancelOffer(slot: Address, id: bigint): Promise<Hash> {
    return this.wallet.writeContract({
      address: this.offerBook,
      abi: offerBookAbi,
      functionName: "cancel",
      args: [slot, id],
      account: this.account,
      chain: this.chain,
    });
  }

  /**
   * Let the book pull up to `amount` of the slot's currency from the connected
   * account when an offer is accepted. Waits until the allowance is visible.
   */
  async approveOfferBook(slot: Address, amount: bigint): Promise<void> {
    this.assertPositive(amount, "amount");
    const currency = await this.currency(slot);
    if (isNativeCurrency(currency))
      throw new SlotsError("approveOfferBook", "the OfferBook does not trade native slots");
    await this.ensureAllowance(currency, this.offerBook, amount);
  }

  /**
   * Make the book the occupant's operator, so it can reprice the slot when an
   * offer is accepted. Lapses when the tenure ends.
   */
  authorizeOfferBook(slot: Address): Promise<Hash> {
    return this.setOperator(slot, this.offerBook, true);
  }

  /**
   * Sell the slot to a standing offer on the OfferBook. Occupant only, and the
   * book must be the occupant's operator ({@link setOperator}).
   *
   * `minPrice` is the price the seller reviewed. A bidder edits an offer in
   * place under the same id, so the fill reverts `PriceBelowMinimum` if the
   * offer has been lowered since. Pass the offer's price as it was shown.
   */
  async acceptOffer(slot: Address, id: bigint, minPrice: bigint): Promise<Hash> {
    this.assertPositive(minPrice, "minPrice");
    return this.wallet.writeContract({
      address: this.offerBook,
      abi: offerBookAbi,
      functionName: "acceptOffer",
      args: [slot, id, minPrice],
      account: this.account,
      chain: this.chain,
    });
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
   * Queue a change of terms. It lands at the next buy, never immediately —
   * the terms an occupant bought into hold for their whole tenure.
   *
   * Both dimensions travel in one call because they share one deferral and one
   * apply. Omit a field to leave it alone; pass `module: zeroAddress` to detach the
   * module, which is why presence rather than truthiness decides.
   */
  async proposeTerms(slot: Address, params: ProposeTermsParams): Promise<Hash> {
    const mask =
      (params.taxRateBps !== undefined ? TERMS.TAX_RATE : 0) |
      (params.recipient !== undefined ? TERMS.RECIPIENT : 0) |
      (params.minRunwaySeconds !== undefined ? TERMS.MIN_RUNWAY : 0) |
      (params.moduleTerms !== undefined ? TERMS.MODULE : 0);
    if (mask === 0)
      throw new SlotsError(
        "proposeTerms",
        "nothing to propose — pass taxRateBps, recipient, minRunwaySeconds or moduleTerms",
      );
    const taxTerms: TaxTerms = {
      recipient: params.recipient ?? zeroAddress,
      rateBps: params.taxRateBps ?? 0,
      minRunwaySeconds: params.minRunwaySeconds ?? 0,
    };
    assertTaxTerms(taxTerms, mask, "proposeTerms");
    const moduleTerms = fullModuleTerms(params.moduleTerms);
    if (mask & TERMS.MODULE) assertModule(moduleTerms, "proposeTerms");
    return this.write(slot, "proposeTerms", [taxTerms, moduleTerms, mask]);
  }

  /**
   * What the attached module declares today, beside what the slot copied, and
   * whether `acceptFee` / `acceptScopes` would change anything. Never throws
   * for a module that will not answer: `declared` is `null`.
   *
   * Asks the lens, so the answer is the contract's own.
   */
  async moduleUpdate(slot: Address): Promise<ModuleUpdate> {
    const u = await this.readLens<{
      currentScopes: number;
      currentFee: ModuleFee;
      answered: boolean;
      declaredScopes: number;
      declaredFee: ModuleFee;
      feeDiffers: boolean;
      scopesDiffer: boolean;
    }>("moduleUpdate", [slot]);
    return {
      current: { scopes: u.currentScopes, fee: u.currentFee },
      declared: u.answered ? { scopes: u.declaredScopes, fee: u.declaredFee } : null,
      feeDiffers: u.feeDiffers,
      scopesDiffer: u.scopesDiffer,
    };
  }

  /**
   * Accept the fee the attached module declares today. Manager only. Applies
   * at once; tax collected so far is paid out at the old fee first. `expected`
   * is the fee the manager reviewed: the call reverts `FeeChanged` if the
   * module declares anything else by then, `NothingToAccept` if it is the
   * current fee, `NotMutable` for a rise or a new fee recipient on a slot with
   * a fixed recipient, and `DebtOutstanding` while the occupant owes debt.
   */
  async acceptFee(slot: Address, expected: ModuleFee): Promise<Hash> {
    return this.write(slot, "acceptFee", [expected]);
  }

  /**
   * Accept the scopes the attached module declares today. Manager only. They
   * queue and land at the next buy, only when the slot's module is mutable.
   * Reverts `ScopesChanged` if the module declares anything else by then, and
   * `ModuleChangeQueued` while a new module is queued.
   */
  async acceptScopes(slot: Address, expected: number): Promise<Hash> {
    return this.write(slot, "acceptScopes", [expected]);
  }

  /**
   * Land ripe queued terms now, without waiting for a buy. The occupant's call
   * while the slot is held; anyone's once it is vacant. Reverts
   * `NoPendingTerms` when nothing is ripe and `DebtOutstanding` while the
   * occupant owes debt — a top-up pays it off first.
   */
  async applyTerms(slot: Address): Promise<Hash> {
    return this.write(slot, "applyTerms", []);
  }

  /** Hand the slot to another manager, immediately. Manager only. */
  async setManager(slot: Address, manager: Address): Promise<Hash> {
    if (manager === zeroAddress)
      throw new SlotsError("setManager", "manager cannot be zero");
    return this.write(slot, "setManager", [manager]);
  }

  /**
   * Retract queued terms. Manager only.
   *
   * Clears whichever of `mask` is queued and leaves the rest, so one party
   * retracting their change never erases another's. Defaults to everything.
   */
  async cancelTerms(slot: Address, mask: number = ALL_TERMS): Promise<Hash> {
    if (mask === 0)
      throw new SlotsError("cancelTerms", "nothing to cancel — pass a mask");
    return this.write(slot, "cancelTerms", [mask]);
  }

  /**
   * Reprice and refund the deposit in one submission.
   *
   * ── Why these are not three independent calls ────────────────────────────
   *
   * Because the contract does not treat them as independent. `selfAssess` ends
   * with `_requireFunded(_deposit, newPrice)`, so the deposit still standing
   * after settlement has to cover the minimum at the NEW price — raising your
   * valuation, the most ordinary thing an occupant wants to do, reverts with
   * the funding error unless the deposit was already large enough. `withdraw`
   * is the same coupling from the other side: it refuses to leave the deposit
   * under the minimum at the current price, so how much may be taken back is a
   * function of the valuation, and LOWERING the valuation is precisely what
   * frees deposit to take.
   *
   * ── The order is load-bearing ────────────────────────────────────────────
   *
   * topUp → selfAssess → withdraw, which is the only order satisfying both
   * checks. Funding first is what lets a price RISE pass `_requireFunded`;
   * repricing before the withdrawal is what lets a price CUT release the
   * deposit it just freed. Reversed, each half fails in exactly the case it was
   * added for.
   *
   * ── Why a native top-up is its own transaction ───────────────────────────
   *
   * `multicall` is non-payable, so `msg.value` is zero inside it and a native
   * `topUp` would revert `InvalidValue`. Making it payable would be worse: every
   * delegatecall sees the SAME `msg.value`, so one ETH payment would satisfy two
   * calls and the second would be funded out of the contract's own balance. So
   * on a native slot a top-up goes first and alone, and the caller is told to
   * expect two confirmations.
   *
   * @returns The hash of the final transaction — the one carrying the reprice.
   */
  async manageTerms(
    slot: Address,
    params: {
      /** Omit to leave the price alone. */
      newPrice?: bigint;
      topUpAmount?: bigint;
      withdrawAmount?: bigint;
    },
  ): Promise<Hash> {
    const topUpAmount = params.topUpAmount ?? 0n;
    const withdrawAmount = params.withdrawAmount ?? 0n;
    const { newPrice } = params;

    if (newPrice !== undefined) this.assertPrice(newPrice, "newPrice");
    if (topUpAmount > 0n && withdrawAmount > 0n)
      throw new SlotsError(
        "manageTerms",
        "cannot add to and take from the deposit in the same submission",
      );
    if (newPrice === undefined && topUpAmount === 0n && withdrawAmount === 0n)
      throw new SlotsError("manageTerms", "nothing to do");

    const currency = await this.currency(slot);
    const native = isNativeCurrency(currency);
    const calls: {
      functionName: "topUp" | "selfAssess" | "withdraw";
      args: readonly unknown[];
    }[] = [];

    if (topUpAmount > 0n) {
      if (native) {
        // Alone, with value, and awaited — the reprice below depends on the
        // deposit it lands, so racing them would fail the funding check.
        const hash = await this.write(
          slot,
          "topUp",
          [topUpAmount],
          topUpAmount,
        );
        await this.publicClient.waitForTransactionReceipt({ hash });
        if (newPrice === undefined) return hash;
      } else {
        await this.ensureAllowance(currency, slot, topUpAmount);
        calls.push({ functionName: "topUp", args: [topUpAmount] });
      }
    }

    if (newPrice !== undefined)
      calls.push({ functionName: "selfAssess", args: [newPrice] });

    if (withdrawAmount > 0n)
      calls.push({ functionName: "withdraw", args: [withdrawAmount] });

    // One call needs no batching wrapper, and sending it bare keeps the revert
    // reason attributable to the function that produced it rather than to
    // `multicall` — which is the difference between "InvalidDeposit" and "the
    // batch failed".
    if (calls.length === 1)
      return this.write(slot, calls[0].functionName, calls[0].args);

    return this.write(slot, "multicall", [
      calls.map((c) =>
        encodeFunctionData({
          abi: slotAbi,
          functionName: c.functionName,
          args: c.args as never,
        }),
      ),
    ]);
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
      functionName: "buy" | "topUp";
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

    /**
     * The same question, asked of the node that decides whether the NEXT
     * transaction looks like it will work.
     *
     * The poll above proves the approve is visible on `publicClient` — the
     * module's own RPC. The buy that follows is submitted through the WALLET,
     * and a wallet estimates gas against its own provider: MetaMask's Infura,
     * not ours. Two nodes, two views, and the approve reaches them at
     * different moments.
     *
     * When the wallet's node is the slower one it simulates the buy against a
     * state with no allowance, the simulation reverts, and the user is shown
     * "this transaction will probably fail" for a transaction that is
     * perfectly good — which is why waiting a few seconds and retrying works,
     * and why it looked like the wallet's bug. Nothing was wrong except which
     * node had been asked.
     *
     * Best-effort by construction. A wallet that will not answer `eth_call`
     * returns null and this stops rather than blocking a buy on a diagnostic:
     * the allowance is already confirmed on a node we trust, and this is only
     * about what the wallet is about to believe.
     */
    await this.pollUntil(
      () => this.allowanceAsWalletSeesIt(currency, spender),
      (value) => value === null || value >= amount,
    );
  }

  /**
   * `allowance()` read through the wallet's own transport.
   *
   * `this.wallet.request` goes to the injected provider, so this is answered by
   * whichever node the wallet uses — the point of the exercise. Null for a
   * wallet that refuses the call or answers something that is not a quantity;
   * no caller treats that as a failure.
   */
  private async allowanceAsWalletSeesIt(
    currency: Address,
    spender: Address,
  ): Promise<bigint | null> {
    try {
      const result = await this.wallet.request({
        method: "eth_call",
        params: [
          {
            to: currency,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: "allowance",
              args: [this.account, spender],
            }),
          },
          "latest",
        ],
      } as Parameters<typeof this.wallet.request>[0]);
      return typeof result === "string" ? BigInt(result) : null;
    } catch {
      return null;
    }
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

/** `pending()` as viem decodes it. */
interface PendingResult {
  taxTerms: TaxTerms;
  nextModule: InstalledModuleResult;
  mask: number;
  proposedAt: bigint;
}

/** `InstalledModule` as viem decodes it. */
interface InstalledModuleResult {
  module: Address;
  scopes: number;
  fee: ModuleFee;
  settings: Hex;
}

/** `SlotLens.getSlotInfo` as the client hands it out. */
function toSlotState(i: SlotInfoResult): SlotState {
  return {
    occupant: i.occupant,
    price: i.price,
    deposit: i.deposit,
    taxOwed: i.taxOwed,
    isVacant: i.isVacant,
    isInsolvent: i.isInsolvent,
    secondsUntilLiquidation: i.secondsUntilLiquidation,
    currency: i.currency,
    taxRateBps: BigInt(i.terms.taxTerms.rateBps),
    minRunwaySeconds: BigInt(i.terms.taxTerms.minRunwaySeconds),
    recipient: i.terms.taxTerms.recipient,
    manager: i.manager,
    mutableTax: i.mutableTax,
    mutableRecipient: i.mutableRecipient,
    mutableModule: i.mutableModule,
    module: i.terms.moduleTerms.module,
    settings: i.terms.moduleTerms.settings,
    scopes: i.scopes,
    fee: i.fee,
    pending: toPending(i.pending, i.hasRipeTerms),
    occupiedSince: i.occupiedSince,
    lastSettled: i.lastSettled,
    collectedTax: i.collectedTax,
    tenureId: i.tenureId,
  };
}

/** `SlotLens.getSlotInfo` as viem decodes it. */
interface SlotInfoResult {
  currency: Address;
  manager: Address;
  mutableTax: boolean;
  mutableRecipient: boolean;
  mutableModule: boolean;
  terms: { taxTerms: TaxTerms; moduleTerms: ModuleTerms };
  scopes: Scopes;
  fee: ModuleFee;
  occupant: Address;
  price: bigint;
  deposit: bigint;
  occupiedSince: bigint;
  tenureId: bigint;
  lastSettled: bigint;
  taxOwed: bigint;
  collectedTax: bigint;
  isVacant: boolean;
  isInsolvent: boolean;
  secondsUntilLiquidation: bigint;
  pending: PendingResult;
  hasRipeTerms: boolean;
}

function toPending(p: PendingResult, ripe: boolean): Pending {
  const isEmpty = p.mask === 0;
  return {
    taxTerms: p.taxTerms,
    moduleTerms: { module: p.nextModule.module, settings: p.nextModule.settings },
    scopes: p.nextModule.scopes,
    fee: p.nextModule.fee,
    mask: p.mask,
    hasTaxRate: (p.mask & TERMS.TAX_RATE) !== 0,
    hasRecipient: (p.mask & TERMS.RECIPIENT) !== 0,
    hasMinRunway: (p.mask & TERMS.MIN_RUNWAY) !== 0,
    hasModule: (p.mask & TERMS.MODULE) !== 0,
    hasScopes: (p.mask & TERMS.SCOPES) !== 0,
    proposedAt: p.proposedAt,
    appliesAt: isEmpty ? 0n : p.proposedAt + TERMS_DELAY_SECONDS,
    applies: ripe,
    isEmpty,
  };
}
