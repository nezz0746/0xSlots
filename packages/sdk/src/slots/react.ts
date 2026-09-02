"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Address, Hash } from "viem";
import {
  usePublicClient,
  useWaitForTransactionReceipt,
  useWalletClient,
} from "wagmi";
import type {
  BuyParams,
  ProposeTermsParams,
  SellOrder,
  SignedSellOrder,
  SignSellOrderParams,
  SlotInit,
} from "./client";
import { SlotsClient } from "./client";

// ─── Client ───────────────────────────────────────────────────────────────────

export interface UseSlotsClientConfig {
  /**
   * The hook-protocol `SlotFactory`.
   *
   * Passed in rather than looked up: there is no address registry for this
   * factory yet, and a hook that silently resolved the PREVIOUS protocol's
   * factory would deploy the wrong kind of slot without complaining.
   */
  factoryAddress?: Address;
  /** Chain override. Defaults to the connected chain. */
  chainId?: number;
}

/** A memoized {@link SlotsClient} built from wagmi's public and wallet clients. */
export function useSlotsClient(config: UseSlotsClientConfig = {}): SlotsClient {
  const publicClient = usePublicClient({ chainId: config.chainId });
  const { data: walletClient } = useWalletClient({ chainId: config.chainId });

  return useMemo(
    () =>
      new SlotsClient({
        factoryAddress: config.factoryAddress,
        publicClient: publicClient ?? undefined,
        walletClient: walletClient ?? undefined,
      }),
    [config.factoryAddress, publicClient, walletClient],
  );
}

// ─── Actions ──────────────────────────────────────────────────────────────────

/**
 * The custom error a revert actually carried, if viem could decode one.
 *
 * viem puts the decoded error on a `ContractFunctionRevertedError` several
 * links down the cause chain, and leaves `shortMessage` at the useless
 * `The contract function "buy" reverted.` — so a hook's `TenureNotElapsed`
 * reads identically to running out of gas unless this is dug out. Walks the
 * chain rather than reaching for a fixed depth, because how deep it sits
 * depends on whether the call was a simulation or a send.
 */
function decodedRevert(error: unknown): string | undefined {
  let node = error as Record<string, unknown> | undefined;
  for (let depth = 0; node && typeof node === "object" && depth < 8; depth++) {
    const data = node.data as Record<string, unknown> | undefined;
    if (data && typeof data.errorName === "string") {
      const args = Array.isArray(data.args) ? data.args : [];
      return args.length
        ? `${data.errorName}(${args.map((a) => String(a)).join(", ")})`
        : data.errorName;
    }
    node = node.cause as Record<string, unknown> | undefined;
  }
  return undefined;
}

/**
 * Reverts whose SELECTOR is not the useful part of the answer.
 *
 * The rule is still "show the contract's own error", because it names what
 * refused. These are the cases where the name alone leaves the reader with
 * nothing to do next, so the name is replaced by what happened.
 *
 * `PaymentAboveMax` is the one that matters. It means the total moved above the
 * ceiling the client sent — which is only possible because the sitting price is
 * read at EXECUTION, so the occupant raised it between the quote and inclusion.
 * That is the ceiling working: the alternative was paying the new price out of
 * the allowance, silently. A buyer told "PaymentAboveMax" learns nothing; a
 * buyer told the price moved knows to look at it again.
 */
const NAMED_REVERTS: Record<string, string> = {
  PaymentAboveMax:
    "The price moved before this landed. It went above the total you were quoted, so nothing was charged — check the new price and try again.",
  NotInsolvent:
    "The occupant is not insolvent — their deposit still covers what they owe, so there is nothing to evict.",
  CannotBuyFromYourself:
    "That address already holds this slot. Reprice instead of buying it from yourself.",
};

function extractErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("User rejected") || message.includes("User denied"))
    return "Transaction rejected";

  // The decoded custom error first: it names WHAT refused, which is the only
  // part a reader can act on.
  const decoded = decodedRevert(error);
  if (decoded) return NAMED_REVERTS[decoded] ?? decoded;

  // viem ContractFunctionExecutionError: prefer the shortMessage or reason.
  // A hook's veto arrives here — `_before` bubbles the hook's own revert reason
  // rather than "call failed", and this is where that pays off.
  const err = error as Record<string, unknown> | undefined;
  if (err && typeof err === "object") {
    if (typeof err.shortMessage === "string") return err.shortMessage;
    const cause = err.cause as Record<string, unknown> | undefined;
    if (cause && typeof cause.shortMessage === "string")
      return cause.shortMessage;
    if (cause && typeof cause.reason === "string") return cause.reason;
  }

  return message.split("\n")[0] || "Transaction failed";
}

