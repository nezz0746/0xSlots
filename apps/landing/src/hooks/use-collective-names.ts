"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useChain } from "@/context/chain";
import { loadStorage, saveStorage } from "@/lib/storage";

/**
 * Human names for collectives, kept in this browser.
 *
 * A SlotCollective has no on-chain name — the contract stores roles and a
 * split, nothing else — so every list of them reads as a wall of hex. Naming
 * one is therefore a note-to-self, not a fact about the collective: it lives in
 * localStorage, is never sent anywhere, and does not follow the user to another
 * device or become visible to the other members. That is the honest scope, and
 * the UI says as much wherever a name is set.
 *
 * Keys are `chainId:address` because the factory can deploy to the same address
 * on two chains; a name set on Base should not leak onto a Sepolia collective
 * that happens to share it.
 */

const STORAGE_KEY = "0xslots.collective-names";

type NameMap = Record<string, string>;

/** Names are capped so a stray paste cannot fill a table cell. */
export const MAX_COLLECTIVE_NAME = 48;

const EMPTY: NameMap = {};

/**
 * `useSyncExternalStore` compares snapshots by identity, so the parsed map is
 * held here rather than re-read per render — a fresh object every time would
 * loop forever. Set to null to force a re-read (another tab wrote).
 */
let cache: NameMap | null = null;

const listeners = new Set<() => void>();

function readMap(): NameMap {
  if (typeof window === "undefined") return EMPTY;
  if (cache === null) cache = loadStorage<NameMap>(STORAGE_KEY, EMPTY);
  return cache;
}

function emit() {
  for (const listener of listeners) listener();
}

/** Another tab renamed something. Drop the cache and let every hook re-read. */
function onStorage(event: StorageEvent) {
  if (event.key !== STORAGE_KEY) return;
  cache = null;
  emit();
}

function subscribe(listener: () => void) {
  if (listeners.size === 0 && typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

function nameKey(chainId: number, address: string) {
  return `${chainId}:${address.toLowerCase()}`;
}

/**
 * Write, or clear when the name is blank.
 *
 * Clearing deletes the key rather than storing `""`, so the map never
 * accumulates tombstones for collectives the user renamed and then unnamed.
 */
function writeName(chainId: number, address: string, name: string) {
  const key = nameKey(chainId, address);
  const trimmed = name.trim().slice(0, MAX_COLLECTIVE_NAME);
  const current = readMap();

  if (trimmed === (current[key] ?? "")) return;

  const next = { ...current };
  if (trimmed) next[key] = trimmed;
  else delete next[key];

  cache = next;
  try {
    saveStorage(STORAGE_KEY, next);
  } catch {
    // Private mode / storage disabled. The rename still holds for this
    // session — losing it on reload beats throwing out of an onClick.
  }
  emit();
}

/** Every name on the current chain. Mostly useful for lookups in a list. */
export function useCollectiveNames(): NameMap {
  return useSyncExternalStore(subscribe, readMap, () => EMPTY);
}

/**
 * The name for one collective, and the setter that changes it.
 *
 * `rename("")` removes the name.
 */
export function useCollectiveName(address: string | undefined) {
  const { chainId } = useChain();
  const names = useCollectiveNames();

  const name = address ? names[nameKey(chainId, address)] : undefined;

  const rename = useCallback(
    (next: string) => {
      if (!address) return;
      writeName(chainId, address, next);
    },
    [chainId, address],
  );

  return { name, rename };
}

/**
 * Name a collective outside of React's render cycle.
 *
 * The create form needs this: the address only exists once the receipt is in
 * hand, which is an effect, not a hook call.
 */
export function setCollectiveName(
  chainId: number,
  address: string,
  name: string,
) {
  writeName(chainId, address, name);
}
