"use client";

import type { SlotState } from "@0xslots/sdk/slots";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Banknote,
  Flame,
  HandCoins,
  LogOut,
  ShoppingCart,
  Tag,
  UserCog,
} from "lucide-react";
import { useState } from "react";
import { type Address, formatUnits, isAddress } from "viem";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CurrencyMeta } from "@/hooks/slots/use-slots";
import { useTakeQuote, useWithdrawable } from "@/hooks/slots/use-slots";
import type { useSlotsAction } from "@/hooks/slots/use-slots-action";
import { useCurrencyBalance } from "@/hooks/use-currency-balance";
import { formatBalance, toRawUnits } from "@/utils";
import { ActionRow, Field, NumberField, Panel } from "./panel";

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
 * Take the slot — by buying it, or by evicting whoever is on it.
 *
 * `buy` moves `price() + deposit`: the outgoing occupant is bought out at the
 * price THEY declared. `liquidateAndTake` moves the deposit alone, because the
 * eviction runs first and there is no longer anyone to buy out.
 */
export function TakePanel({
  slot,
  state,
  currency,
  actions,
  minDepositFor,
}: ActionProps) {
  const { address, isConnected } = useAccount();
  const balance = useCurrencyBalance(state.currency);
  const [price, setPrice] = useState("");
  const [deposit, setDeposit] = useState("");
  const [seat, setSeat] = useState("");
  const [showSeat, setShowSeat] = useState(false);

  const priceRaw = toRawUnits(price, currency.decimals);
  const depositRaw = toRawUnits(deposit, currency.decimals);
  const required = minDepositFor(priceRaw);
  const seatAddress = (showSeat && seat.trim() ? seat.trim() : address) as
    | Address
    | undefined;

  const seatValid = !!seatAddress && isAddress(seatAddress);
  const ready =
    isConnected && seatValid && priceRaw > 0n && depositRaw > 0n;

  // Asked of the slot, never derived. `liquidateAndTake` charges the deposit
  // alone — the eviction vacates the slot before the purchase reads the price —
  // and a native slot demands an exact `msg.value`, so guessing here reverts.
  const { data: quote } = useTakeQuote(
    slot,
    depositRaw,
    state.isInsolvent ? "liquidateAndTake" : "buy",
  );

  const submit = () => {
    if (!ready) return;
    const params = {
      slot,
      account: seatAddress as Address,
      depositAmount: depositRaw,
      selfAssessedPrice: priceRaw,
    };
    if (state.isInsolvent) actions.liquidateAndTake(params);
    else actions.buy(params);
  };

  return (
    <Panel
      icon={ShoppingCart}
      title={state.isInsolvent ? "Evict and take" : "Take this slot"}
      tint="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    >
      <NumberField
        label="Your price"
        suffix={currency.symbol}
        placeholder="what you say it is worth"
        value={price}
        onChange={setPrice}
        hint="Anyone may take the slot from you at this price, and your tax is charged on it."
      />
      <NumberField
        label="Deposit"
        suffix={currency.symbol}
        placeholder="escrow the tax comes out of"
        value={deposit}
        onChange={setDeposit}
        hint={
          required > 0n
            ? `At least ${fmt(required, currency)} is required at that price.`
            : "The escrow tax is realised out of. Run it dry and anyone may evict you."
        }
      />

      <button
        type="button"
        className="text-[10px] text-muted-foreground underline underline-offset-2"
        onClick={() => setShowSeat((v) => !v)}
      >
        {showSeat ? "Seat myself" : "Seat a different address"}
      </button>
      {showSeat ? (
        <div className="space-y-1">
          <Input
            value={seat}
            placeholder={address ?? "0x…"}
            onChange={(e) => setSeat(e.target.value)}
            className="rounded-none font-mono text-xs"
          />
          <p className="text-[10px] leading-snug text-muted-foreground">
            You pay; this address occupies. The protocol connects the two with
            nothing — which is what lets a contract acquire a slot for someone
            else.
          </p>
        </div>
      ) : null}

      <div className="border-t pt-2">
        <Field
          label="You pay"
          value={
            depositRaw <= 0n
              ? "—"
              : quote === undefined
                ? "…"
                : fmt(quote, currency)
          }
          hint={
            state.isInsolvent
              ? "the deposit alone — there is nobody left to buy out"
              : state.isVacant
                ? "the deposit alone — the slot is vacant"
                : "your deposit, plus buying the occupant out at their own price"
          }
          emphasis
        />
        <Field label="Your balance" value={fmt(balance, currency)} />
        {state.isInsolvent ? (
          <p className="pt-1 text-[10px] leading-snug text-muted-foreground">
            Eviction and claim in one transaction. Plain liquidation leaves the
            slot vacant, and you then race everyone watching the mempool for it.
          </p>
        ) : null}
      </div>

      <Button
        className="w-full"
        disabled={!ready || actions.busy}
        onClick={submit}
      >
        {state.isInsolvent
          ? "Liquidate and take"
          : state.isVacant
            ? "Claim slot"
            : "Buy slot"}
      </Button>
      {!isConnected ? (
        <p className="text-[10px] text-muted-foreground">
          Connect a wallet to take this slot.
        </p>
      ) : null}
    </Panel>
  );
}

