"use client";

import { findKnownHook } from "@0xslots/contracts/slots";
import type { HookFlags, SlotState } from "@0xslots/sdk/slots";
import {
  AlertTriangle,
  Clock,
  Coins,
  HandCoins,
  KeyRound,
  Lock,
  LockOpen,
  Plug,
  ShieldCheck,
  User,
} from "lucide-react";
import { formatUnits, zeroAddress } from "viem";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useChain } from "@/context/chain";
import type { CurrencyMeta } from "@/hooks/slots/use-slots";
import { cn } from "@/lib/utils";
import { formatBalance, formatBps, formatDuration } from "@/utils";
import { AddressText, Field, Panel } from "./panel";

const NEVER = 2n ** 255n;

/** "3d 4h", or "never" when the deposit can outlive the arithmetic. */
export function formatRunway(seconds: bigint): string {
  if (seconds >= NEVER) return "never";
  return formatDuration(Number(seconds));
}

export function SlotStatus({ state }: { state: SlotState }) {
  if (state.isVacant)
    return (
      <Badge variant="outline" className="gap-1">
        <Clock className="size-3" /> Vacant
      </Badge>
    );
  if (state.isInsolvent)
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="size-3" /> Insolvent
      </Badge>
    );
  return (
    <Badge className="gap-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
      <ShieldCheck className="size-3" /> Occupied
    </Badge>
  );
}

/** Whether a dimension can still be changed after creation. */
function Mutability({ mutable, what }: { mutable: boolean; what: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center px-1 py-0.5 text-[10px]",
            mutable
              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              : "bg-muted text-muted-foreground",
          )}
        >
          {mutable ? (
            <LockOpen className="size-2.5" />
          ) : (
            <Lock className="size-2.5" />
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        {mutable
          ? `Mutable — the manager may propose a new ${what}`
          : `Immutable — the ${what} is fixed forever`}
      </TooltipContent>
    </Tooltip>
  );
}

export function OccupancyPanel({
  state,
  currency,
}: {
  state: SlotState;
  currency: CurrencyMeta;
}) {
  const amount = (v: bigint) =>
    `${formatBalance(v, currency.decimals)} ${currency.symbol}`;

  return (
    <Panel
      icon={User}
      title="Occupancy"
      tint="bg-sky-500/10 text-sky-600 dark:text-sky-400"
      actions={<SlotStatus state={state} />}
    >
      <Field
        label="Occupant"
        value={
          state.isVacant ? (
            <span className="text-muted-foreground">nobody</span>
          ) : (
            <AddressText address={state.occupant} className="text-foreground" />
          )
        }
      />
      <Field label="Price" value={amount(state.price)} emphasis />
      <Field label="Deposit" value={amount(state.deposit)} />
      <Field
        label="Tax owed"
        value={amount(state.taxOwed)}
        hint={
          state.taxOwed > state.deposit
            ? "more than the deposit — the excess is never collected"
            : undefined
        }
      />
      <Field
        label="Liquidatable"
        value={
          state.isVacant ? (
            <span className="text-muted-foreground">—</span>
          ) : state.isInsolvent ? (
            <span className="text-destructive font-semibold">now</span>
          ) : (
            `in ${formatRunway(state.secondsUntilLiquidation)}`
          )
        }
        hint={
          !state.isVacant && !state.isInsolvent
            ? "when the deposit can no longer cover what is owed"
            : undefined
        }
      />
    </Panel>
  );
}

