"use client";

import type { SlotState } from "@0xslots/sdk/slots";
import { Check, ShieldOff, X } from "lucide-react";
import { useState } from "react";
import { type Address, isAddress } from "viem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsOperator } from "@/hooks/slots/use-slots";
import type { useSlotsAction } from "@/hooks/slots/use-slots-action";
import { truncateAddress } from "@/utils";

type Actions = ReturnType<typeof useSlotsAction>;

/**
 * Delegating the price, and nothing else.
 *
 * Occupant-only, the same way `Manage` is manager-only: `setOperator` is
 * `onlyOccupant` on chain, so offering the controls to anyone else is offering
 * a button that reverts.
 *
 * ── Two things that are invisible when they are wrong ────────────────────
 *
 * 1. An approval is scoped to `tenureId()`, and a tenure ends on any occupancy
 *    change — a sale, a release, a liquidation. The approval dies with it,
 *    SILENTLY: no event is emitted, nothing on chain announces it, and the
 *    grant simply stops being true. So this panel reads `isOperator(address)`
 *    live for whichever address is in the field and never accumulates
 *    `OperatorSet` events — a list built from those events would keep showing
 *    operators whose rights evaporated at the last transition, which is the
 *    most dangerous kind of stale: a permission you believe you revoked, or one
 *    you believe you still have.
 *
 *    It does not resurrect either. Retaking a slot you once held starts a fresh
 *    tenure, which approves nobody.
 *
 * 2. An operator may call `selfAssess` and NOTHING else. Not withdraw, not
 *    release, not delegate onward. Worth stating outright, because "operator"
 *    in most protocols means something much closer to full control.
 */
export function DelegationTab({
  slot,
  state,
  actions,
}: {
  slot: Address;
  state: SlotState;
  actions: Actions;
}) {
  const [operator, setOperator] = useState("");
  const candidate = isAddress(operator) ? (operator as Address) : undefined;

  // Live, per keystroke-completed address. Never a cached list.
  const { data: isOperator, isLoading } = useIsOperator(slot, candidate);

  return (
    <div className="space-y-3 text-sm">
      <div className="space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Operator
        </p>
        <p className="text-[11px] leading-snug text-muted-foreground">
          An operator may restate this slot&apos;s price on your behalf — that
          is the whole of it. Withdrawing from the deposit, releasing the slot
          and delegating to anyone else all stay with you.
        </p>
      </div>

      <div className="flex gap-0">
        <Input
          value={operator}
          placeholder="0x…"
          onChange={(e) => setOperator(e.target.value)}
          className="rounded-none text-xs"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="rounded-none border-l-0"
          disabled={!candidate || actions.busy || isOperator === true}
          onClick={() =>
            candidate && actions.setOperator(slot, candidate, true)
          }
        >
          Allow
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="rounded-none border-l-0"
          disabled={!candidate || actions.busy || isOperator === false}
          onClick={() =>
            candidate && actions.setOperator(slot, candidate, false)
          }
        >
          Revoke
        </Button>
      </div>

      {/* The answer for the address in the field, read from the chain right
          now. Blank until there is a valid address to ask about, because a
          status shown for a half-typed address is a status about nobody. */}
      {candidate ? (
        <div className="flex items-center gap-1.5 text-xs">
          {isLoading ? (
            <span className="text-muted-foreground">checking…</span>
          ) : isOperator ? (
            <>
              <Check className="size-3.5 text-emerald-500" />
              <span>
                <span>{truncateAddress(candidate)}</span> may reprice this slot
                for you.
              </span>
            </>
          ) : (
            <>
              <X className="size-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">
                <span>{truncateAddress(candidate)}</span> is not an operator on
                this slot.
              </span>
            </>
          )}
        </div>
      ) : null}

      <div className="flex gap-2 border-t pt-3">
        <ShieldOff className="mt-0.5 size-4 shrink-0 text-amber-500" />
        <p className="text-[11px] leading-snug text-muted-foreground">
          Approvals are scoped to your current tenure (
          <span>#{state.tenureId.toString()}</span>) and end with it. If the
          slot is sold, released or liquidated, every operator you named stops
          being one — with no event and no notice. Retaking the slot later
          starts a fresh tenure that approves nobody, so a grant never comes
          back from the dead.
        </p>
      </div>
    </div>
  );
}
