"use client";

import { useQuery } from "@tanstack/react-query";
import { useBlockNumber } from "wagmi";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useChain } from "@/context/chain";
import { useSlotsClient } from "@/hooks/use-v3";

/**
 * How far the indexer trails the chain.
 *
 * Two things changed with the move off the subgraph:
 *
 *   * `_meta` returns `status`, a blob keyed by ponder's own chain NAME, each
 *     entry carrying `{ id, block }`. The name is a config label, not something
 *     this app knows, so the entry is found by matching `id` to the chain.
 *   * `hasIndexingErrors` has no counterpart. Ponder halts on an indexing error
 *     rather than serving stale rows behind a flag, so a broken indexer shows up
 *     as a failed request — which is what `isError` already covers.
 */
function useIndexerMeta() {
  const { chainId } = useChain();
  const client = useSlotsClient();
  return useQuery({
    queryKey: ["indexer-meta", chainId],
    queryFn: async () => {
      const res = await client.getMeta();
      const status = res._meta?.status ?? {};
      return Object.values(status).find((c) => c?.id === chainId) ?? null;
    },
    refetchInterval: 10_000,
  });
}

export function IndexerStatus() {
  const { data: meta, isError } = useIndexerMeta();
  const { chainId } = useChain();
  const { data: chainBlock } = useBlockNumber({ chainId });

  if (isError) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 cursor-default">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            <span className="text-[10px] text-red-500">ERR</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>Indexer unreachable</TooltipContent>
      </Tooltip>
    );
  }

  if (!meta?.block || !chainBlock) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 cursor-default">
            <span className="relative flex h-2 w-2">
              <span className="relative inline-flex rounded-full h-2 w-2 bg-muted-foreground/30" />
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {meta ? "Waiting for indexer" : "Loading indexer status…"}
        </TooltipContent>
      </Tooltip>
    );
  }

  const indexedBlock = BigInt(meta.block.number);
  const behind = Number(chainBlock - indexedBlock);

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
              className={`text-[10px] ${behind > 100 ? "text-red-500" : behind > 20 ? "text-orange-500" : "text-yellow-500"}`}
            >
              {label}
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>Indexer — block {meta.block.number}</p>
        <p className="text-muted-foreground">
          Chain block {chainBlock.toString()} ·{" "}
          {behind === 0 ? "fully synced" : `${behind} blocks behind`}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
