"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Address, Hash } from "viem";
import { useWaitForTransactionReceipt } from "wagmi";
import type {
  BuyParams,
  CreateSlotParams,
  CreateSlotsParams,
  SlotsChain,
} from "../client";
import { UpdateKind } from "../client";
import { useSlotsClient } from "./useSlotsClient";

const CANCEL_LABELS: Record<UpdateKind, string> = {
  [UpdateKind.Tax]: "Cancel tax update",
  [UpdateKind.Utility]: "Cancel utility update",
  [UpdateKind.Policy]: "Cancel policy update",
};

function extractErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("User rejected") || message.includes("User denied"))
    return "Transaction rejected";

  // viem ContractFunctionExecutionError: extract the shortMessage or reason
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

export interface SlotActionCallbacks {
  chainId?: SlotsChain;
  onSuccess?: (label: string, hash: Hash) => void;
  onError?: (label: string, error: string) => void;
}

export function useSlotAction(opts?: SlotActionCallbacks) {
  const client = useSlotsClient(opts?.chainId);

  // --- state ---
  const [hash, setHash] = useState<Hash | undefined>();
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const labelRef = useRef<string>("");

  // --- receipt tracking ---
  const {
    isLoading: isConfirming,
    isSuccess,
    isError,
  } = useWaitForTransactionReceipt({ hash });

  const busy = isPending || isConfirming;

  // --- callback on success ---
  useEffect(() => {
    if (isSuccess && labelRef.current) {
      opts?.onSuccess?.(labelRef.current, hash!);
      setActiveAction(null);
      labelRef.current = "";
    }
  }, [isSuccess]);

  // --- callback on on-chain error ---
  useEffect(() => {
    if (isError && labelRef.current) {
      opts?.onError?.(labelRef.current, `${labelRef.current} failed on-chain`);
      setActiveAction(null);
      labelRef.current = "";
    }
  }, [isError]);

  // --- reset if everything settles with no result ---
  useEffect(() => {
    if (!isPending && !isConfirming && !isSuccess && !isError) {
      setActiveAction(null);
    }
  }, [isPending, isConfirming, isSuccess, isError]);

  /**
   * Execute an SDK method with shared pending/receipt tracking.
   *
   * Reports failures through `onError` rather than throwing, so a single action
   * needs no try/catch at the call site. Returns the hash — or `undefined` when
   * it failed, which is what a multi-step action must check before continuing.
   */
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
        opts?.onError?.(label, extractErrorMessage(error));
        return undefined;
      } finally {
        setIsPending(false);
      }
    },
    [opts?.onError],
  );

  /**
   * Run a read that has to succeed BEFORE any transaction is offered, and
   * report a failure the same way `exec` reports a failed transaction.
   *
   * Without this the pre-flight reads in the policy flows below threw straight
   * out of an un-awaited callback: the promise rejected with nobody listening,
   * so the button stayed enabled and clicking it did nothing at all. Silence is
   * the worst failure mode — a revert at least tells you something happened.
   *
   * The realistic trigger is a chain with no policy factory deployed, where
   * `predict` cannot even be addressed. That is a configuration fact the user
   * should be told, not a mystery.
   */
  const preflight = useCallback(
    async <T>(label: string, fn: () => Promise<T>): Promise<T | undefined> => {
      try {
        return await fn();
      } catch (error) {
        console.error(`[useSlotAction] ${label} failed:`, error);
        setActiveAction(null);
        labelRef.current = "";
        opts?.onError?.(label, extractErrorMessage(error));
        return undefined;
      }
    },
    [opts?.onError],
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // Named actions — each calls one SDK method
  // ═══════════════════════════════════════════════════════════════════════════

  // Factory
  const createSlot = useCallback(
    (params: CreateSlotParams) =>
      exec("Create slot", () => client.createSlot(params)),
    [exec, client],
  );
  /**
   * Ensure the minimum-tenure policy for `tenureSeconds` exists, then create the
   * slot pointing at it. Two transactions only the first time anyone uses that
   * duration — afterwards the policy already exists and this is a single tx.
   */
  const createSlotWithTenure = useCallback(
    async (params: CreateSlotParams, tenureSeconds: bigint) => {
      const pre = await preflight("Create slot", async () => ({
        policy: await client.predictTenurePolicy(tenureSeconds),
        exists: await client.isTenurePolicyDeployed(tenureSeconds),
      }));
      if (!pre) return undefined;
      const { policy, exists } = pre;
      if (!exists) {
        const deployed = await exec("Deploy tenure policy", () =>
          client.deployTenurePolicy(tenureSeconds),
        );
        // Bail on a rejected or reverted deploy: `createSlot` requires code at
        // `policy` and would otherwise fail a second time, more confusingly.
        if (!deployed) return undefined;
      }
      return exec("Create slot", () =>
        client.createSlot({
          ...params,
          initParams: { ...params.initParams, occupancyPolicy: policy },
        }),
      );
    },
    [client, exec, preflight],
  );

  /**
   * Ensure the price-floor policy for `(currency, minPrice)` exists, then
   * create the slot pointing at it. Two transactions only the first time
   * anyone uses those exact terms; afterwards the policy already exists and
   * this is a single tx.
   *
   * `currency` must be the slot's own currency — the policy checks it on every
   * call and reverts `WrongCurrency` otherwise.
   */
  const createSlotWithPriceFloor = useCallback(
    async (params: CreateSlotParams, minPrice: bigint) => {
      const pre = await preflight("Create slot", async () => ({
        policy: await client.predictPricePolicy(params.currency, minPrice),
        exists: await client.isPricePolicyDeployed(params.currency, minPrice),
      }));
      if (!pre) return undefined;
      const { policy, exists } = pre;
      if (!exists) {
        const deployed = await exec("Deploy price policy", () =>
          client.deployPricePolicy(params.currency, minPrice),
        );
        // Bail on a rejected or reverted deploy: `createSlot` requires code
        // at `policy` and would otherwise fail a second time, more confusingly.
        if (!deployed) return undefined;
      }
      return exec("Create slot", () =>
        client.createSlot({
          ...params,
          initParams: { ...params.initParams, occupancyPolicy: policy },
        }),
      );
    },
    [client, exec, preflight],
  );

  const createSlots = useCallback(
    (params: CreateSlotsParams) =>
      exec("Create slots", () => client.createSlots(params)),
    [exec, client],
  );

  // Slot interactions
  const buy = useCallback(
    (params: BuyParams) => exec("Buy slot", () => client.buy(params)),
    [exec, client],
  );
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
  const release = useCallback(
    (slot: Address) => exec("Release slot", () => client.release(slot)),
    [exec, client],
  );
  const collect = useCallback(
    (slot: Address) => exec("Collect tax", () => client.collect(slot)),
    [exec, client],
  );
  const liquidate = useCallback(
    (slot: Address) => exec("Liquidate", () => client.liquidate(slot)),
    [exec, client],
  );

  // Manager
  const proposeTaxUpdate = useCallback(
    (slot: Address, newPct: bigint) =>
      exec("Propose tax", () => client.proposeTaxUpdate(slot, newPct)),
    [exec, client],
  );
  const proposeUtilityUpdate = useCallback(
    (slot: Address, newUtility: Address) =>
      exec("Propose utility", () =>
        client.proposeUtilityUpdate(slot, newUtility),
      ),
    [exec, client],
  );
  /** @deprecated use `proposeUtilityUpdate` */
  const proposeModuleUpdate = proposeUtilityUpdate;
  const proposePolicyUpdate = useCallback(
    (slot: Address, newPolicy: Address) =>
      exec("Propose policy", () => client.proposePolicyUpdate(slot, newPolicy)),
    [exec, client],
  );
  /**
   * Retract one queued change. Labelled per dimension so the pending UI can
   * say which button is working — "Cancel updates" spinning next to three
   * separate rows tells the user nothing.
   */
  const cancelPendingUpdate = useCallback(
    (slot: Address, kind: UpdateKind) =>
      exec(CANCEL_LABELS[kind], () => client.cancelPendingUpdate(slot, kind)),
    [exec, client],
  );
  const cancelPendingUpdates = useCallback(
    (slot: Address) =>
      exec("Cancel updates", () => client.cancelPendingUpdates(slot)),
    [exec, client],
  );
  const setLiquidationBounty = useCallback(
    (slot: Address, newBps: bigint) =>
      exec("Set bounty", () => client.setLiquidationBounty(slot, newBps)),
    [exec, client],
  );

  // Metadata module
  const updateMetadata = useCallback(
    (moduleAddress: Address, slot: Address, uri: string) =>
      exec("Update metadata", () =>
        client.modules.metadata.updateMetadata(moduleAddress, slot, uri),
      ),
    [exec, client],
  );

  return {
    // Actions
    createSlot,
    createSlotWithTenure,
    createSlotWithPriceFloor,
    createSlots,
    buy,
    selfAssess,
    topUp,
    withdraw,
    release,
    collect,
    liquidate,
    proposeTaxUpdate,
    proposeUtilityUpdate,
    proposePolicyUpdate,
    /** @deprecated use `proposeUtilityUpdate` */
    proposeModuleUpdate,
    cancelPendingUpdate,
    cancelPendingUpdates,
    setLiquidationBounty,
    updateMetadata,
    // Executor
    exec,
    // State
    busy,
    isPending,
    isConfirming,
    isSuccess,
    activeAction,
  };
}
