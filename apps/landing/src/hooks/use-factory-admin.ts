"use client";

import {
  type SupportedChainId,
  slotFactoryAbi,
  slotFactoryAddress,
} from "@0xslots/contracts";
import { useAccount, useReadContract } from "wagmi";
import { useChain } from "@/context/chain";

/**
 * Whether the connected account is the admin of the factory on the CURRENT
 * chain.
 *
 * The chain comes from the chain context rather than the wallet, matching every
 * other read in the app: the page is showing one chain's data, and an admin
 * check answering for a different one would light up controls that act on rows
 * the user cannot see. A wallet parked on the wrong chain is a separate problem
 * and wagmi already solves it at send time, by prompting to switch.
 *
 * There is no indexed `admin` to read instead — ponder's `factory` table tracks
 * only `slotCount` — and it is a single address that `transferAdmin` can move,
 * so the chain is both the cheapest and the only correct source.
 */
export function useFactoryAdmin() {
  const { chainId } = useChain();
  const { address } = useAccount();
  const factory = slotFactoryAddress[chainId as SupportedChainId];

  const { data: admin, isLoading } = useReadContract({
    address: factory,
    abi: slotFactoryAbi,
    functionName: "admin",
    chainId,
    query: {
      enabled: !!factory,
      // The admin changes about never; re-reading it on every table mount is
      // pure noise. `usePostTxRefresh` invalidates `readContract` immediately
      // after any transaction, so a `transferAdmin` still lands right away.
      staleTime: 5 * 60_000,
    },
  });

  return {
    admin,
    isAdmin:
      !!address && !!admin && address.toLowerCase() === admin.toLowerCase(),
    isLoading,
  };
}
