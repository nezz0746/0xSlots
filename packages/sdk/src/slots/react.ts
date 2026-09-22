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
  Manifest,
  PostOfferParams,
  ProposeTermsParams,
  SlotInit,
} from "./client";
import { decodedRevert } from "../errors";
import { ALL_TERMS, TERMS } from "./client";
import { SlotsClient } from "./client";
import { CollectivesClient } from "./collectives";

// ─── Client ───────────────────────────────────────────────────────────────────

export interface UseSlotsClientConfig {
  /**
   * The v1 `SlotFactory`.
   *
   * Passed in rather than looked up: there is no address registry for this
   * factory yet, and an app that silently resolved the PREVIOUS protocol's
   * factory would deploy the wrong kind of slot without complaining.
   */
  factoryAddress?: Address;
  /** The `OfferBook`. Defaults to the one deployed on the connected chain. */
  offerBookAddress?: Address;
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
        offerBookAddress: config.offerBookAddress,
        publicClient: publicClient ?? undefined,
        walletClient: walletClient ?? undefined,
      }),
    [config.factoryAddress, config.offerBookAddress, publicClient, walletClient],
  );
}

export interface UseCollectivesClientConfig {
  /** The `SlotCollectiveFactory`. Defaults to the one deployed on the connected chain. */
  factoryAddress?: Address;
  /** Chain override. Defaults to the connected chain. */
  chainId?: number;
}

/** A memoized {@link CollectivesClient} built from wagmi's public and wallet clients. */
export function useCollectivesClient(
  config: UseCollectivesClientConfig = {},
): CollectivesClient {
  const publicClient = usePublicClient({ chainId: config.chainId });
  const { data: walletClient } = useWalletClient({ chainId: config.chainId });

  return useMemo(
    () =>
      new CollectivesClient({
        factoryAddress: config.factoryAddress,
        publicClient: publicClient ?? undefined,
        walletClient: walletClient ?? undefined,
      }),
    [config.factoryAddress, publicClient, walletClient],
  );
}

// ─── Actions ──────────────────────────────────────────────────────────────────

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
  // A module's veto arrives here — `_before` bubbles the module's own revert reason
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
  const release = useCallback(
    (slot: Address) => exec("Release slot", () => client.release(slot)),
    [exec, client],
  );
  const liquidate = useCallback(
    (slot: Address) => exec("Liquidate", () => client.liquidate(slot)),
    [exec, client],
  );
  const liquidateAndBuy = useCallback(
    (params: BuyParams) =>
      exec("Liquidate and buy", () => client.liquidateAndBuy(params)),
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
  /**
   * Every slot in one signature, through the factory.
   *
   * Not wrapped with a simulate-first: `simulateCollectAll` is a READ and this
   * hook is the write path, so pairing them here would make a button that shows
   * an amount also send a transaction to learn it. Read it yourself to label the
   * button, then call this when it is pressed.
   */
  const collectAll = useCallback(
    (slots: readonly Address[]) =>
      exec(
        slots.length === 1
          ? "Collect tax"
          : `Collect tax from ${slots.length} slots`,
        () => client.collectAll(slots),
      ),
    [exec, client],
  );
  const claim = useCallback(
    (slot: Address, account?: Address) =>
      exec("Claim", () => client.claim(slot, account)),
    [exec, client],
  );

  // ─── Manager ──────────────────────────────────────────────────────────────

  const setManager = useCallback(
    (slot: Address, manager: Address) =>
      exec("Set manager", () => client.setManager(slot, manager)),
    [exec, client],
  );

  const acceptOffer = useCallback(
    (slot: Address, id: bigint, minPrice: bigint) =>
      exec("Accept offer", () => client.acceptOffer(slot, id, minPrice)),
    [exec, client],
  );

  const postOffer = useCallback(
    (params: PostOfferParams) => exec("Post offer", () => client.postOffer(params)),
    [exec, client],
  );

  const cancelOffer = useCallback(
    (slot: Address, id: bigint) =>
      exec("Cancel offer", () => client.cancelOffer(slot, id)),
    [exec, client],
  );

  const authorizeOfferBook = useCallback(
    (slot: Address) =>
      exec("Authorize offer book", () => client.authorizeOfferBook(slot)),
    [exec, client],
  );

  const grant = useCallback(
    (slot: Address, expected: Manifest) =>
      exec("Accept module update", () => client.grant(slot, expected)),
    [exec, client],
  );

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
   * a module row cancelling under one shared label spin together, and the reader
   * cannot tell which retraction is actually in flight.
   */
  const cancelTerms = useCallback(
    (slot: Address, mask: number = ALL_TERMS) =>
      exec(cancelLabel(mask), () => client.cancelTerms(slot, mask)),
    [exec, client],
  );

  /**
   * Sign an order to buy `slot` from whoever occupies it.
   *
   * Two prompts at most, and often one: the approve is skipped when the standing
   * allowance already covers `price + deposit`, so raising a bid inside an
   * allowance you already granted signs once.
   */
  return {
    // Factory
    createSlot,
    // Occupancy
    buy,
    release,
    liquidate,
    liquidateAndBuy,
    // Holding
    selfAssess,
    topUp,
    withdraw,
    manageTerms,
    setOperator,
    // Money out
    collect,
    collectAll,
    claim,
    // Manager
    proposeTerms,
    cancelTerms,
    grant,
    setManager,
    // Orders
    postOffer,
    cancelOffer,
    authorizeOfferBook,
    acceptOffer,
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

/**
 * The label `activeAction` reports for a cancel, so a per-term spinner lands on
 * the retraction actually in flight.
 */
export function cancelLabel(mask: number): string {
  switch (mask) {
    case TERMS.TAX_RATE:
      return "Cancel tax update";
    case TERMS.RECIPIENT:
      return "Cancel recipient update";
    case TERMS.MIN_RUNWAY:
      return "Cancel minimum deposit update";
    case TERMS.MODULE:
      return "Cancel module update";
    case TERMS.SCOPES:
      return "Cancel module scopes update";
    default:
      return "Cancel proposal";
  }
}
