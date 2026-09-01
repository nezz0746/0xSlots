"use client";

import type { SlotState } from "@0xslots/sdk/slots";
import { Settings2 } from "lucide-react";
import { useState } from "react";
import { type Address, isAddress, zeroAddress } from "viem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { useSlotsAction } from "@/hooks/slots/use-slots-action";
import { NumberField, Panel } from "./panel";

type Actions = ReturnType<typeof useSlotsAction>;

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
  const hookAddress = (
    hookTrimmed === "" ? zeroAddress : hookTrimmed
  ) as Address;

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
      </div>
      <p className="text-[10px] leading-snug text-muted-foreground">
        A proposal never applies immediately. It waits for the next occupancy
        transition, so the occupant keeps the terms they bought into.
      </p>
    </Panel>
  );
}
