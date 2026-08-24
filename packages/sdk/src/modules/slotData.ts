import { slotDataAbi } from "@0xslots/contracts";
import {
  type Address,
  type Chain,
  encodeAbiParameters,
  type Hash,
  type Hex,
  parseAbiParameters,
  type WalletClient,
} from "viem";
import { SlotsError } from "../errors";

/**
 * SlotData — register a shape, write bytes against it.
 *
 * Accessible via `client.modules.slotData`.
 *
 * The module namespace with the least in it, deliberately. SlotData's whole
 * argument is that a slot's data layer should not need a bespoke client per
 * application: the schema is a string on chain, so encoding and decoding are
 * generic and an app that invents a service tomorrow calls the same two methods
 * as one that shipped a year ago. Anything schema-aware belongs above this.
 */
export class SlotDataClient {
  private readonly _walletClient?: WalletClient;

  constructor(opts: { walletClient?: WalletClient }) {
    this._walletClient = opts.walletClient;
  }

  private get wallet(): WalletClient {
    if (!this._walletClient)
      throw new SlotsError("slotData", "No walletClient provided");
    return this._walletClient;
  }

  private get account(): Address {
    const account = this.wallet.account;
    if (!account)
      throw new SlotsError("slotData", "WalletClient must have an account");
    return account.address;
  }

  private get chain(): Chain {
    const chain = this.wallet.chain;
    if (!chain)
      throw new SlotsError("slotData", "WalletClient must have a chain");
    return chain;
  }

  /**
   * Register a kind of data. Anyone may do this — there is no allowlist.
   *
   * `schema` is an ABI signature such as `"string uri"` and is NOT validated on
   * chain, so it is checked here instead: `parseAbiParameters` throws on a
   * malformed one, which turns an unusable service into a rejected form rather
   * than a permanent row nobody can decode. This is a courtesy, not a
   * guarantee — the contract will happily accept whatever anyone sends it
   * directly, and readers must still expect to fail.
   */
  async registerService(
    moduleAddress: Address,
    params: { schema: string; name: string; metadataURI?: string },
  ): Promise<Hash> {
    try {
      parseAbiParameters(params.schema);
    } catch {
      throw new SlotsError(
        "slotData",
        `"${params.schema}" is not a readable ABI signature. Expected something like "string uri" or "string text,string[] medias".`,
      );
    }

    return this.wallet.writeContract({
      address: moduleAddress,
      abi: slotDataAbi,
      functionName: "registerService",
      args: [params.schema, params.name, params.metadataURI ?? ""],
      account: this.account,
      chain: this.chain,
    });
  }

  /** Attach raw bytes to a slot. Reverts unless you currently occupy it. */
  async write(
    moduleAddress: Address,
    params: { slot: Address; serviceId: bigint; data: Hex },
  ): Promise<Hash> {
    return this.wallet.writeContract({
      address: moduleAddress,
      abi: slotDataAbi,
      functionName: "write",
      args: [params.slot, params.serviceId, params.data],
      account: this.account,
      chain: this.chain,
    });
  }

  /**
   * Encode values against a schema and write them.
   *
   * The pairing that makes the registry usable: a caller holds the values, the
   * chain holds the shape, and neither has to know the other in advance.
   */
  async writeValues(
    moduleAddress: Address,
    params: {
      slot: Address;
      serviceId: bigint;
      schema: string;
      values: readonly unknown[];
    },
  ): Promise<Hash> {
    return this.write(moduleAddress, {
      slot: params.slot,
      serviceId: params.serviceId,
      data: encodeValues(params.schema, params.values),
    });
  }

  /**
   * Several services in one transaction.
   *
   * The direct payoff of one utility carrying many services, and the reason a
   * slot no longer has to choose between an ad module and a feed module: an app
   * spanning three of them publishes once.
   */
  async writeMany(
    moduleAddress: Address,
    params: { slot: Address; serviceIds: bigint[]; datas: Hex[] },
  ): Promise<Hash> {
    if (params.serviceIds.length !== params.datas.length) {
      throw new SlotsError(
        "slotData",
        `writeMany needs one payload per service — got ${params.serviceIds.length} ids and ${params.datas.length} payloads.`,
      );
    }
    return this.wallet.writeContract({
      address: moduleAddress,
      abi: slotDataAbi,
      functionName: "writeMany",
      args: [params.slot, params.serviceIds, params.datas],
      account: this.account,
      chain: this.chain,
    });
  }
}

/** ABI-encode `values` against an on-chain schema string. */
export function encodeValues(schema: string, values: readonly unknown[]): Hex {
  return encodeAbiParameters(parseAbiParameters(schema), values as never[]);
}
