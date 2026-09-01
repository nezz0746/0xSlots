"use client";

import { ArrowLeft, RefreshCw } from "lucide-react";
import { useCallback } from "react";
import { type Address, isAddress } from "viem";
import { useAccount, useSwitchChain } from "wagmi";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { useChain } from "@/context/chain";
import { NavLink } from "@/context/navigation";
import {
  useCurrencyMeta,
  useIsOperator,
  useSlots,
  useSlotsFactory,
  useSlotState,
} from "@/hooks/slots/use-slots";
import { useSlotsAction } from "@/hooks/slots/use-slots-action";
import { truncateAddress } from "@/utils";
import { AddressText } from "./components/panel";
import { SellOrderPanel } from "./components/sell-order";
import {
  OccupantPanel,
  PublicPanel,
  TakePanel,
} from "./components/slot-actions";
import {
  HookPanel,
  OccupancyPanel,
  SlotStatus,
  TermsPanel,
} from "./components/slot-facts";
import { ManageTermsPanel, PendingTermsPanel } from "./components/slot-terms";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <div className="w-full px-3 py-8 md:px-5">
        <div className="border p-8 text-center text-sm text-muted-foreground">
          {children}
        </div>
      </div>
    </div>
  );
}

export function SlotView({ slotAddress }: { slotAddress: string }) {
  const { chainId: selectedChainId } = useChain();
  const { address, chainId: walletChainId, isConnected } = useAccount();
  const { switchChain } = useSwitchChain();
  const factory = useSlotsFactory();
  const client = useSlots();

  const valid = isAddress(slotAddress);
  const slot = valid ? (slotAddress as Address) : undefined;

  const { data: state, isLoading, error, refetch } = useSlotState(slot);
  const currency = useCurrencyMeta(state?.currency);
  const actions = useSlotsAction();

  const { data: isOperator } = useIsOperator(slot, address);

  const minDepositFor = useCallback(
    (price: bigint) =>
      state
        ? client.minDepositFor(
            price,
            state.taxPercentage,
            state.minDepositSeconds,
          )
        : 0n,
    [client, state],
  );

  if (!valid) return <Shell>“{slotAddress}” is not an address.</Shell>;
  if (!factory)
    return (
      <Shell>
        The Slots protocol is not deployed on this chain. Switch networks to one
        that has it.
      </Shell>
    );
  if (isLoading) return <Shell>Reading the slot…</Shell>;
  if (error || !state)
    return (
      <Shell>
        Nothing at {truncateAddress(slotAddress)} answers like a slot on this
        chain. Check the address, and the network selector above.
      </Shell>
    );

  const me = address?.toLowerCase();
  const isOccupant = !!me && me === state.occupant.toLowerCase();
  const isManager = !!me && me === state.manager.toLowerCase();
  const canReprice = isOccupant || !!isOperator;
  const wrongChain = isConnected && walletChainId !== selectedChainId;

  return (
    <div className="min-h-screen">
      <PageHeader>
        <div className="flex items-center gap-3">
          <NavLink
            href="/app"
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
          </NavLink>
          <div className="flex flex-col">
            <h1 className="text-lg font-bold leading-tight tracking-tight">
              Slot {truncateAddress(slotAddress)}
            </h1>
            <AddressText address={slotAddress} label={slotAddress} />
          </div>
          <SlotStatus state={state} />
        </div>
        <Button size="sm" variant="ghost" onClick={() => refetch()}>
          <RefreshCw className="size-3.5" />
          Refresh
        </Button>
      </PageHeader>

      {wrongChain ? (
        <div className="mx-3 mt-3 border border-amber-500/40 bg-amber-500/10 p-2 text-xs md:mx-5">
          Your wallet is on a different network.{" "}
          <button
            type="button"
            className="underline underline-offset-2"
            onClick={() => switchChain({ chainId: selectedChainId })}
          >
            Switch it
          </button>{" "}
          before sending anything.
        </div>
      ) : null}

      <div className="grid gap-3 px-3 py-3 md:grid-cols-2 md:px-5">
        <div className="space-y-3">
          <OccupancyPanel state={state} currency={currency} />
          <TermsPanel
            state={state}
            currency={currency}
            minDeposit={minDepositFor(state.price)}
          />
          <HookPanel state={state} />
          <PendingTermsPanel state={state} />
        </div>

        <div className="space-y-3">
          <TakePanel
            slot={slot!}
            state={state}
            currency={currency}
            actions={actions}
            minDepositFor={minDepositFor}
          />
          {isOccupant || canReprice ? (
            <OccupantPanel
              slot={slot!}
              state={state}
              currency={currency}
              actions={actions}
              minDepositFor={minDepositFor}
              canReprice={canReprice}
              isOccupant={isOccupant}
            />
          ) : null}
          <PublicPanel
            slot={slot!}
            state={state}
            currency={currency}
            actions={actions}
            minDepositFor={minDepositFor}
          />
          <SellOrderPanel
            slot={slot!}
            state={state}
            currency={currency}
            actions={actions}
            isOccupant={isOccupant}
          />
          {isManager ? (
            <ManageTermsPanel slot={slot!} state={state} actions={actions} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
