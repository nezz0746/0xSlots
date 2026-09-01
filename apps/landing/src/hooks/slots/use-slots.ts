"use client";

import { slotFactoryAbi, slotsFactoryAddress } from "@0xslots/contracts/slots";
import { NATIVE_CURRENCY, isNativeCurrency } from "@0xslots/sdk";
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
 * Reads go straight to the node. There is deliberately no indexer path here:
 * ponder indexes the PREVIOUS protocol, and a list that silently returned rows
 * from the wrong one would be worse than having no list — the addresses look
 * identical and every subsequent read against them reverts.
 */

/** The factory for the connected explorer chain, if this protocol lives there. */
export function useSlotsFactory(): Address | undefined {
  const { chainId } = useChain();
  return slotsFactoryAddress[chainId];
}

/** A {@link SlotsClient} pinned to the explorer's chain and its factory. */
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
export function useCreatedSlots(filter?: { recipient?: Address; creator?: Address }) {
  const { chainId } = useChain();
  const factory = useSlotsFactory();
  const publicClient = usePublicClient({ chainId });

  return useQuery({
    queryKey: ["slots", "created", chainId, factory, filter?.recipient, filter?.creator],
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
export function useSlotState(slot: Address | undefined) {
  const { chainId } = useChain();
  const client = useSlots();

  return useQuery({
    queryKey: slotStateKey(chainId, slot ?? ""),
    enabled: !!slot,
    refetchInterval: 5_000,
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
      return { address: getAddress(currency!), symbol, decimals, isNative: false };
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
