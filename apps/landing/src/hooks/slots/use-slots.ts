"use client";

import { slotFactoryAbi, slotFactoryAddress } from "@0xslots/contracts/slots";
import { isNativeCurrency, NATIVE_CURRENCY } from "@0xslots/sdk";
import type { SlotState } from "@0xslots/sdk/slots";
import { useSlotsClient } from "@0xslots/sdk/slots/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { type Address, erc20Abi, getAddress, zeroAddress } from "viem";
import { usePublicClient } from "wagmi";
import { useChain } from "@/context/chain";

/**
 * Everything the hook-based protocol needs from the chain, in one place.
 *
 * Reads go straight to the node. The ponder deployment now indexes THIS
 * protocol — see `packages/ponder/ponder.schema.ts` — and the explorer reads it
 * for history, aggregates and anything that wants sorting or paging. What stays
 * here is what the indexer cannot answer correctly:
 *
 *   `taxOwed`, `isInsolvent` and `secondsUntilLiquidation` are functions of
 *   `block.timestamp`, not of any event. Nothing is emitted when a slot crosses
 *   into insolvency, so an indexed row is simply wrong about solvency between
 *   transitions, however fresh it is.
 *
 * So: the indexer for what happened, the chain for what is true right now.
 */

/** The factory for the connected explorer chain, if this protocol lives there. */
export function useSlotsFactory(): Address | undefined {
  const { chainId } = useChain();
  return slotFactoryAddress[chainId];
}

/** A {@link SlotsClient} pinned to the explorer's chain and factory. */
export function useSlots() {
  const { chainId } = useChain();
  const factoryAddress = useSlotsFactory();
  return useSlotsClient({ factoryAddress, chainId });
}

export interface CreatedSlot {
  address: Address;
  recipient: Address;
  creator: Address;
  currency: Address;
  hook: Address;
  blockNumber: bigint;
}

/**
 * Every slot this factory has made, newest first.
 *
 * `SlotCreated` logs, not an enumeration call: the factory keeps a
 * `mapping(address => bool)` and a count, neither of which can be walked. The
 * scan starts at block 0, which is correct locally and is why this protocol
 * needs an indexer before it goes anywhere with real history.
 */
export function useCreatedSlots(filter?: {
  recipient?: Address;
  creator?: Address;
}) {
  const { chainId } = useChain();
  const factory = useSlotsFactory();
  const publicClient = usePublicClient({ chainId });

  return useQuery({
    queryKey: [
      "slots",
      "created",
      chainId,
      factory,
      filter?.recipient,
      filter?.creator,
    ],
    enabled: !!factory && !!publicClient,
    refetchInterval: 8_000,
    queryFn: async (): Promise<CreatedSlot[]> => {
      const logs = await publicClient!.getLogs({
        address: factory!,
        event: {
          type: "event",
          name: "SlotCreated",
          inputs: [
            { name: "slot", type: "address", indexed: true },
            { name: "recipient", type: "address", indexed: true },
            { name: "creator", type: "address", indexed: true },
            { name: "currency", type: "address", indexed: false },
            { name: "hook", type: "address", indexed: false },
          ],
        },
        args: {
          ...(filter?.recipient ? { recipient: filter.recipient } : {}),
          ...(filter?.creator ? { creator: filter.creator } : {}),
        },
        fromBlock: 0n,
        toBlock: "latest",
      });

      return logs
        .map((log) => ({
          address: log.args.slot as Address,
          recipient: log.args.recipient as Address,
          creator: log.args.creator as Address,
          currency: log.args.currency as Address,
          hook: log.args.hook as Address,
          blockNumber: log.blockNumber ?? 0n,
        }))
        .reverse();
    },
  });
}

/** How many slots the factory has made. Cheap enough to poll beside the list. */
export function useSlotCount() {
  const { chainId } = useChain();
  const factory = useSlotsFactory();
  const publicClient = usePublicClient({ chainId });

  return useQuery({
    queryKey: ["slots", "count", chainId, factory],
    enabled: !!factory && !!publicClient,
    refetchInterval: 8_000,
    queryFn: () =>
      publicClient!.readContract({
        address: factory!,
        abi: slotFactoryAbi,
        functionName: "slotCount",
      }) as Promise<bigint>,
  });
}

