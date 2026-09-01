"use client";

import type { SlotState } from "@0xslots/sdk/slots";
import { ArrowUpFromLine, Tag, UserCog } from "lucide-react";
import { useState } from "react";
import { type Address, formatUnits } from "viem";
import type { CurrencyMeta } from "@/hooks/slots/use-slots";
import type { useSlotsAction } from "@/hooks/slots/use-slots-action";
import { formatBalance, toRawUnits } from "@/utils";
import { ActionRow, Panel } from "./panel";

type Actions = ReturnType<typeof useSlotsAction>;

interface ActionProps {
  slot: Address;
  state: SlotState;
  currency: CurrencyMeta;
  actions: Actions;
  /** The deposit `minDepositSeconds` demands at the price being proposed. */
  minDepositFor: (price: bigint) => bigint;
}

function fmt(v: bigint, c: CurrencyMeta) {
  return `${formatBalance(v, c.decimals)} ${c.symbol}`;
}

/**
 * The operator's own view: repricing on someone else's behalf.
 *
 * Everything the OCCUPANT does has moved to where it belongs — price and
 * deposit into `ManageTerms` as one coupled form, granting and revoking
 * operators into the Delegation tab (`setOperator` is `onlyOccupant`), and
 * releasing into the disclosure behind the primary button. What is left is the
 * one case that is not the occupant at all: somebody who has been delegated the
 * price and needs a field for it.
 */
export function OccupantPanel({ slot, state, currency, actions }: ActionProps) {
  const [price, setPrice] = useState("");

  return (
    <Panel
      icon={UserCog}
      title="You are an operator"
      tint="bg-violet-500/10 text-violet-600 dark:text-violet-400"
    >
      <ActionRow
        label="Self-assess"
        suffix={currency.symbol}
        placeholder={formatUnits(state.price, currency.decimals)}
        value={price}
        onChange={setPrice}
        submitLabel="Set"
        busy={actions.busy}
        disabled={toRawUnits(price, currency.decimals) <= 0n}
        onSubmit={() =>
          actions.selfAssess(slot, toRawUnits(price, currency.decimals))
        }
        hint="Restates what the slot is worth. Raises or lowers both the occupant's tax and the price anyone may take it at."
      />
      <p className="text-[10px] leading-snug text-muted-foreground">
        Repricing is delegated to you, and it is the only thing that is.
        Funding, withdrawing, releasing and delegating further stay with the
        occupant — and this grant ends silently when their tenure does.
      </p>
    </Panel>
  );
}

/** Everything about escrow that has no home in the panels above. */
export function DepositSummary({
  state,
  currency,
}: {
  state: SlotState;
  currency: CurrencyMeta;
}) {
  return (
    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        <ArrowUpFromLine className="size-3" />
        deposit {fmt(state.deposit, currency)}
      </span>
      <span className="inline-flex items-center gap-1">
        <Tag className="size-3" />
        price {fmt(state.price, currency)}
      </span>
    </div>
  );
}
