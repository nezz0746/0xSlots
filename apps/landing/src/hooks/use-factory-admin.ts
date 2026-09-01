"use client";

import { slotFactoryAbi, slotsFactoryAddress } from "@0xslots/contracts/slots";
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
 * Read from the chain rather than the indexer. Ponder's `factory` table does
 * carry an `admin` column now, but this is a single address that
 * `transferAdmin` can move and the answer gates a control — so a read that is
 * correct as of the last indexed block is the wrong kind of correct.
 */
export function useFactoryAdmin() {
  const { chainId } = useChain();
  const { address } = useAccount();
  const factory = slotsFactoryAddress[chainId];

  const { data: admin, isLoading } = useReadContract({
    address: factory,
    abi: slotFactoryAbi,
    functionName: "admin",
    chainId,
    query: {
      enabled: !!factory,
      // The admin changes about never; re-reading it on every mount is pure
      // noise. `useRefreshSlots` invalidates after any write, so a
      // `transferAdmin` still lands right away.
      staleTime: 5 * 60_000,
    },
  });

  return {
    admin: admin as `0x${string}` | undefined,
    isAdmin:
      !!address &&
      !!admin &&
      address.toLowerCase() === (admin as string).toLowerCase(),
    isLoading,
  };
}
