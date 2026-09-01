"use client";

import { slotAbi } from "@0xslots/contracts";
import { useQuery } from "@tanstack/react-query";
import { Boxes, Loader2, Plus, X } from "lucide-react";
import { useState } from "react";
import { type Address, isAddress, zeroAddress } from "viem";
import { useAccount, usePublicClient } from "wagmi";

import { CopyAddress } from "@/components/copy-address";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChain } from "@/context/chain";
import { useSlotAction } from "@/hooks/use-slot-action";
import type { SlotOnChain } from "@/hooks/use-slot-onchain";

/**
 * The module gallery for one slot.
 *
 * ── The distinction this panel exists to make ───────────────────────────────
 *
 * `addModule` QUEUES. The install lands on the slot's next occupancy
 * transition, so an occupant never has modules added under them mid-tenure.
 * Rendering a queued module as though it were live would be the single most
 * misleading thing here: nothing is calling it yet, and nothing will until the
 * slot changes hands.
 *
 * Removal is the opposite — immediate, deliberately. Adding imposes cost on the
 * occupant; removing only withdraws it, so there is nobody to protect by
 * waiting. It is also the lever for detaching a module found to be broken,
 * which must not have to wait out a tenure that may run for years.
 */
export function ModulesPanel({
  slot,
  slotAddress,
  isManager,
}: {
  slot: SlotOnChain;
  slotAddress: Address;
  isManager: boolean;
}) {
  const { chainId } = useChain();
  const client = usePublicClient({ chainId });
  const { address } = useAccount();
  const { addModule, removeModule, busy } = useSlotAction();
  const [candidate, setCandidate] = useState("");

  const { data, refetch } = useQuery({
    queryKey: ["readContract", "modules", chainId, slotAddress],
    enabled: !!client,
    queryFn: async () => {
      if (!client) return undefined;
      const [installed, pending, max] = await Promise.all([
        client.readContract({
          address: slotAddress,
          abi: slotAbi,
          functionName: "galleryModules",
        }) as Promise<readonly Address[]>,
        client.readContract({
          address: slotAddress,
          abi: slotAbi,
          functionName: "pendingModules",
        }) as Promise<readonly Address[]>,
        client.readContract({
          address: slotAddress,
          abi: slotAbi,
          functionName: "MAX_MODULES",
        }) as Promise<bigint>,
      ]);
      return { installed, pending, max };
    },
  });

  const head =
    slot.utility && slot.utility.toLowerCase() !== zeroAddress
      ? (slot.utility as Address)
      : null;

  const used = (data?.installed.length ?? 0) + (data?.pending.length ?? 0);
  const atCap = data ? BigInt(used) >= data.max : false;
  const valid = isAddress(candidate);

  const act = async (fn: Promise<`0x${string}` | undefined>) => {
    const hash = await fn;
    if (hash) await refetch();
  };

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Boxes className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Modules</h3>
        </div>
        {data && (
          <span className="text-[10px] text-muted-foreground">
            {used} / {data.max.toString()}
          </span>
        )}
      </div>

      <div className="mt-3 space-y-1">
        {head && (
          <Row
            address={head}
            label="primary"
            tone="default"
            // The head predates the gallery and can only be VACATED, never
            // replaced — so a manager can detach it, and that is one-way.
            onRemove={
              isManager && slot.mutableModule
                ? () => act(removeModule(slotAddress, head))
                : undefined
            }
            busy={busy}
          />
        )}

        {data?.installed.map((m) => (
          <Row
            key={m}
            address={m}
            label="active"
            tone="active"
            onRemove={
              isManager ? () => act(removeModule(slotAddress, m)) : undefined
            }
            busy={busy}
          />
        ))}

        {data?.pending.map((m) => (
          <Row
            key={m}
            address={m}
            label="queued"
            tone="queued"
            onRemove={
              isManager ? () => act(removeModule(slotAddress, m)) : undefined
            }
            busy={busy}
          />
        ))}

        {!head && used === 0 && (
          <p className="py-4 text-xs text-muted-foreground">
            No modules. A slot works without them — they add what holding it
            grants.
          </p>
        )}
      </div>

      {(data?.pending.length ?? 0) > 0 && (
        <p className="mt-2 rounded border border-dashed px-2.5 py-2 text-[11px] leading-snug text-muted-foreground">
          Queued modules are not live yet. They install on this slot&apos;s next
          occupancy change, so the current occupant keeps the terms they bought
          into.
        </p>
      )}

      {isManager && slot.mutableModule && (
        <div className="mt-3 space-y-2 border-t pt-3">
          <Input
            value={candidate}
            onChange={(e) => setCandidate(e.target.value)}
            placeholder="Module address (0x…)"
            disabled={busy || atCap}
          />
          <Button
            className="w-full"
            size="sm"
            disabled={busy || !valid || atCap || !address}
            onClick={() => {
              void act(addModule(slotAddress, candidate as Address));
              setCandidate("");
            }}
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Plus className="size-3.5" />
            )}
            Queue module
          </Button>
          <p className="text-[11px] leading-snug text-muted-foreground">
            {atCap
              ? "This slot is at its module limit."
              : "The module must be verified by the factory, or the slot will refuse it."}
          </p>
        </div>
      )}

      {isManager && !slot.mutableModule && (
        <p className="mt-3 border-t pt-3 text-[11px] text-muted-foreground">
          This slot was created with a fixed module set. That promise is
          permanent — modules can be neither added nor removed.
        </p>
      )}
    </div>
  );
}

function Row({
  address,
  label,
  tone,
  onRemove,
  busy,
}: {
  address: Address;
  label: string;
  tone: "default" | "active" | "queued";
  onRemove?: () => void;
  busy: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b py-1.5 last:border-b-0">
      <div className="flex min-w-0 items-center gap-2">
        <CopyAddress address={address} ens />
        <Badge
          variant={tone === "queued" ? "outline" : "secondary"}
          className={
            tone === "active"
              ? "bg-emerald-600/10 text-[10px] text-emerald-700 dark:text-emerald-400"
              : "text-[10px]"
          }
        >
          {label}
        </Badge>
      </div>
      {onRemove && (
        <button
          type="button"
          disabled={busy}
          onClick={onRemove}
          title="Removal is immediate — it does not wait for a transition"
          className="text-muted-foreground hover:text-destructive"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