export interface SlotActionCallbacks extends UseSlotsClientConfig {
  onSuccess?: (label: string, hash: Hash) => void;
  onError?: (label: string, error: string) => void;
}

/**
 * Every write on a slot, wrapped in shared pending/receipt tracking.
 *
 * Failures are reported through `onError` rather than thrown, so a single action
 * needs no try/catch at the call site. Actions return the hash, or `undefined`
 * when they failed — which is what a multi-step flow must check before it
 * continues.
 */
export function useSlotAction(opts: SlotActionCallbacks = {}) {
  const client = useSlotsClient(opts);

  const [hash, setHash] = useState<Hash | undefined>();
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const labelRef = useRef<string>("");

  const {
    isLoading: isConfirming,
    isSuccess,
    isError,
  } = useWaitForTransactionReceipt({ hash });

  const busy = isPending || isConfirming;

  useEffect(() => {
    if (isSuccess && labelRef.current) {
      opts.onSuccess?.(labelRef.current, hash!);
      setActiveAction(null);
      labelRef.current = "";
    }
  }, [isSuccess]);

  useEffect(() => {
    if (isError && labelRef.current) {
      opts.onError?.(labelRef.current, `${labelRef.current} failed on-chain`);
      setActiveAction(null);
      labelRef.current = "";
    }
  }, [isError]);

  useEffect(() => {
    if (!isPending && !isConfirming && !isSuccess && !isError)
      setActiveAction(null);
  }, [isPending, isConfirming, isSuccess, isError]);

  const exec = useCallback(
    async (
      label: string,
      fn: () => Promise<Hash>,
    ): Promise<Hash | undefined> => {
      labelRef.current = label;
      setActiveAction(label);
      setIsPending(true);
      setHash(undefined);
      try {
        const txHash = await fn();
        setHash(txHash);
        return txHash;
      } catch (error) {
        console.error(`[useSlotAction] ${label} failed:`, error);
        setActiveAction(null);
        labelRef.current = "";
        opts.onError?.(label, extractErrorMessage(error));
        return undefined;
      } finally {
        setIsPending(false);
      }
    },
    [opts.onError],
  );

  /**
   * Run something that is not a transaction — a read, or a signature — and
   * report its failure the way `exec` reports a failed transaction.
   *
   * Signing goes through here rather than `exec` because there is no hash and no
   * receipt to wait on. Without it a rejected signature prompt rejects a promise
   * nobody is listening to, and the button just sits there looking alive.
   */
  const preflight = useCallback(
    async <T>(label: string, fn: () => Promise<T>): Promise<T | undefined> => {
      try {
        return await fn();
      } catch (error) {
        console.error(`[useSlotAction] ${label} failed:`, error);
        setActiveAction(null);
        labelRef.current = "";
        opts.onError?.(label, extractErrorMessage(error));
        return undefined;
      }
    },
    [opts.onError],
  );

  // ─── Factory ──────────────────────────────────────────────────────────────

  const createSlot = useCallback(
    (init: SlotInit) => exec("Create slot", () => client.createSlot(init)),
    [exec, client],
  );

  // ─── Occupancy ────────────────────────────────────────────────────────────

  const buy = useCallback(
    (params: BuyParams) => exec("Buy slot", () => client.buy(params)),
    [exec, client],
  );
  const sell = useCallback(
    (slot: Address, order: SellOrder, signature: `0x${string}`) =>
      exec("Sell slot", () => client.sell(slot, order, signature)),
    [exec, client],
  );
  const release = useCallback(
    (slot: Address) => exec("Release slot", () => client.release(slot)),
    [exec, client],
  );
  const liquidate = useCallback(
    (slot: Address) => exec("Liquidate", () => client.liquidate(slot)),
    [exec, client],
  );

  // ─── Holding ──────────────────────────────────────────────────────────────

  const selfAssess = useCallback(
    (slot: Address, newPrice: bigint) =>
      exec("Set price", () => client.selfAssess(slot, newPrice)),
    [exec, client],
  );
  const topUp = useCallback(
    (slot: Address, amount: bigint) =>
      exec("Top up", () => client.topUp(slot, amount)),
    [exec, client],
  );
  const withdraw = useCallback(
    (slot: Address, amount: bigint) =>
      exec("Withdraw", () => client.withdraw(slot, amount)),
    [exec, client],
  );
  /**
   * Reprice and move the deposit as one submission.
   *
   * One label for what may be two wallet prompts on a native slot, because it
   * is one intention — the panel says how many confirmations to expect rather
   * than pretending the second one is a separate action.
   */
  const manageTerms = useCallback(
    (
      slot: Address,
      params: {
        newPrice?: bigint;
        topUpAmount?: bigint;
        withdrawAmount?: bigint;
      },
    ) => exec("Update terms", () => client.manageTerms(slot, params)),
    [exec, client],
  );
  /**
   * Labelled by direction rather than one "Set operator" for both: the row that
   * calls this shows a spinner next to the label, and "Set operator" spinning
   * beside an operator you just revoked reads as the opposite of what happened.
   */
  const setOperator = useCallback(
    (slot: Address, operator: Address, allowed: boolean) =>
      exec(allowed ? "Add operator" : "Remove operator", () =>
        client.setOperator(slot, operator, allowed),
      ),
    [exec, client],
  );

  // ─── Money out ────────────────────────────────────────────────────────────

  const collect = useCallback(
    (slot: Address) => exec("Collect tax", () => client.collect(slot)),
    [exec, client],
  );
  const claim = useCallback(
    (slot: Address, account?: Address) =>
      exec("Claim", () => client.claim(slot, account)),
    [exec, client],
  );

  // ─── Manager ──────────────────────────────────────────────────────────────

  const proposeTerms = useCallback(
    (slot: Address, params: ProposeTermsParams) =>
      exec("Propose terms", () => client.proposeTerms(slot, params)),
    [exec, client],
  );
  /**
   * Retract one queued dimension, or both.
   *
   * Labelled by dimension rather than one "Cancel proposal" for all three
   * shapes, because the label is what a per-row spinner keys off: a tax row and
   * a hook row cancelling under one shared label spin together, and the reader
   * cannot tell which retraction is actually in flight.
   */
  const cancelProposal = useCallback(
    (slot: Address, cancelTax = true, cancelHook = true) =>
      exec(
        cancelTax && cancelHook
          ? "Cancel proposal"
          : cancelTax
            ? "Cancel tax update"
            : "Cancel hook update",
        () => client.cancelProposal(slot, cancelTax, cancelHook),
      ),
    [exec, client],
  );

  // ─── Signed sell orders ───────────────────────────────────────────────────

  /**
   * Sign an order to buy `slot` from whoever occupies it.
   *
   * Two prompts at most, and often one: the approve is skipped when the standing
   * allowance already covers `price + deposit`, so raising a bid inside an
   * allowance you already granted signs once.
   */
  const makeSellOrder = useCallback(
    async (
      slot: Address,
      params: SignSellOrderParams,
    ): Promise<SignedSellOrder | undefined> =>
      preflight("Sign order", () => client.makeSellOrder(slot, params)),
    [preflight, client],
  );
  const signSellOrder = useCallback(
    async (
      slot: Address,
      params: SignSellOrderParams,
    ): Promise<SignedSellOrder | undefined> =>
      preflight("Sign order", () => client.signSellOrder(slot, params)),
    [preflight, client],
  );
  const cancelSellOrder = useCallback(
    (slot: Address, nonce: bigint) =>
      exec("Cancel order", () => client.cancelSellOrder(slot, nonce)),
    [exec, client],
  );

  return {
    // Factory
    createSlot,
    // Occupancy
    buy,
    sell,
    release,
    liquidate,
    // Holding
    selfAssess,
    topUp,
    withdraw,
    manageTerms,
    setOperator,
    // Money out
    collect,
    claim,
    // Manager
    proposeTerms,
    cancelProposal,
    // Orders
    makeSellOrder,
    signSellOrder,
    cancelSellOrder,
    // Escape hatches
    client,
    exec,
    preflight,
    // State
    busy,
    isPending,
    isConfirming,
    isSuccess,
    activeAction,
  };
}
