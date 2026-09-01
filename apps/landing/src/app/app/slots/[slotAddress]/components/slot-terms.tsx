"use client";

import { findKnownHook } from "@0xslots/contracts/slots";
import type { SlotState } from "@0xslots/sdk/slots";
import { formatDistanceToNow } from "date-fns";
import { Hourglass, Settings2, X } from "lucide-react";
import { useState } from "react";
import { type Address, isAddress, zeroAddress } from "viem";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChain } from "@/context/chain";
import type { useSlotsAction } from "@/hooks/slots/use-slots-action";
import { formatBps } from "@/utils";
import { AddressText, Field, NumberField, Panel } from "./panel";

type Actions = ReturnType<typeof useSlotsAction>;

function hookLabel(chainId: number, hook: Address) {
  if (hook === zeroAddress) return "none — detached";
  return findKnownHook(chainId, hook)?.name ?? hook;
}

/**
 * Terms the manager has queued.
 *
 * Rendered as PENDING and never folded into the terms above it. The deferral is
 * a promise the protocol makes to the occupant — the terms they bought into
 * hold for their whole tenure — and a queued change drawn as a live one turns
 * that promise into a surprise.
 */
export function PendingTermsPanel({ state }: { state: SlotState }) {
  const { chainId } = useChain();
  const { pending } = state;
  if (pending.isEmpty) return null;

  const proposedAt = new Date(Number(pending.proposedAt) * 1000);

  return (
    <Panel
      icon={Hourglass}
      title="Pending terms"
      tint="bg-amber-500/15 text-amber-600 dark:text-amber-400"
      actions={
        <Badge className="gap-1 bg-amber-500/15 text-amber-700 dark:text-amber-400">
          not yet in force
        </Badge>
      }
    >
      <p className="text-[11px] leading-snug text-muted-foreground">
        Queued, not applied. These land at the{" "}
        <strong className="font-medium text-foreground">
          next occupancy transition
        </strong>{" "}
        — a buy, a sell, a release or a liquidation. Until then this slot runs on
        the terms shown above, and{" "}
        {state.isVacant
          ? "the next person to take it will be the first to pay them."
          : "the current occupant keeps the ones they bought into."}
      </p>

      {pending.hasTax ? (
        <Field
          label="Tax will become"
          value={`${formatBps(Number(pending.taxPercentage))} / 30 days`}
          hint={`from ${formatBps(Number(state.taxPercentage))}`}
          emphasis
        />
      ) : null}
      {pending.hasHook ? (
        <Field
          label="Hook will become"
          value={
            pending.hook === zeroAddress ? (
              "none — detached"
            ) : (
              <span className="inline-flex items-center gap-1.5">
                {findKnownHook(chainId, pending.hook)?.name ?? "Unrecognised"}
                <AddressText address={pending.hook} />
              </span>
            )
          }
          hint={`from ${hookLabel(chainId, state.hook)}`}
          emphasis
        />
      ) : null}
      <Field
        label="Proposed"
        value={
          pending.proposedAt === 0n
            ? "—"
            : `${formatDistanceToNow(proposedAt)} ago`
        }
      />
    </Panel>
  );
}

/**
 * The manager's controls.
 *
 * Each dimension is offered only when the slot said at birth that it could
 * move. A slot with neither has no manager at all — `initialize` rejects one —
 * so this panel does not render for it.
 */
export function ManageTermsPanel({
  slot,
  state,
  actions,
}: {
  slot: Address;
  state: SlotState;
  actions: Actions;
}) {
  const [tax, setTax] = useState("");
  const [hook, setHook] = useState("");
  const [changeTax, setChangeTax] = useState(false);
  const [changeHook, setChangeHook] = useState(false);

  const taxBps = BigInt(Math.round(Number(tax.replace(",", ".")) * 100 || 0));
  const hookTrimmed = hook.trim();
  // A blank hook field means DETACH, which is a real intention and the exact
  // case a truthiness check would silently drop.
  const hookAddress = (hookTrimmed === "" ? zeroAddress : hookTrimmed) as Address;

  const taxValid = !changeTax || (taxBps > 0n && taxBps <= 10_000n);
  const hookValid = !changeHook || isAddress(hookAddress);
  const ready = (changeTax || changeHook) && taxValid && hookValid;

  return (
    <Panel
      icon={Settings2}
      title="Manage terms"
      tint="bg-rose-500/10 text-rose-600 dark:text-rose-400"
      subtitle={
        <span className="text-[10px] text-muted-foreground">manager only</span>
      }
    >
      {state.mutableTax ? (
        <div className="space-y-1">
          <label className="flex items-center gap-1.5 text-[11px] font-medium">
            <input
              type="checkbox"
              checked={changeTax}
              onChange={(e) => setChangeTax(e.target.checked)}
            />
            Change the tax rate
          </label>
          {changeTax ? (
            <NumberField
              label="New tax"
              suffix="% / 30 days"
              placeholder={String(Number(state.taxPercentage) / 100)}
              value={tax}
              onChange={setTax}
              hint={
                taxValid
                  ? undefined
                  : "Must be above 0 and at most 100% per 30 days."
              }
            />
          ) : null}
        </div>
      ) : null}

      {state.mutableHook ? (
        <div className="space-y-1">
          <label className="flex items-center gap-1.5 text-[11px] font-medium">
            <input
              type="checkbox"
              checked={changeHook}
              onChange={(e) => setChangeHook(e.target.checked)}
            />
            Change the hook
          </label>
          {changeHook ? (
            <div className="space-y-1">
              <Input
                value={hook}
                placeholder="0x… — leave blank to detach"
                onChange={(e) => setHook(e.target.value)}
                className="rounded-none font-mono text-xs"
              />
              <p className="text-[10px] leading-snug text-muted-foreground">
                {hookTrimmed === ""
                  ? "Blank detaches the hook entirely."
                  : hookValid
                    ? "Attaching reads the hook's declared subscriptions once and snapshots them."
                    : "Not a valid address."}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex gap-2 border-t pt-2">
        <Button
          size="sm"
          disabled={!ready || actions.busy}
          onClick={() =>
            actions.proposeTerms(slot, {
              ...(changeTax ? { taxPercentage: taxBps } : {}),
              ...(changeHook ? { hook: hookAddress } : {}),
            })
          }
        >
          Propose
        </Button>
        {!state.pending.isEmpty ? (
          <Button
            size="sm"
            variant="outline"
            disabled={actions.busy}
            onClick={() => actions.cancelProposal(slot)}
          >
            <X className="size-3.5" />
            Cancel proposal
          </Button>
        ) : null}
      </div>
      <p className="text-[10px] leading-snug text-muted-foreground">
        A proposal never applies immediately. It waits for the next occupancy
        transition, so the occupant keeps the terms they bought into.
      </p>
    </Panel>
  );
}
