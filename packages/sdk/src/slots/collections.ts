import {
  slotBoundNftAbi,
  slotBoundNftFactoryAbi,
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

import { BASIS_POINTS, MONTH_SECONDS } from "./client";
import { SlotsError } from "../errors";
import { isNativeCurrency } from "../native";

/**
 * Slot-bound NFT collections.
 *
 * A collection mints one slot per token and the token follows its occupancy, so
 * "buying an NFT" here is buying the slot — an ordinary `Slot.buy`, which the
 * slots client already does. What this file adds is everything upstream of
 * that: creating a collection, minting into one, and the reads a marketplace
 * needs to render one.
 *
 * Kept apart from `SlotsClient` on purpose. The collection is a hook, not a
 * protocol surface, and an app that never touches NFTs should not carry it.
 */

/** Everything a collection is fixed with. Mirrors `CollectionInit`. */
export interface CollectionInit {
  name: string;
  symbol: string;
  maxSupply: bigint;
  /** Zero address for native ETH. */
  currency: Address;
  /** Rent per 30 days, in basis points of the valuation. */
  taxBps: bigint;
  /** The runway a mint must fund. Must be non-zero. */
  minDepositSeconds: bigint;
  recipient: Address;
  /** May change the rent, on the slots directly. Zero fixes it forever. */
  manager: Address;
  /** Holds the metadata, and nothing else. */
  owner: Address;
}

/** The terms every slot in a collection is created with. */
export interface CollectionTerms {
  recipient: Address;
  currency: Address;
  manager: Address;
  hook: Address;
  taxBps: bigint;
  minDepositSeconds: bigint;
  mutableTax: boolean;
  mutableHook: boolean;
}

/** What a mint costs, and where each half goes. */
export interface MintQuote {
  /** The number to send. `price + deposit`. */
  total: bigint;
  /** Goes to the recipient, and is gone. */
  price: bigint;
  /** Escrow the minter still owns, held by the slot. */
  deposit: bigint;
}

export interface CollectionSummary {
  address: Address;
  name: string;
  symbol: string;
  maxSupply: bigint;
  totalMinted: bigint;
  owner: Address;
  baseURI: string;
  terms: CollectionTerms;
}

export interface CollectionsClientConfig {
  publicClient?: PublicClient;
  walletClient?: WalletClient;
  /** The `SlotBoundNFTFactory` for this chain. */
  factoryAddress?: Address;
}

/**
 * Reads and writes for slot-bound collections.
 *
 * Buying a token is NOT here: it is `SlotsClient.buy` against the token's slot,
 * because that is genuinely all it is. Duplicating it would give a marketplace
 * two ways to do the same thing and one of them would drift.
 */
export class CollectionsClient {
  private readonly _publicClient?: PublicClient;
  private readonly _walletClient?: WalletClient;
  private readonly _factory?: Address;

  constructor(config: CollectionsClientConfig) {
    this._publicClient = config.publicClient;
    this._walletClient = config.walletClient;
    this._factory = config.factoryAddress;
  }

  private get publicClient(): PublicClient {
    if (!this._publicClient)
      throw new SlotsError("CollectionsClient", "No publicClient provided");
    return this._publicClient;
  }

  private get wallet(): WalletClient {
    if (!this._walletClient)
      throw new SlotsError("CollectionsClient", "No walletClient provided");
    return this._walletClient;
  }

  private get factory(): Address {
    if (!this._factory)
      throw new SlotsError("CollectionsClient", "No factoryAddress provided");
    return this._factory;
  }

  private get account(): Address {
    const account = this.wallet.account;
    if (!account)
      throw new SlotsError(
        "CollectionsClient",
        "WalletClient must have an account",
      );
    return account.address;
  }

  private get chain(): Chain {
    const chain = this.wallet.chain;
    if (!chain)
      throw new SlotsError(
        "CollectionsClient",
        "WalletClient must have a chain",
      );
    return chain;
  }

  private read<T>(
    collection: Address,
    functionName: string,
    args?: readonly unknown[],
  ) {
    return this.publicClient.readContract({
      address: collection,
      abi: slotBoundNftAbi,
      functionName,
      ...(args ? { args } : {}),
    } as never) as Promise<T>;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // READ
  // ═══════════════════════════════════════════════════════════════════════════

  /** Everything a collection page needs, in one call. */
  async collection(address: Address): Promise<CollectionSummary> {
    const [name, symbol, maxSupply, totalMinted, owner, baseURI, terms] =
      await Promise.all([
        this.read<string>(address, "name"),
        this.read<string>(address, "symbol"),
        this.read<bigint>(address, "MAX_SUPPLY"),
        this.read<bigint>(address, "totalMinted"),
        this.read<Address>(address, "owner"),
        this.read<string>(address, "baseURI"),
        this.read<CollectionTerms>(address, "terms"),
      ]);
    return { address, name, symbol, maxSupply, totalMinted, owner, baseURI, terms };
  }

  /**
   * What minting at `valuation` costs, and how it splits.
   *
   * Read from the collection rather than computed here. The number a wallet is
   * about to send should come from the contract that will check it.
   */
  async quoteMint(collection: Address, valuation: bigint): Promise<MintQuote> {
    const [total, price, deposit] = await this.read<
      readonly [bigint, bigint, bigint]
    >(collection, "quoteMint", [valuation]);
    return { total, price, deposit };
  }

  /** The slot a token follows. Its occupancy IS the token's ownership. */
  slotOf(collection: Address, tokenId: bigint): Promise<Address> {
    return this.read<Address>(collection, "slotOf", [tokenId]);
  }

  /** The token following a slot. Zero when the slot is not this collection's. */
  tokenOf(collection: Address, slot: Address): Promise<bigint> {
    return this.read<bigint>(collection, "tokenOf", [slot]);
  }

  ownerOf(collection: Address, tokenId: bigint): Promise<Address> {
    return this.read<Address>(collection, "ownerOf", [tokenId]);
  }

  tokenURI(collection: Address, tokenId: bigint): Promise<string> {
    return this.read<string>(collection, "tokenURI", [tokenId]);
  }

  /** The token's slot state — price, occupant, escrow, runway. */
  getSlotInfoOf(collection: Address, tokenId: bigint) {
    return this.read(collection, "getSlotInfoOf", [tokenId]);
  }

  isCollection(address: Address): Promise<boolean> {
    return this.publicClient.readContract({
      address: this.factory,
      abi: slotBoundNftFactoryAbi,
      functionName: "isCollection",
      args: [address],
    }) as Promise<boolean>;
  }

  collectionCount(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.factory,
      abi: slotBoundNftFactoryAbi,
      functionName: "collectionCount",
    }) as Promise<bigint>;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WRITE
  // ═══════════════════════════════════════════════════════════════════════════

  /** Deploy a collection. Its terms are fixed from that moment. */
  async createCollection(init: CollectionInit): Promise<Hash> {
    assertCollectionInit(init);
    return this.wallet.writeContract({
      address: this.factory,
      abi: slotBoundNftFactoryAbi,
      functionName: "createCollection",
      args: [encodeCollectionInit(init)],
      account: this.account,
      chain: this.chain,
    } as never);
  }

  /**
   * Mint at `valuation`, seating yourself in the new slot.
   *
   * Native collections send {@link MintQuote.total}; ERC-20 collections need an
   * allowance to the COLLECTION first — see {@link approveMint}.
   */
  async mint(collection: Address, valuation: bigint): Promise<Hash> {
    if (valuation <= 0n)
      throw new SlotsError("mint", "valuation must be > 0");

    const [{ total }, terms] = await Promise.all([
      this.quoteMint(collection, valuation),
      this.read<CollectionTerms>(collection, "terms"),
    ]);

    return this.wallet.writeContract({
      address: collection,
      abi: slotBoundNftAbi,
      functionName: "mint",
      args: [valuation],
      account: this.account,
      chain: this.chain,
      ...(isNativeCurrency(terms.currency) ? { value: total } : {}),
    } as never);
  }

  /**
   * Approve the COLLECTION — not the slot — for an ERC-20 mint.
   *
   * `mint` pulls the whole `total` to itself before splitting it, so the
   * allowance belongs to the collection. Approving the slot is the natural
   * mistake and leaves the mint reverting on a transfer nobody expected.
   */
  async approveMint(collection: Address, valuation: bigint): Promise<Hash> {
    const [{ total }, terms] = await Promise.all([
      this.quoteMint(collection, valuation),
      this.read<CollectionTerms>(collection, "terms"),
    ]);
    if (isNativeCurrency(terms.currency))
      throw new SlotsError("approveMint", "collection is native; no approval");

    return this.wallet.writeContract({
      address: terms.currency,
      abi: erc20Abi,
      functionName: "approve",
      args: [collection, total],
      account: this.account,
      chain: this.chain,
    } as never);
  }
}

/**
 * The escrow a buy at `price` must post to fund `window` seconds.
 *
 * `SlotMath.depositFor`, in TypeScript. Duplicated because a UI quoting terms
 * for a collection that does not exist yet has nothing to ask — and rounding
 * matters: the contract rounds UP, and rounding down is what let a short window
 * on a low price be funded with nothing.
 *
 * Pinned against the contract's own output in the tests. Anything rendering a
 * number a minter will be charged should use this rather than reimplementing it
 * a third time.
 */
export function depositFor(
  price: bigint,
  taxBps: bigint,
  window: bigint,
): bigint {
  if (window === 0n) return 0n;
  const den = MONTH_SECONDS * BASIS_POINTS;
  const num = price * taxBps * window;
  return num === 0n ? 0n : (num + den - 1n) / den; // ceil
}

/** Throw on the initialisations the factory would refuse, before spending gas. */
export function assertCollectionInit(init: CollectionInit): void {
  if (init.maxSupply <= 0n)
    throw new SlotsError("createCollection", "maxSupply must be > 0");
  if (init.minDepositSeconds <= 0n)
    throw new SlotsError(
      "createCollection",
      "minDepositSeconds must be > 0, or every mint is instantly liquidatable",
    );
  if (init.taxBps <= 0n || init.taxBps > 10_000n)
    throw new SlotsError("createCollection", "taxBps must be 1..10000");
  if (init.recipient === zeroAddress)
    throw new SlotsError("createCollection", "recipient must not be zero");
  if (init.owner === zeroAddress)
    throw new SlotsError("createCollection", "owner must not be zero");
}

/**
 * Build the tuple the factory expects.
 *
 * viem encodes a struct BY COMPONENT NAME, so a stray or misspelled key encodes
 * a zero for the field it meant to fill and says nothing about it. Listing the
 * nine here makes a missing one a type error in this file.
 */
function encodeCollectionInit(init: CollectionInit) {
  return {
    name: init.name,
    symbol: init.symbol,
    maxSupply: init.maxSupply,
    currency: init.currency,
    taxBps: init.taxBps,
    minDepositSeconds: init.minDepositSeconds,
    recipient: init.recipient,
    manager: init.manager,
    owner: init.owner,
  } as const;
}

export function createCollectionsClient(
  config: CollectionsClientConfig,
): CollectionsClient {
  return new CollectionsClient(config);
}
