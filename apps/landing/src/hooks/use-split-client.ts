import { SplitV2Client } from "@0xsplits/splits-sdk";
import { useMemo } from "react";
import { usePublicClient, useWalletClient } from "wagmi";
import { useChain } from "@/context/chain";
import { splitsSupported } from "@/lib/splits-support";

/**
 * Null on chains 0xSplits does not deploy to.
 *
 * The constructor builds a read client eagerly and throws
 * `Unsupported chain: <id>`, so on a local anvil merely calling this hook took
 * the whole page down. Callers must handle null — which is honest, because a
 * split genuinely cannot be created there.
 */
export function useSplitClient(): SplitV2Client | null {
  const { chainId } = useChain();
  const publicClient = usePublicClient({ chainId });
  const { data: walletClient } = useWalletClient({ chainId });

  return useMemo(() => {
    if (!splitsSupported(chainId)) return null;
    return new SplitV2Client({
      chainId,
      publicClient,
      walletClient,
      apiConfig: {
        apiKey: process.env.NEXT_PUBLIC_0xSPLITS_API_KEY as string,
      },
    });
  }, [chainId, publicClient, walletClient]);
}
