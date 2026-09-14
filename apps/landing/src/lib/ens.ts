"use client";

import { proxyTransport } from "@0xslots/config/transports";
import { useQuery } from "@tanstack/react-query";
import { type Address, createPublicClient } from "viem";
import { mainnet } from "viem/chains";
import { normalize } from "viem/ens";

/**
 * Standalone mainnet client — not part of the wagmi config, but through the
 * same proxy.
 *
 * ENS resolution is mainnet-only and so needs a chain the app does not
 * otherwise talk to, which is how it ended up building its own transport with
 * the public key in it. Every read here is cached for an hour, so the volume
 * was never the problem — the exposure was.
 */
export const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: proxyTransport(mainnet.id),
});

export function useEnsName(address: string | undefined) {
  return useQuery({
    queryKey: ["ens", "name", address],
    queryFn: () => mainnetClient.getEnsName({ address: address as Address }),
    enabled: !!address,
    staleTime: 1000 * 60 * 60,
  });
}

export function useEnsAvatar(name: string | undefined | null) {
  return useQuery({
    queryKey: ["ens", "avatar", name],
    queryFn: () => mainnetClient.getEnsAvatar({ name: normalize(name!) }),
    enabled: !!name,
    staleTime: 1000 * 60 * 60,
  });
}

export function useEnsAddress(name: string | undefined) {
  return useQuery({
    queryKey: ["ens", "address", name],
    queryFn: () => mainnetClient.getEnsAddress({ name: normalize(name!) }),
    enabled: !!name,
    staleTime: 1000 * 60 * 60,
  });
}

export async function resolveEnsAddress(name: string): Promise<Address> {
  const resolved = await mainnetClient.getEnsAddress({
    name: normalize(name),
  });
  if (!resolved) throw new Error(`Could not resolve ${name}`);
  return resolved;
}
