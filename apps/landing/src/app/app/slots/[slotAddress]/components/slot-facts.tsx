"use client";

import { findKnownHook } from "@0xslots/contracts/slots";
import type { HookFlags, SlotState } from "@0xslots/sdk/slots";
import {
  AlertTriangle,
  Clock,
  Coins,
  HandCoins,
  KeyRound,
  Plug,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";
import { zeroAddress } from "viem";
import { SECTION } from "@/app/app/create/sections";
import {
  DetailGroup,
  DetailRow,
  MutabilityChip,
} from "@/components/detail-group";
import { TenureMeter } from "@/components/occupancy-timeline";
import { Badge } from "@/components/ui/badge";
import { useChain } from "@/context/chain";
import type { CurrencyMeta } from "@/hooks/slots/use-slots";
import { useNow } from "@/hooks/use-duration";
import { useTenureWindow } from "@/hooks/use-tenure-window";
import { cn } from "@/lib/utils";
import { formatBalance, formatBps, formatDuration } from "@/utils";
import { AddressText } from "./panel";

const NEVER = 2n ** 255n;

/** "3d 4h", or "never" when the deposit can outlive the arithmetic. */
export function formatRunway(seconds: bigint): string {
  if (seconds >= NEVER) return "never";
  return formatDuration(Number(seconds));
}

/**
 * @param insolvent Overrides the snapshot's own flag with the interpolated one,
 *   so a slot that tips over while the page is open says so on the same tick
 *   the runway hits zero rather than at the next poll. Omit to trust the read.
 */
export function SlotStatus({
  state,
  insolvent,
}: {
  state: SlotState;
  insolvent?: boolean;
}) {
  if (state.isVacant)
    return (
      <Badge variant="outline" className="gap-1">
        <Clock className="size-3" /> Vacant
      </Badge>
    );
  if (insolvent ?? state.isInsolvent)
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

const DECIDES: [keyof HookFlags, string][] = [
  ["beforeBuy", "beforeBuy"],
  ["beforeSelfAssess", "beforeSelfAssess"],
];
const RECORDS: [keyof HookFlags, string][] = [
  ["afterBuy", "afterBuy"],
  ["afterRelease", "afterRelease"],
  ["afterLiquidate", "afterLiquidate"],
  ["afterSettle", "afterSettle"],
];

/**
 * A hook's declared subscriptions, struck through where it did not subscribe.
 *
 * Both halves are always drawn, present and absent alike. A list of only what a
 * hook DOES leaves the reader unable to tell "this hook cannot refuse a buy"
 * from "this app did not check" — and the first is a guarantee worth having.
 */
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
 * The slot as reference, in the create form's own vocabulary.
 *
 * Same icons, same tints, same order as the sections that SET these values —
 * see `app/create/sections.ts`, which owns that vocabulary. A slot's terms
 * should look like the form that produced them, so a reader who has filled the
 * form once can find any value here without hunting.
 *
 * Hierarchy is carried by `weight` rather than by position alone. The terms
 * decide whether to buy, so they lead at body size; the hook is consequential
 * but conditional — absent from most slots and meaningless to most readers —
 * so it sits last and quiet rather than competing with the rate.
 *
 * The live figures are deliberately NOT here. Deposit, tax owed and the runway
 * belong beside the form that acts on them, in the valuation rail; repeating
 * them here would give the page two counting copies of the same number, drifting
 * a tick apart from each other.
 */
export function SlotDetails({
  state,
  currency,
  minDeposit,
  isManager,
  isOccupant,
}: {
  state: SlotState;
  currency: CurrencyMeta;
  /** The deposit `minDepositSeconds` demands at the CURRENT price. */
  minDeposit: bigint;
  isManager: boolean;
  isOccupant: boolean;
}) {
  const { chainId } = useChain();
  const attached = state.hook !== zeroAddress;
  const known = findKnownHook(chainId, attached ? state.hook : undefined);
  // Only ticks while there is a window to draw.
  const tenureSeconds = useTenureWindow(
    attached ? state.hook : undefined,
    attached ? state.hookData : undefined,
  );
  const now = useNow(!!tenureSeconds && !state.isVacant, 1000);

  return (
    <div className="space-y-4 text-sm">
      <DetailGroup
        icon={HandCoins}
        title="Terms"
        tint={SECTION.economics.tint}
        weight="primary"
      >
        <DetailRow
          label="Tax"
          badge={<MutabilityChip mutable={state.mutableTax} what="tax rate" />}
          value={`${formatBps(Number(state.taxBps))} / 30 days`}
          weight="primary"
        />
        <DetailRow
          label="Minimum funded runway"
          value={
            state.minDepositSeconds === 0n
              ? "none"
              : formatDuration(Number(state.minDepositSeconds))
          }
        />
        {state.minDepositSeconds > 0n && (
          <DetailRow
            label="…which costs, at this price"
            value={`${formatBalance(minDeposit, currency.decimals)} ${currency.symbol}`}
            weight="quiet"
          />
        )}
      </DetailGroup>

      <DetailGroup icon={Coins} title="Currency" tint={SECTION.currency.tint}>
        <DetailRow
          label="Denominated in"
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
      </DetailGroup>

      <DetailGroup icon={Users} title="Recipient" tint={SECTION.recipient.tint}>
        <DetailRow
          label="Tax goes to"
          value={
            <AddressText
              address={state.recipient}
              className="text-foreground"
            />
          }
        />
      </DetailGroup>

      <DetailGroup
        icon={User}
        title="Occupancy"
        tint="bg-sky-500/10 text-sky-600 dark:text-sky-400"
      >
        <DetailRow
          label="Occupant"
          value={
            state.isVacant ? (
              <span className="text-muted-foreground">nobody</span>
            ) : (
              <AddressText
                address={state.occupant}
                className="text-foreground"
              />
            )
          }
        />
        <DetailRow
          label="Declared price"
          value={`${formatBalance(state.price, currency.decimals)} ${currency.symbol}`}
        />
        {!state.isVacant && (
          <DetailRow
            label="Held since"
            value={
              state.occupiedSince === 0n
                ? "—"
                : new Date(Number(state.occupiedSince) * 1000).toLocaleString()
            }
            weight="quiet"
          />
        )}
      </DetailGroup>

      <DetailGroup
        icon={KeyRound}
        title="Permissions"
        tint={SECTION.permissions.tint}
      >
        <DetailRow
          label="Manager"
          value={
            state.manager === zeroAddress ? (
              <span className="text-muted-foreground">
                none — fully immutable
              </span>
            ) : (
              <AddressText
                address={state.manager}
                className="text-foreground"
              />
            )
          }
        />
        {/* Says where the controls went.
            `Manage` and `Delegation` are conditional tabs, and a tab that is
            simply absent reads as a missing feature rather than as a permission
            you do not hold — which is exactly how it was read. Naming the
            holder, and saying plainly that the tab belongs to them, turns a
            silent omission into an answer. */}
        <p className="pt-1 text-[11px] leading-snug text-muted-foreground">
          {state.manager === zeroAddress
            ? "Nothing about this slot can be changed by anyone, so there is no Manage tab and never will be."
            : isManager
              ? "You are the manager — proposing new terms is under the Manage tab above."
              : "Proposing new terms is the manager's alone, so the Manage tab only appears for them."}
        </p>
        {!state.isVacant && (
          <p className="text-[11px] leading-snug text-muted-foreground">
            {isOccupant
              ? "You hold this slot — delegating the price is under the Delegation tab above."
              : "The occupant may delegate repricing to an operator, under a tab only they see."}
          </p>
        )}
      </DetailGroup>

      {/* Last and quiet — see the note above. A slot with no hook still gets a
          line, because "nothing extends this" is the answer a buyer needs and
          an absent section reads as an unanswered question. */}
      <DetailGroup
        icon={Plug}
        title="Hook"
        tint={SECTION.hook.tint}
        weight="quiet"
      >
        {!attached ? (
          <p className="text-[11px] leading-snug text-muted-foreground">
            Nothing extends this slot. Buying, selling and repricing answer to
            the protocol alone.
          </p>
        ) : (
          <>
            <DetailRow
              label={known?.name ?? "Unrecognised hook"}
              badge={<MutabilityChip mutable={state.mutableHook} what="hook" />}
              value={<AddressText address={state.hook} />}
              weight="quiet"
            />
            <p className="text-[11px] leading-snug text-muted-foreground">
              {known?.description ??
                "This app cannot describe this hook. Read its code before buying — a hook may refuse a buy, a sell or a reprice."}
            </p>
            {/* How much protection is left, as a position in time. A reader
                takes that in from a picture far faster than from "protected
                until 14/09/2026, 17:22" — and "3d left" means something
                different on a 7-day window than on a 30-day one, which is the
                comparison the bar carries for free. */}
            {tenureSeconds && !state.isVacant ? (
              <div className="pt-1">
                <TenureMeter
                  tenureSeconds={Number(tenureSeconds)}
                  occupiedSince={Number(state.occupiedSince)}
                  now={now}
                />
              </div>
            ) : null}
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
      </DetailGroup>
    </div>
  );
}