/**
 * How far the chain's clock runs ahead of this browser's, in seconds.
 *
 * Everything time-dependent on a slot is a function of `block.timestamp`, and
 * anything interpolating those figures locally has to count in the CHAIN's
 * clock — not the machine's. The two are not the same clock and are not
 * guaranteed to be close:
 *
 *   * a local anvil that has been time-warped runs hours or days ahead;
 *   * a user's system clock can simply be wrong;
 *   * an L2's sequencer clock drifts from wall time by design.
 *
 * Measured rather than assumed: one block header, re-read on a slow timer. The
 * offset only changes when the chain's own clock is moved, so polling it
 * quickly would buy nothing.
 *
 * Returns 0 while the first read is in flight, which is the correct assumption
 * for the overwhelmingly common case of a chain in step with wall time.
 */
export function useChainTimeSkew(): number {
  const { chainId } = useChain();
  const publicClient = usePublicClient({ chainId });

  const { data } = useQuery({
    queryKey: ["slots", "chain-skew", chainId],
    enabled: !!publicClient,
    refetchInterval: 30_000,
    queryFn: async () => {
      const block = await publicClient!.getBlock();
      return Number(block.timestamp) - Math.floor(Date.now() / 1000);
    },
  });

  return data ?? 0;
}

export const slotStateKey = (chainId: number, slot: string) =>
  ["slots", "state", chainId, slot.toLowerCase()] as const;

/**
 * One slot's whole state, refetched on a timer.
 *
 * Polled rather than watched because half of what this returns is a function of
 * `block.timestamp` and not of any event: `taxOwed`, `isInsolvent` and
 * `secondsUntilLiquidation` all move while nothing at all happens on chain. A
 * page that only invalidated on events would show a solvent occupant
 * indefinitely.
 */
export function useSlotState(
  slot: Address | undefined,
  { refetchInterval = 5_000 }: { refetchInterval?: number } = {},
) {
  const { chainId } = useChain();
  const client = useSlots();

  return useQuery({
    queryKey: slotStateKey(chainId, slot ?? ""),
    enabled: !!slot,
    refetchInterval,
    queryFn: (): Promise<SlotState> => client.slotState(slot!),
  });
}

/**
 * Invalidate every read this page makes, after a write lands.
 *
 * Broad on purpose: a buy moves occupancy, deposit, the pending terms and the
 * caller's balance at once, and enumerating which of those a given action
 * touched is how a stale panel survives a successful transaction.
 */
export function useRefreshSlots() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["slots"] });
  }, [queryClient]);
}

export interface CurrencyMeta {
  address: Address;
  symbol: string;
  decimals: number;
  isNative: boolean;
}

const NATIVE_META: CurrencyMeta = {
  address: zeroAddress,
  symbol: NATIVE_CURRENCY.symbol,
  decimals: NATIVE_CURRENCY.decimals,
  isNative: true,
};

/**
 * A currency's symbol and decimals, read from the token itself.
 *
 * Not from a curated list: a slot may be denominated in any ERC-20 its creator
 * chose, and rendering a deposit at the wrong number of decimals is off by
 * orders of magnitude while looking perfectly plausible.
 */
export function useCurrencyMeta(currency: Address | undefined) {
  const { chainId } = useChain();
  const publicClient = usePublicClient({ chainId });
  const native = isNativeCurrency(currency);

  const query = useQuery({
    queryKey: ["slots", "currency", chainId, currency],
    enabled: !!currency && !native && !!publicClient,
    staleTime: Infinity,
    queryFn: async (): Promise<CurrencyMeta> => {
      const [symbol, decimals] = await Promise.all([
        publicClient!.readContract({
          address: currency!,
          abi: erc20Abi,
          functionName: "symbol",
        }),
        publicClient!.readContract({
          address: currency!,
          abi: erc20Abi,
          functionName: "decimals",
        }),
      ]);
      return {
        address: getAddress(currency!),
        symbol,
        decimals,
        isNative: false,
      };
    },
  });

  return useMemo<CurrencyMeta>(() => {
    if (native) return NATIVE_META;
    return (
      query.data ?? {
        address: currency ?? zeroAddress,
        // Placeholder while the read is in flight. 18 is the ERC-20 default and
        // the only guess that is right more often than it is wrong; the symbol
        // stays blank rather than inventing one.
        symbol: "",
        decimals: 18,
        isNative: false,
      }
    );
  }, [native, query.data, currency]);
}