export function TermsPanel({
  state,
  currency,
  minDeposit,
}: {
  state: SlotState;
  currency: CurrencyMeta;
  /** The deposit `minDepositSeconds` demands at the CURRENT price. */
  minDeposit: bigint;
}) {
  return (
    <Panel
      icon={HandCoins}
      title="Terms"
      tint="bg-amber-500/10 text-amber-600 dark:text-amber-400"
    >
      <Field
        label={
          <>
            Tax
            <Mutability mutable={state.mutableTax} what="tax rate" />
          </>
        }
        value={`${formatBps(Number(state.taxPercentage))} / 30 days`}
        emphasis
      />
      <Field
        label="Minimum funded runway"
        value={
          state.minDepositSeconds === 0n
            ? "none"
            : formatDuration(Number(state.minDepositSeconds))
        }
        hint={
          state.minDepositSeconds === 0n
            ? undefined
            : `≥ ${formatBalance(minDeposit, currency.decimals)} ${currency.symbol} at the current price`
        }
      />
      <Field
        label={
          <>
            <Coins className="size-3" /> Currency
          </>
        }
        value={
          currency.isNative ? (
            "ETH (native)"
          ) : (
            <span className="inline-flex items-center gap-1.5">
              {currency.symbol || "ERC-20"}
              <AddressText address={state.currency} />
            </span>
          )
        }
      />
      <Field
        label="Tax recipient"
        value={<AddressText address={state.recipient} className="text-foreground" />}
      />
      <Field
        label={
          <>
            <KeyRound className="size-3" /> Manager
          </>
        }
        value={
          state.manager === zeroAddress ? (
            <span className="text-muted-foreground">
              none — fully immutable
            </span>
          ) : (
            <AddressText address={state.manager} className="text-foreground" />
          )
        }
      />
    </Panel>
  );
}

const DECIDES: [keyof HookFlags, string][] = [
  ["beforeBuy", "beforeBuy"],
  ["beforeSell", "beforeSell"],
  ["beforeSelfAssess", "beforeSelfAssess"],
];
const RECORDS: [keyof HookFlags, string][] = [
  ["afterBuy", "afterBuy"],
  ["afterSell", "afterSell"],
  ["afterRelease", "afterRelease"],
  ["afterLiquidate", "afterLiquidate"],
  ["afterSettle", "afterSettle"],
];

function FlagList({
  flags,
  entries,
}: {
  flags: HookFlags;
  entries: [keyof HookFlags, string][];
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {entries.map(([key, label]) => (
        <span
          key={key}
          className={cn(
            "px-1.5 py-0.5 font-mono text-[10px]",
            flags[key]
              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
              : "bg-muted/60 text-muted-foreground/50 line-through",
          )}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

/**
 * The slot's one extension point.
 *
 * `hook` and `hookFlags` are read together and BOTH are needed: a slot with no
 * hook reports all-false flags, and so would a hook with no subscriptions —
 * except that the latter cannot exist, because attaching one reverts. So
 * all-false flags mean "no hook", and the address is what proves it.
 */
export function HookPanel({ state }: { state: SlotState }) {
  const { chainId } = useChain();
  const attached = state.hook !== zeroAddress;
  const known = findKnownHook(chainId, attached ? state.hook : undefined);

  return (
    <Panel
      icon={Plug}
      title="Hook"
      tint="bg-blue-500/10 text-blue-600 dark:text-blue-400"
      actions={
        attached ? (
          <AddressText address={state.hook} />
        ) : (
          <Badge variant="outline">none</Badge>
        )
      }
    >
      {!attached ? (
        <p className="text-xs text-muted-foreground">
          Nothing extends this slot. Buying, selling and repricing answer to the
          protocol alone.
        </p>
      ) : (
        <>
          <p className="text-xs">
            {known?.name ?? "Unrecognised hook"}
          </p>
          <p className="text-[11px] leading-snug text-muted-foreground">
            {known?.description ??
              "This app cannot describe this hook. Read its code before buying — a hook may refuse a buy, a sell or a reprice."}
          </p>
          <div className="space-y-1 pt-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Decides · may refuse
            </p>
            <FlagList flags={state.hookFlags} entries={DECIDES} />
            <p className="pt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              Records · cannot refuse
            </p>
            <FlagList flags={state.hookFlags} entries={RECORDS} />
          </div>
        </>
      )}
    </Panel>
  );
}

/** A raw amount formatted at this currency's precision, with its symbol. */
export function amountWith(v: bigint, currency: CurrencyMeta): string {
  return `${formatBalance(v, currency.decimals)} ${currency.symbol}`;
}

/** Exact units, for the places where a rounded figure would mislead. */
export function exactWith(v: bigint, currency: CurrencyMeta): string {
  return `${formatUnits(v, currency.decimals)} ${currency.symbol}`;
}
