"use client";

import { useQuery } from "@tanstack/react-query";
import { useBlockNumber } from "wagmi";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useChain } from "@/context/chain";
import { useSubgraphSource } from "@/context/subgraph-source";
import { withSource } from "@/hooks/slot-queries";
import { useSlotsClient } from "@/hooks/use-v3";

function useSubgraphMeta() {
  const { chainId } = useChain();
  const { source } = useSubgraphSource();
  const client = useSlotsClient();
  return useQuery({
    // Keyed by source like every other subgraph read. Without it the indicator
    // would keep reporting the network's head block after switching to Studio —
    // the one place a stale answer is actively misleading, since this dot is
    // what you check to see whether the deployment you switched to has synced.
    queryKey: withSource(["subgraph-meta", chainId], source),
    queryFn: async () => {
      const res = await client.getMeta();
      return res._meta;
    },
    refetchInterval: 10_000,
  });
}

export function SubgraphStatus() {
  const { data: meta, isError } = useSubgraphMeta();
  const { chainId } = useChain();
  const { data: chainBlock } = useBlockNumber({ chainId });

  if (isError || meta?.hasIndexingErrors) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 cursor-default">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            <span className="text-[10px] text-red-500 font-mono">ERR</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>Subgraph indexing error</TooltipContent>
      </Tooltip>
    );
  }

  if (!meta || !chainBlock) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 cursor-default">
            <span className="relative flex h-2 w-2">
              <span className="relative inline-flex rounded-full h-2 w-2 bg-muted-foreground/30" />
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>Loading subgraph status...</TooltipContent>
      </Tooltip>
    );
  }

  const subgraphBlock = BigInt(meta.block.number);
  const behind = Number(chainBlock - subgraphBlock);

  let color: string;
  let label: string;
  if (behind <= 5) {
    color = "bg-green-500";
    label = "synced";
  } else if (behind <= 20) {
    color = "bg-yellow-500";
    label = `${behind} behind`;
  } else if (behind <= 100) {
    color = "bg-orange-500";
    label = `${behind} behind`;
  } else {
    color = "bg-red-500";
    label = `${behind} behind`;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1.5 cursor-default">
          <span className="relative flex h-2 w-2">
            {behind <= 5 && (
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full ${color} opacity-75`}
              />
            )}
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${color}`}
            />
          </span>
          {behind > 5 && (
            <span
              className={`text-[10px] font-mono ${behind > 100 ? "text-red-500" : behind > 20 ? "text-orange-500" : "text-yellow-500"}`}
            >
              {label}
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>Subgraph indexer — block {meta.block.number}</p>
        <p className="text-muted-foreground">
          Chain block {chainBlock.toString()} ·{" "}
          {behind === 0 ? "fully synced" : `${behind} blocks behind`}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