/**
 * What `account` may {@link SlotsClient.claim} from this slot.
 *
 * Non-zero means a push payment could not reach them — a reverting `receive`,
 * a blocklisting token — and the protocol credited it instead. Nothing else in
 * the UI reveals that money is sitting there.
 */
export function useWithdrawable(
  slot: Address | undefined,
  account: Address | undefined,
) {
  const { chainId } = useChain();
  const client = useSlots();

  return useQuery({
    queryKey: ["slots", "withdrawable", chainId, slot, account],
    enabled: !!slot && !!account,
    refetchInterval: 10_000,
    queryFn: () => client.withdrawableOf(slot!, account!),
  });
}

/** Whether `account` may reprice on the occupant's behalf. */
export function useIsOperator(
  slot: Address | undefined,
  account: Address | undefined,
) {
  const { chainId } = useChain();
  const client = useSlots();

  return useQuery({
    queryKey: ["slots", "operator", chainId, slot, account],
    enabled: !!slot && !!account,
    queryFn: () => client.isOperator(slot!, account!),
  });
}

/**
 * The smallest deposit a BUY will accept at `price`, asked of the slot itself.
 *
 * NOT `minDepositFor(price, taxBps, minDepositSeconds)`. Entry is an
 * occupancy transition, so `_applyPending` runs before the funding check — a
 * buyer funds the terms they are buying INTO. Where a tax rise is queued, the
 * local formula sizes from the visible rate, under-quotes, and the buy reverts
 * `InvalidDeposit` for a reason nothing on screen explains. The slot already
 * knows which rate it will use, so it is asked.
 *
 * Returns `undefined` while in flight; callers fall back rather than block.
 */
export function useMinDepositForBuy(slot: Address | undefined, price: bigint) {
  const { chainId } = useChain();
  const client = useSlots();

  return useQuery({
    queryKey: ["slots", "minDepositForBuy", chainId, slot, price.toString()],
    enabled: !!slot && price > 0n,
    // Moves only when the manager queues or retracts a tax change, which the
    // page's own five-second state poll will surface anyway.
    refetchInterval: 15_000,
    queryFn: () => client.minDepositForBuy(slot!, price),
  });
}

/**
 * What taking the slot will actually charge, asked of the slot itself.
 *
 * NOT `price() + deposit`. The payment rule is the contract's promise and it
 * folds in the seated account's arrears; a native slot checks `msg.value` for
 * EQUALITY, so a figure derived here rather than quoted would revert whenever
 * the two disagreed.
 */
export function useTakeQuote(
  slot: Address | undefined,
  /**
   * The address being SEATED, not the one paying.
   *
   * Both quotes include that account's arrears, and the two need not be the
   * same address — this app lets a buyer seat someone else. Quoting for the
   * payer under-quotes a debtor's re-entry, and on a native slot, where
   * `msg.value` is checked for EQUALITY, an under-quote is a revert.
   */
  account: Address | undefined,
  depositAmount: bigint,
) {
  const { chainId } = useChain();
  const client = useSlots();

  return useQuery({
    queryKey: [
      "slots",
      "quote",
      chainId,
      slot,
      account,
      depositAmount.toString(),
    ],
    enabled: !!slot && !!account && depositAmount > 0n,
    refetchInterval: 5_000,
    queryFn: () => client.quoteBuy(slot!, account!, depositAmount),
  });
}

/**
 * Tax `account` still owes this slot from an occupancy its deposit could not
 * cover.
 *
 * Settling can only take what the deposit holds; the shortfall used to be
 * written off, which made running dry and retaking the vacated seat the
 * cheapest way to hold a slot. It is carried on the ACCOUNT now and charged on
 * re-entry — so it is part of what taking this slot costs, and the person
 * paying it deserves to see it as its own line rather than folded into a total
 * that is quietly larger than the price plus the deposit.
 */
export function useArrears(
  slot: Address | undefined,
  account: Address | undefined,
) {
  const { chainId } = useChain();
  const client = useSlots();

  return useQuery({
    queryKey: ["slots", "arrears", chainId, slot, account],
    enabled: !!slot && !!account,
    refetchInterval: 10_000,
    queryFn: () => client.arrearsOf(slot!, account!),
  });
}
