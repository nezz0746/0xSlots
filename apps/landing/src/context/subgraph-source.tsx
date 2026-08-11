"use client";

import { SubgraphSource } from "@0xslots/sdk";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

const STORAGE_KEY = "0xslots.subgraph-source";

interface SubgraphSourceContextValue {
  source: SubgraphSource;
  /** Convenience for the common `source === Studio` test. */
  isStudio: boolean;
  setStudio: (on: boolean) => void;
}

const SubgraphSourceContext = createContext<SubgraphSourceContextValue | null>(
  null,
);

/**
 * Resolve the stored preference synchronously, on the very first render.
 *
 * Touching `window` here is safe for the same reason `ChainProvider` does it:
 * this provider tree sits behind FarcasterProvider's `isReady` gate, so it
 * never renders on the server and there is no hydration pass to mismatch
 * against. Resolving in an effect instead would fire every query once against
 * the gateway before correcting itself.
 *
 * Deliberately NOT mirrored into the URL, unlike the chain. The chain decides
 * what you are looking at and belongs in a shared link; this decides which
 * copy of the index you read it from, which is a property of your machine.
 */
function resolveInitialSource(): SubgraphSource {
  if (typeof window === "undefined") return SubgraphSource.Network;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === SubgraphSource.Studio
      ? SubgraphSource.Studio
      : SubgraphSource.Network;
  } catch {
    // localStorage throws in private mode / when storage is disabled
    return SubgraphSource.Network;
  }
}

export function SubgraphSourceProvider({ children }: { children: ReactNode }) {
  const initial = useRef(resolveInitialSource());
  const [source, setSource] = useState<SubgraphSource>(initial.current);

  const setStudio = useCallback((on: boolean) => {
    const next = on ? SubgraphSource.Studio : SubgraphSource.Network;
    setSource(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // non-fatal — the switch still applies for this session
    }
  }, []);

  const value = useMemo(
    () => ({
      source,
      isStudio: source === SubgraphSource.Studio,
      setStudio,
    }),
    [source, setStudio],
  );

  return (
    <SubgraphSourceContext.Provider value={value}>
      {children}
    </SubgraphSourceContext.Provider>
  );
}

export function useSubgraphSource(): SubgraphSourceContextValue {
  const ctx = useContext(SubgraphSourceContext);
  if (!ctx)
    throw new Error(
      "useSubgraphSource must be used within SubgraphSourceProvider",
    );
  return ctx;
}
