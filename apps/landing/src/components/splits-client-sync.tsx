"use client";

import { useSplitsClient } from "@0xsplits/splits-sdk-react";
import { usePublicClient } from "wagmi";
import { useChain } from "@/context/chain";
import { splitsSupported } from "@/lib/splits-support";

export function SplitsClientSync() {
  const { chainId } = useChain();
  // The hooks live in the inner component so they are never called on a chain
  // splits would reject — a hook cannot be skipped, but a component can.
  if (!splitsSupported(chainId)) return null;
  return <Sync chainId={chainId} />;
}

function Sync({ chainId }: { chainId: number }) {
  const publicClient = usePublicClient({ chainId });

  useSplitsClient({
    chainId,
    publicClient,
    apiConfig: {
      apiKey: process.env.NEXT_PUBLIC_0xSPLITS_API_KEY as string,
    },
  });

  return null;
}
