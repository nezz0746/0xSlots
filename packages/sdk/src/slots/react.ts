"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Address, Hash } from "viem";
import { usePublicClient, useWaitForTransactionReceipt, useWalletClient } from "wagmi";
import type {
  BuyParams,
  ProposeTermsParams,
  SellOrder,
  SignSellOrderParams,
  SignedSellOrder,
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

function extractErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("User rejected") || message.includes("User denied"))
    return "Transaction rejected";

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
    async (label: string, fn: () => Promise<Hash>): Promise<Hash | undefined> => {
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
  /**
   * Evict and claim in one transaction — the only version of liquidating that
   * ends with you holding the slot. Labelled apart from "Liquidate" because the
   * outcomes differ: one leaves the slot vacant for anyone, this one takes it.
   */
  const liquidateAndTake = useCallback(
    (params: BuyParams) =>
      exec("Liquidate and take", () => client.liquidateAndTake(params)),
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
  const cancelProposal = useCallback(
    (slot: Address) =>
      exec("Cancel proposal", () => client.cancelProposal(slot)),
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
    liquidateAndTake,
    // Holding
    selfAssess,
    topUp,
    withdraw,
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
