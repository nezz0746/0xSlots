import { alchemyRpcUrl } from "@0xslots/config/transports";
import { type Address, createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

/**
 * Server-side profile resolution for the public leaderboard.
 *
 * Two sources, Farcaster preferred:
 *
 *   1. Farcaster, via app.astroblock.xyz's open by-address endpoint. Base
 *      accounts are heavily Farcaster-native, and this covers custody addresses
 *      that the keyless Warpcast verification lookup misses — several holders
 *      here have a Farcaster identity but no ENS at all.
 *   2. ENS reverse resolution as the fallback, with the avatar served through
 *      ENS's own metadata service (which dereferences ipfs / NFT / https records
 *      and returns a plain image — the raw record is often a bare `ipfs://` that
 *      rides a slow gateway).
 *
 * This lives apart from `lib/ens` because that module is `"use client"` (wagmi
 * hooks); a server component cannot import it without dragging in the client
 * boundary, so the marketing page gets its own plain viem client here.
 */

const key = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY ?? "";

const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http(alchemyRpcUrl(mainnet.id, key) ?? undefined),
});

export interface Profile {
  name: string | null;
  /** A usable image URL, or null. The client avatar falls back to a gradient
   *  if this is null OR fails to load. */
  avatar: string | null;
  source?: "farcaster" | "ens";
}

const EMPTY: Profile = { name: null, avatar: null };

interface FcUser {
  username?: string;
  display_name?: string;
  pfp_url?: string;
}

/** Farcaster identity by address, via the open astroblock endpoint. */
async function fetchFarcaster(address: Address): Promise<Profile | null> {
  try {
    const res = await fetch(
      `https://app.astroblock.xyz/api/fc/user/address/${address}`,
      { signal: AbortSignal.timeout(8000), next: { revalidate: 300 } },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as Record<string, FcUser[]>;
    // Keyed by the lowercased address; take the first user if any.
    const user = json?.[address.toLowerCase()]?.[0];
    const name = user?.display_name || user?.username;
    if (!name) return null;
    return { name, avatar: user?.pfp_url ?? null, source: "farcaster" };
  } catch {
    return null;
  }
}

/** ENS reverse name + a metadata-service avatar URL (404s when none is set). */
async function fetchEns(address: Address): Promise<Profile | null> {
  let name: string | null = null;
  try {
    name = await mainnetClient.getEnsName({ address });
  } catch {
    // Reverse-resolution hiccup — treat as no ENS.
  }
  if (!name) return null;
  return {
    name,
    avatar: `https://metadata.ens.domains/mainnet/avatar/${name}`,
    source: "ens",
  };
}

async function resolveOne(address: Address): Promise<Profile> {
  // Both in parallel; ENS wins when present. An address's primary ENS name is
  // the identity its owner chose to point AT this address, whereas a Farcaster
  // profile is matched by the address being a custody/verified wallet and can
  // be an unrelated account that happens to share it — so ENS is the more
  // authoritative "who is this". Farcaster fills in everyone without ENS.
  const [ens, fc] = await Promise.all([
    fetchEns(address),
    fetchFarcaster(address),
  ]);
  return ens ?? fc ?? EMPTY;
}

/**
 * Resolve every address at once, keyed by lowercase address.
 *
 * Each lookup is independently guarded, so one slow or missing profile never
 * fails the board. Cached by the caller's ISR.
 */
export async function resolveProfiles(
  addresses: readonly Address[],
): Promise<Map<string, Profile>> {
  const unique = [...new Set(addresses.map((a) => a.toLowerCase() as Address))];
  const resolved = await Promise.all(unique.map(resolveOne));
  return new Map(unique.map((a, i) => [a, resolved[i] as Profile]));
}