/** What the occupant — and only the occupant — may do. */
export function OccupantPanel({
  slot,
  state,
  currency,
  actions,
  canReprice,
  isOccupant,
}: ActionProps & { canReprice: boolean; isOccupant: boolean }) {
  const [price, setPrice] = useState("");
  const [amount, setAmount] = useState("");
  const [operator, setOperator] = useState("");

  return (
    <Panel
      icon={UserCog}
      title={isOccupant ? "Your position" : "You are an operator"}
      tint="bg-violet-500/10 text-violet-600 dark:text-violet-400"
    >
      {canReprice ? (
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
          hint="Restates what the slot is worth. Raises or lowers both your tax and the price anyone may take it at."
        />
      ) : null}

      {!isOccupant ? (
        <p className="text-[10px] leading-snug text-muted-foreground">
          Repricing is delegated to you. Withdrawing, releasing and delegating
          further stay with the occupant.
        </p>
      ) : null}

      {isOccupant ? (
        <>
      <ActionRow
        label="Withdraw from deposit"
        suffix={currency.symbol}
        value={amount}
        onChange={setAmount}
        submitLabel="Withdraw"
        busy={actions.busy}
        disabled={toRawUnits(amount, currency.decimals) <= 0n}
        onSubmit={() =>
          actions.withdraw(slot, toRawUnits(amount, currency.decimals))
        }
        hint="Whatever the minimum runway requires stays behind."
      />

      <div className="space-y-1">
        <label className="text-[11px] font-medium text-muted-foreground">
          Operator
        </label>
        <div className="flex gap-0">
          <Input
            value={operator}
            placeholder="0x…"
            onChange={(e) => setOperator(e.target.value)}
            className="rounded-none font-mono text-xs"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-none border-l-0"
            disabled={!isAddress(operator) || actions.busy}
            onClick={() => actions.setOperator(slot, operator as Address, true)}
          >
            Allow
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-none border-l-0"
            disabled={!isAddress(operator) || actions.busy}
            onClick={() =>
              actions.setOperator(slot, operator as Address, false)
            }
          >
            Revoke
          </Button>
        </div>
        <p className="text-[10px] leading-snug text-muted-foreground">
          An operator may reprice on your behalf. The grant does not survive
          your tenure.
        </p>
      </div>

      <Button
        variant="outline"
        className="w-full"
        disabled={actions.busy}
        onClick={() => actions.release(slot)}
      >
        <LogOut className="size-3.5" />
        Release and take back the deposit
      </Button>
        </>
      ) : null}
    </Panel>
  );
}

/**
 * The permissionless actions.
 *
 * Grouped apart from the occupant's because the distinction is real and
 * load-bearing: anyone may fund anyone's slot, flush its tax, or evict a
 * defaulted occupant, and none of it needs a protocol permission.
 */
export function PublicPanel({
  slot,
  state,
  currency,
  actions,
}: ActionProps) {
  const { address } = useAccount();
  const [amount, setAmount] = useState("");
  const { data: withdrawable } = useWithdrawable(slot, address);

  return (
    <Panel
      icon={HandCoins}
      title="Anyone may"
      tint="bg-slate-500/10 text-slate-600 dark:text-slate-400"
    >
      {!state.isVacant ? (
        <ActionRow
          label="Top up the deposit"
          suffix={currency.symbol}
          value={amount}
          onChange={setAmount}
          submitLabel="Top up"
          busy={actions.busy}
          disabled={toRawUnits(amount, currency.decimals) <= 0n}
          onSubmit={() =>
            actions.topUp(slot, toRawUnits(amount, currency.decimals))
          }
          hint="Permissionless — funding someone else's slot needs no permission at all."
        />
      ) : null}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          disabled={actions.busy}
          onClick={() => actions.collect(slot)}
        >
          <Banknote className="size-3.5" />
          Collect tax
        </Button>

        {state.isInsolvent ? (
          <Button
            variant="outline"
            size="sm"
            disabled={actions.busy}
            onClick={() => actions.liquidate(slot)}
          >
            <Flame className="size-3.5" />
            Liquidate
          </Button>
        ) : null}

        {withdrawable && withdrawable > 0n ? (
          <Button
            variant="outline"
            size="sm"
            disabled={actions.busy}
            onClick={() => actions.claim(slot, address)}
          >
            <ArrowDownToLine className="size-3.5" />
            Claim {fmt(withdrawable, currency)}
          </Button>
        ) : null}
      </div>

      <p className="text-[10px] leading-snug text-muted-foreground">
        Collecting flushes accrued tax to the recipient. Liquidating evicts an
        occupant whose deposit is spent and leaves the slot vacant — there is no
        bounty; the reward is that the slot becomes takeable.
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

