"use client";

import {
  Activity,
  ArrowLeft,
  Cog,
  FileSignature,
  Handshake,
  Info,
  type LucideIcon,
  RefreshCw,
} from "lucide-react";
import { useCallback, useState } from "react";
import { getAddress, isAddress } from "viem";
import { useAccount, useSwitchChain } from "wagmi";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { useChain } from "@/context/chain";
import { NavLink } from "@/context/navigation";
import {
  useCurrencyMeta,
  useIsOperator,
  useSlotState,
  useSlots,
  useSlotsFactory,
} from "@/hooks/slots/use-slots";
import { useSlotsAction } from "@/hooks/slots/use-slots-action";
import { useNow } from "@/hooks/use-duration";
import { useLiveAccrual } from "@/hooks/use-live-accrual";
import { cn } from "@/lib/utils";
import { truncateAddress } from "@/utils";
import { ActionsCard } from "./components/actions-card";
import { DelegationTab } from "./components/delegation";
import { SlotEventHistory } from "./components/event-history";
import { OrdersTab } from "./components/orders-tab";
import { AddressText } from "./components/panel";
import { PendingUpdatesPanel } from "./components/pending-updates";
import { OccupantPanel } from "./components/slot-actions";
import { SlotDetails, SlotStatus } from "./components/slot-facts";
import { ManageTermsPanel } from "./components/slot-terms";
import { useOrders } from "./hooks/use-orders";

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

  // `strict: false`, then checksum it ourselves. viem's default rejects a
  // lowercase address, and lowercase is exactly what a block explorer, a log
  // dump and half the tooling in this repo hand you.
  const valid = isAddress(slotAddress, { strict: false });
  const slot = valid ? getAddress(slotAddress) : undefined;

  const { data: state, isLoading, error, refetch } = useSlotState(slot);
  const currency = useCurrencyMeta(state?.currency);
  const actions = useSlotsAction();

  const { data: isOperator } = useIsOperator(slot, address);
  const [activeTab, setActiveTab] = useState<
    "details" | "activity" | "orders" | "manage" | "delegation"
  >("details");
  /**
   * Whether the actions column is showing on a phone.
   *
   * A slide rather than a drawer: the two are the same page seen from either
   * side, and a modal over the facts would hide the figures the form is about
   * to act on at exactly the moment they matter.
   */
  const [mobilePanel, setMobilePanel] = useState(false);
  // Shared with the occupancy panel so every figure on the page agrees, and so
  // the position panel sizes its top-up against the deposit settlement will
  // actually leave rather than the one last read from the chain.
  const accrual = useLiveAccrual(state, !!state && !state.isVacant);
  const nowSeconds = useNow(true, 30_000);
  // The count in the tab label. See the hook for why it counts only what this
  // browser knows, and why that limitation is stated in the tab itself.
  const { count: orderCount } = useOrders(slot);

  const minDepositFor = useCallback(
    (price: bigint) =>
      state
        ? client.minDepositFor(price, state.taxBps, state.minDepositSeconds)
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

  /**
   * Which reading of the queued terms this visitor needs.
   *
   * Manager outranks occupant: a manager sitting on their own slot needs the
   * retract controls, and they already know the change does not touch their
   * tenure. Everyone who is not seated is a prospective buyer, including a
   * disconnected visitor — the buyer's reading is the one that warns, and
   * warning someone who turns out not to buy costs nothing.
   */
  const pendingViewer = isManager
    ? "manager"
    : isOccupant
      ? "occupant"
      : "buyer";

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
              Slot {truncateAddress(slot ?? slotAddress)}
            </h1>
            <AddressText
              address={slot ?? slotAddress}
              label={slot ?? slotAddress}
            />
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

      <div className="w-full px-3 py-3 pb-32 md:px-5 lg:pb-6">
        {/* The valuation column carries a price input, deposit-runway choices
            and the actions — 320px wrapped every one of them. It grows with the
            viewport instead, since the left column is prose and tables that
            reflow happily. */}
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_420px]">
          {/* Left: tabbed reference, with the actions sliding over it on mobile */}
          <div className="relative overflow-hidden">
            <div
              className={cn(
                "space-y-6 transition-all duration-300 ease-in-out lg:!translate-x-0 lg:!opacity-100",
                mobilePanel
                  ? "pointer-events-none h-0 -translate-x-full opacity-0 lg:h-auto"
                  : "translate-x-0 opacity-100",
              )}
            >
              <div className="rounded-lg border">
                {/* Tab bar in the card header. Reference and history are the
                    same object seen two ways, so they share one card rather
                    than stacking as two — and `Manage` only exists for the one
                    person who can act on it. */}
                <div className="flex items-center gap-0 border-b bg-muted/50 px-4">
                  <TabButton
                    active={activeTab === "details"}
                    onClick={() => setActiveTab("details")}
                    icon={Info}
                    label="Info"
                  />
                  <TabButton
                    active={activeTab === "activity"}
                    onClick={() => setActiveTab("activity")}
                    icon={Activity}
                    label="Activity"
                  />
                  <TabButton
                    active={activeTab === "orders"}
                    onClick={() => setActiveTab("orders")}
                    icon={FileSignature}
                    label={`Orders (${orderCount})`}
                  />
                  {isManager && (
                    <TabButton
                      active={activeTab === "manage"}
                      onClick={() => setActiveTab("manage")}
                      icon={Cog}
                      label="Manage"
                    />
                  )}
                  {/* `setOperator` is `onlyOccupant`, so this gets exactly the
                      conditional treatment Manage gets for the manager. */}
                  {isOccupant && (
                    <TabButton
                      active={activeTab === "delegation"}
                      onClick={() => setActiveTab("delegation")}
                      icon={Handshake}
                      label="Delegation"
                    />
                  )}
                </div>

                {activeTab === "details" && (
                  <div className="space-y-4 p-4">
                    <SlotDetails
                      state={state}
                      currency={currency}
                      minDeposit={minDepositFor(state.price)}
                      isManager={isManager}
                      isOccupant={isOccupant}
                    />
                    <PendingUpdatesPanel
                      slot={slot!}
                      state={state}
                      viewer={pendingViewer}
                      nowSeconds={nowSeconds}
                      actions={isManager ? actions : undefined}
                    />
                  </div>
                )}

                {activeTab === "activity" && <SlotEventHistory slot={slot!} />}

                {activeTab === "orders" && (
                  <OrdersTab
                    slot={slot!}
                    state={state}
                    currency={currency}
                    actions={actions}
                    isOccupant={isOccupant}
                  />
                )}

                {activeTab === "delegation" && isOccupant && (
                  <div className="p-4">
                    <DelegationTab
                      slot={slot!}
                      state={state}
                      actions={actions}
                    />
                  </div>
                )}

                {activeTab === "manage" && isManager && (
                  <div className="p-4">
                    <ManageTermsPanel
                      slot={slot!}
                      state={state}
                      actions={actions}
                    />
                  </div>
                )}
              </div>

              {/* Permissionless actions and the order book read as reference on
                  a phone and as tools on a desktop, so they sit under the tabs
                  here and in the rail there. */}
              <div className="space-y-3 lg:hidden"></div>
            </div>

            {/* Mobile actions panel — slides in from the right */}
            <div
              className={cn(
                "absolute inset-0 space-y-3 transition-all duration-300 ease-in-out lg:hidden",
                mobilePanel
                  ? "translate-x-0 opacity-100"
                  : "pointer-events-none translate-x-full opacity-0",
              )}
            >
              <ActionsCard
                slot={slot!}
                state={state}
                currency={currency}
                accrual={accrual}
                actions={actions}
                viewer={pendingViewer}
                nowSeconds={nowSeconds}
                isManager={isManager}
                isOccupant={isOccupant}
              />
              {canReprice && !isOccupant ? (
                <OccupantPanel
                  slot={slot!}
                  state={state}
                  currency={currency}
                  actions={actions}
                  minDepositFor={minDepositFor}
                />
              ) : null}
            </div>
          </div>

          {/* Right: the valuation rail — desktop only */}
          <div className="hidden space-y-3 lg:sticky lg:top-6 lg:block">
            <ActionsCard
              slot={slot!}
              state={state}
              currency={currency}
              accrual={accrual}
              actions={actions}
              viewer={pendingViewer}
              nowSeconds={nowSeconds}
              isManager={isManager}
              isOccupant={isOccupant}
            />
            {canReprice && !isOccupant ? (
              <OccupantPanel
                slot={slot!}
                state={state}
                currency={currency}
                actions={actions}
                minDepositFor={minDepositFor}
              />
            ) : null}
          </div>
        </div>
      </div>

      {/* Mobile bottom bar — one button, toggling the panel above. */}
      <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
        <div className="border-t bg-background p-3">
          <Button
            className="w-full gap-2"
            onClick={() => setMobilePanel((open) => !open)}
          >
            {mobilePanel ? (
              <>← Back to info</>
            ) : state.isVacant ? (
              // Matches the primary inside the panel this opens. It said
              // "Claim slot" while the call is `buy`, and "Evict and take"
              // while the primary is Buy with liquidation behind the chevron —
              // a mobile bar that names a different action than the panel it
              // reveals is worse than one that names none.
              "Buy slot"
            ) : isOccupant ? (
              "Manage your position"
            ) : (
              "Take this slot"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** One tab in the card header. Underlined when active, quiet when not. */
function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}
