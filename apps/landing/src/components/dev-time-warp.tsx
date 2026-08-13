"use client";

import { SlotsChain } from "@0xslots/sdk";
import { useQueryClient } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createTestClient, http, publicActions } from "viem";
import { anvil } from "viem/chains";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useChain } from "@/context/chain";

/**
 * Time controls for the local chain.
 *
 * Harberger tax only does anything as time passes: a deposit draining, a slot
 * becoming liquidatable, tax accruing to a recipient. On a real network that is
 * a waiting game measured in days, which makes those paths effectively
 * untestable by hand. Here it is a button.
 *
 * Renders on chain 31337 only, and the whole module is dead code in a
 * production build because `CHAINS` never offers anvil there.
 */
const testClient = createTestClient({
  chain: anvil,
  mode: "anvil",
  transport: http("http://127.0.0.1:8545"),
}).extend(publicActions);

const STEPS = [
  { label: "+1d", seconds: 86_400 },
  { label: "+7d", seconds: 604_800 },
  { label: "+30d", seconds: 2_592_000 },
] as const;

function formatDrift(seconds: number): string {
  if (seconds < 60) return "in sync";
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  if (days > 0) return `+${days}d ${hours}h ahead`;
  const minutes = Math.floor((seconds % 3_600) / 60);
  return `+${hours}h ${minutes}m ahead`;
}

export function DevTimeWarp() {
  const { chainId } = useChain();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [drift, setDrift] = useState<number | null>(null);

  const isLocal = chainId === SlotsChain.ANVIL;

  const readDrift = useCallback(async () => {
    try {
      const block = await testClient.getBlock();
      setDrift(Number(block.timestamp) - Math.floor(Date.now() / 1000));
    } catch {
      setDrift(null); // chain not up — the panel just shows no drift
    }
  }, []);

  useEffect(() => {
    if (!isLocal) return;
    readDrift();
    const id = setInterval(readDrift, 5_000);
    return () => clearInterval(id);
  }, [isLocal, readDrift]);

  const run = useCallback(
    async (label: string, fn: () => Promise<void>) => {
      setBusy(label);
      try {
        await fn();
        await readDrift();
        // The chain moved; every indexed read is now stale. Ponder needs a
        // moment to catch up, so this is optimistic — the status dot beside the
        // chain picker is what says whether it has.
        await queryClient.invalidateQueries();
      } finally {
        setBusy(null);
      }
    },
    [queryClient, readDrift],
  );

  if (!isLocal) return null;

  return (
    <div className="px-2 pb-2 space-y-1.5">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <Clock className="size-3" />
        <span>Time warp</span>
        {drift !== null && (
          <span className="ml-auto tabular-nums">{formatDrift(drift)}</span>
        )}
      </div>
      <div className="flex gap-1">
        {STEPS.map((step) => (
          <Tooltip key={step.label}>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[11px] flex-1"
                disabled={busy !== null}
                onClick={() =>
                  run(step.label, async () => {
                    await testClient.increaseTime({ seconds: step.seconds });
                    // Nothing settles until a block carries the new timestamp.
                    await testClient.mine({ blocks: 1 });
                  })
                }
              >
                {busy === step.label ? "…" : step.label}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Advance the chain by {step.label.replace("+", "")} and mine a block
            </TooltipContent>
          </Tooltip>
        ))}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px]"
              disabled={busy !== null}
              onClick={() =>
                run("mine", () =>
                  testClient.mine({ blocks: 1 }).then(() => undefined),
                )
              }
            >
              {busy === "mine" ? "…" : "⛏"}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Mine one block</TooltipContent>
        </Tooltip>
      </div>
      <p className="text-[9px] text-muted-foreground/70 leading-tight">
        One-way — restart the stack to reset.
      </p>
    </div>
  );
}
