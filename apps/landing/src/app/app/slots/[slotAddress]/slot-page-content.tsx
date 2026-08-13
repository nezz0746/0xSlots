"use client";

import { CHAINS } from "@0xslots/contracts";
import { UpdateKind } from "@0xslots/sdk";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowUpFromLine,
  Banknote,
  Check,
  CircleDollarSign,
  Clock,
  Cog,
  Coins,
  Copy,
  FileBox,
  Flame,
  HandCoins,
  Info,
  LandPlot,
  Loader2,
  Lock,
  LockOpen,
  Puzzle,
  RefreshCw,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Timer,
  User,
  Users,
  Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { type Address, formatUnits, zeroAddress } from "viem";
import { useAccount, useSwitchChain } from "wagmi";
import { AccountTypeIcon } from "@/components/account-type-icon";
import { EnsIdentity } from "@/components/ens-identity";
import { TenureMeter } from "@/components/occupancy-timeline";
import { PageHeader } from "@/components/page-header";
import { SplitRecipientsBar } from "@/components/split-recipients-bar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useChain } from "@/context/chain";
import { useFarcaster } from "@/context/farcaster";
import { NavLink } from "@/context/navigation";
import {
  slotActivityQueryOptions,
  slotQueryOptions,
} from "@/hooks/slot-queries";
import { useCurrencyBalance } from "@/hooks/use-currency-balance";
import {
  formatDuration as formatShortDuration,
  useNow,
} from "@/hooks/use-duration";
import { useResolvedPolicy } from "@/hooks/use-resolved-policy";
import { useSlotAction } from "@/hooks/use-slot-action";
import { useSlotOnChain } from "@/hooks/use-slot-onchain";
import { useModules } from "@/hooks/use-v3";
import {
  formatBalance,
  formatBps,
  formatDuration,
  toRawUnits,
  truncateAddress,
} from "@/utils";
import { PriceInput } from "@/components/ui/price-input";
import {
  DetailGroup,
  DetailRow,
  MutabilityChip,
} from "@/components/detail-group";
import { SECTION } from "@/app/app/create/sections";
import { BuySection } from "./components/buy-section";
import { DepositSlider } from "./components/deposit-slider";
import {
  normalizeSlotActivity,
  SlotEventHistory,
} from "./components/event-history";
import { MetadataForm } from "./components/metadata-form";
import {
  PendingUpdatesNotice,
  type PendingViewer,
  pendingChanges,
} from "./components/pending-updates";
import { UserCurrencyBalance } from "./components/user-balance";

export function SlotPageContent({ slotAddress }: { slotAddress: string }) {
  const router = useRouter();
  const { explorerUrl, chainId: selectedChainId } = useChain();
  const { isMiniApp } = useFarcaster();
  const {
    data: slot,
    isLoading,
    refetch: refetchSlot,
  } = useSlotOnChain(slotAddress, selectedChainId);

  // Subgraph data — prefetched on the server, reads from cache instantly
  const { data: subgraphSlot } = useSuspenseQuery(
    slotQueryOptions(selectedChainId, slotAddress),
  );
  // Wall clock for the tenure meter. Above the isLoading/!slot early returns —
  // hooks cannot be conditional — and only ticking when there is something
  // time-positioned to draw.
  // Also ticks whenever something is queued: the pending notice shows how long
  // ago each change was proposed, which is the signal that separates a routine
  // update from one timed against a buy in flight.
  const nowSeconds = useNow(
    !!slot?.occupancyPolicy ||
      !!slot?.hasPendingTax ||
      !!slot?.hasPendingUtility ||
      !!slot?.hasPendingPolicy,
  );
  // Static map first, then the chain — see use-resolved-policy. This drives the
  // tenure meter, so an unresolvable policy correctly draws nothing rather than
  // a meter with an invented window.
  const { policy: knownPolicy } = useResolvedPolicy(
    slot?.occupancyPolicy,
    selectedChainId,
  );

  const { data: activityData } = useSuspenseQuery(
    slotActivityQueryOptions(selectedChainId, slotAddress),
  );

  const { address, isConnected, chainId, chain } = useAccount();
  const { switchChain } = useSwitchChain();
  const {
    selfAssess,
    release,
    collect,
    liquidate,
    proposeTaxUpdate,
    proposeUtilityUpdate,
    cancelPendingUpdate,
    busy,
    activeAction,
  } = useSlotAction();
  const { data: modules } = useModules();
  // The occupant's self-assessment, seeded from what they currently declare.
  // A number rather than a string: PriceInput compounds percentage steps off
  // it, and re-parsing a formatted string each tap loses precision.
  const [ownerPrice, setOwnerPrice] = useState(0);
  const ownerTouched = useRef(false);
  const [newTaxPct, setNewTaxPct] = useState<number | null>(null);
  const [newModule, setNewModule] = useState("");
  const [activeTab, setActiveTab] = useState<"details" | "activity" | "manage">(
    "details",
  );
  const [mobilePanel, setMobilePanel] = useState<"actions" | "metadata" | null>(
    null,
  );
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyAddress = (field: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };
  const walletBalance = useCurrencyBalance(slot?.currency as Address);

  // Initialize tax slider from current on-chain value
  useEffect(() => {
    if (slot && newTaxPct === null) {
      setNewTaxPct(Number(slot.taxPercentage) / 100);
    }
  }, [slot, newTaxPct]);

  const wrongChain = chainId !== selectedChainId;
  const decimals = slot?.currencyDecimals ?? 6;
  const symbol = slot?.currencySymbol ?? "USDC";

  /**
   * Follow the declared price until the occupant edits it.
   *
   * The slot is an async read, so seeding once at mount would leave the field
   * on 0 for anyone whose page painted first.
   */
  const ownerPriceSeed = slot ? Number(formatUnits(slot.price, decimals)) : 0;
  useEffect(() => {
    if (!ownerTouched.current) setOwnerPrice(ownerPriceSeed);
  }, [ownerPriceSeed]);
  const ownerPriceRaw = toRawUnits(String(ownerPrice), decimals);

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <div className="w-full px-5 py-12">
          <div className="rounded-lg border p-12 text-center animate-pulse">
            <p className="text-sm text-muted-foreground">Loading slot...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!slot) {
    return (
      <div className="min-h-screen">
        <div className="w-full px-5 py-12">
          <div className="rounded-lg border p-12 text-center">
            <p className="text-sm">Slot not found</p>
            <NavLink
              href="/app"
              className="text-sm text-primary underline mt-4 block"
            >
              ← Back to Explorer
            </NavLink>
          </div>
        </div>
      </div>
    );
  }

  const isOccupied = slot.occupant != null;
  const isOccupant = address?.toLowerCase() === slot.occupant?.toLowerCase();
  const isRecipient = address?.toLowerCase() === slot.recipient.toLowerCase();
  const isManager = address?.toLowerCase() === slot.manager.toLowerCase();
  const remaining =
    slot.deposit > slot.taxOwed ? slot.deposit - slot.taxOwed : 0n;
  // collect() settles before flushing, so the amount it actually pays out is
  // the already-settled bucket plus whatever _settle() can still take from the
  // deposit. Gating on collectedTax alone hides the button on any slot that
  // hasn't been touched since occupancy; gating on taxOwed alone hides tax
  // stranded on a vacated slot.
  const collectable =
    slot.collectedTax +
    (slot.taxOwed < slot.deposit ? slot.taxOwed : slot.deposit);

  const hasModule =
    slot.utility != null && slot.utility.toLowerCase() !== zeroAddress;
  const moduleEntity = subgraphSlot?.moduleRef ?? null;
  const moduleUnverified = hasModule && moduleEntity && !moduleEntity.verified;
  const isMetadataModule =
    hasModule &&
    moduleEntity?.verified === true &&
    moduleEntity.name === "AdLandModule";

  // ── Queued updates ────────────────────────────────────────────────────────
  //
  // Resolved once here so the terms panel, the buy panel and the manage tab all
  // describe the same three changes rather than each rendering its own subset.
  // The old page showed tax and module and silently omitted policy — the one
  // update that changes whether the slot can be taken from you.
  const utilityLabel = (addr: string | null) => {
    if (!addr || addr.toLowerCase() === zeroAddress) return "None";
    const known = modules?.find(
      (m) => m.id.toLowerCase() === addr.toLowerCase(),
    );
    return known?.name || truncateAddress(addr);
  };
  const policyLabel = (addr: string | null) => {
    if (!addr || addr.toLowerCase() === zeroAddress)
      return "Open — anyone may buy at any time";
    if (addr.toLowerCase() === slot.occupancyPolicy?.toLowerCase())
      return knownPolicy?.label ?? truncateAddress(addr);
    return truncateAddress(addr);
  };
  const queuedChanges = pendingChanges(slot, utilityLabel, policyLabel);
  // A connected occupant is the one party these do NOT affect; the manager is
  // the one who can retract them. Everyone else is a prospective buyer, which
  // includes a disconnected visitor — the reader most likely to be caught out.
  const pendingViewer: PendingViewer = isOccupant
    ? "occupant"
    : isManager
      ? "manager"
      : "buyer";

  const role = isConnected
    ? isOccupant && isRecipient
      ? {
          label: "Owner & Occupant",
          badge: "border-purple-200 bg-purple-50 text-purple-700",
          accent: "border-t-2 border-t-purple-500",
        }
      : isRecipient
        ? {
            label: "Owner",
            badge: "border-blue-200 bg-blue-50 text-blue-700",
            accent: "border-t-2 border-t-blue-500",
          }
        : isOccupant
          ? {
              label: "Occupant",
              badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
              accent: "border-t-2 border-t-emerald-500",
            }
          : null
    : null;

  // Contextual label for the mobile actions drawer trigger
  const actionLabel = isOccupant
    ? "Manage"
    : isRecipient
      ? "Collect"
      : !isOccupied
        ? "Buy Slot"
        : "Buy";

  return (
    <div className="min-h-screen">
      <PageHeader>
        <div>
          <button
            type="button"
            onClick={() => router.back()}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight leading-tight">
              Slot {truncateAddress(slot.id)}
            </h1>
            <button
              type="button"
              onClick={() => copyAddress("header", slot.id)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Copy slot address"
            >
              {copiedField === "header" ? (
                <Check className="size-3.5" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={() => refetchSlot()}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Refresh slot data"
            >
              <RefreshCw className="size-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">
              {isOccupied
                ? `Occupied by ${truncateAddress(slot.occupant!)}`
                : "Vacant"}
              {chain?.name ? ` · ${chain.name}` : ""}
            </p>
            {role && (
              <Badge variant="outline" className={role.badge}>
                {role.label}
              </Badge>
            )}
          </div>
        </div>
      </PageHeader>

      <div className="w-full px-3 md:px-5 py-3 pb-32 lg:pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
          {/* Left: Tabbed content + mobile slide panel */}
          <div className="relative overflow-hidden">
            {/* Main content — slides left when mobile panel is open */}
            <div
              className={`space-y-6 transition-all duration-300 ease-in-out lg:!translate-x-0 lg:!opacity-100 ${
                mobilePanel
                  ? "-translate-x-full opacity-0 pointer-events-none h-0 lg:h-auto"
                  : "translate-x-0 opacity-100"
              }`}
            >
              <div className="rounded-lg border">
                {/* Tab bar in card header */}
                <div className="bg-muted/50 border-b px-4 flex items-center gap-0">
                  <button
                    className={`px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${activeTab === "details" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                    onClick={() => setActiveTab("details")}
                  >
                    <Info className="size-3.5" /> Info
                  </button>
                  <button
                    className={`px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${activeTab === "activity" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                    onClick={() => setActiveTab("activity")}
                  >
                    <Activity className="size-3.5" /> Activity
                  </button>
                  {isManager && (
                    <button
                      className={`px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${activeTab === "manage" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                      onClick={() => setActiveTab("manage")}
                    >
                      <Cog className="size-3.5" /> Manage
                    </button>
                  )}
                </div>

                {/* Details tab */}
                {activeTab === "details" && (
                  <div>
                    <div className="p-4 space-y-3 text-sm">
                      {/* Terms lead. The rate and the funding floor are what
                          decide whether to buy; everything else qualifies them. */}
                      <DetailGroup
                        icon={HandCoins}
                        title="Terms"
                        tint={SECTION.economics.tint}
                      >
                        <DetailRow
                          weight="primary"
                          label="Tax rate"
                          badge={
                            <MutabilityChip
                              mutable={slot.mutableTax}
                              what="tax rate"
                            />
                          }
                          value={`${formatBps(slot.taxPercentage.toString())}/mo`}
                        />
                        <DetailRow
                          weight="primary"
                          label="Min. deposit"
                          value={formatDuration(Number(slot.minDepositSeconds))}
                        />
                        <DetailRow
                          label="Liquidation bounty"
                          value={formatBps(
                            slot.liquidationBountyBps.toString(),
                          )}
                        />
                      </DetailGroup>

                      <DetailGroup
                        icon={Coins}
                        title="Currency"
                        tint={SECTION.currency.tint}
                      >
                        <DetailRow
                          label="Priced in"
                          value={`${slot.currencyName ?? truncateAddress(slot.currency)} (${symbol})`}
                        />
                      </DetailGroup>

                      <DetailGroup
                        icon={Users}
                        title="Parties"
                        tint={SECTION.recipient.tint}
                      >
                        <DetailRow
                          label={
                            <>
                              {subgraphSlot?.recipientAccountRef?.type ? (
                                <AccountTypeIcon
                                  type={subgraphSlot.recipientAccountRef.type}
                                  className="size-3"
                                />
                              ) : (
                                <User className="size-3" />
                              )}
                              Recipient
                            </>
                          }
                          value={
                            <span className="flex items-center gap-1.5">
                              <NavLink
                                href={`/recipient/${slot.recipient}`}
                                className="text-primary hover:underline"
                              >
                                <EnsIdentity
                                  address={slot.recipient}
                                  size={16}
                                  nameClassName="text-xs"
                                />
                              </NavLink>
                              <button
                                type="button"
                                onClick={() =>
                                  copyAddress("recipient", slot.recipient)
                                }
                                className="text-muted-foreground hover:text-foreground transition-colors"
                              >
                                {copiedField === "recipient" ? (
                                  <Check className="size-3" />
                                ) : (
                                  <Copy className="size-3" />
                                )}
                              </button>
                            </span>
                          }
                        />
                        {subgraphSlot?.recipientAccountRef?.type === "SPLIT" && (
                          <SplitRecipientsBar
                            chainId={selectedChainId}
                            splitAddress={slot.recipient}
                          />
                        )}
                        {slot.manager.toLowerCase() !== zeroAddress && (
                          <DetailRow
                            label="Manager"
                            value={truncateAddress(slot.manager)}
                          />
                        )}
                      </DetailGroup>

                      {/* Extensions, deliberately quiet. Both are absent on
                          most slots and neither changes the price; a reader
                          deciding whether to buy should reach the rate first. */}
                      {slot.occupancyPolicy && (
                        <DetailGroup
                          weight="quiet"
                          icon={ShieldCheck}
                          title="Occupancy policy"
                          tint={SECTION.occupancy.tint}
                        >
                          <DetailRow
                            weight="quiet"
                            label={knownPolicy?.label ?? "Policy"}
                            badge={
                              <MutabilityChip
                                mutable={slot.mutablePolicy}
                                what="occupancy terms"
                              />
                            }
                            value={truncateAddress(slot.occupancyPolicy)}
                          />
                          {knownPolicy?.tenureSeconds && isOccupied && (
                            <TenureMeter
                              tenureSeconds={knownPolicy.tenureSeconds}
                              occupiedSince={Number(slot.occupiedSince)}
                              now={nowSeconds}
                            />
                          )}
                          {knownPolicy && (
                            <p className="text-[11px] text-muted-foreground">
                              {knownPolicy.description}
                            </p>
                          )}
                        </DetailGroup>
                      )}

                      <DetailGroup
                        weight="quiet"
                        icon={Puzzle}
                        title="Utility"
                        tint={SECTION.module.tint}
                      >
                        <DetailRow
                          weight="quiet"
                          label="Contract"
                          badge={
                            <MutabilityChip
                              mutable={slot.mutableModule}
                              what="utility"
                            />
                          }
                          value={
                            !hasModule
                              ? "None"
                              : (moduleEntity?.name ??
                                truncateAddress(slot.module))
                          }
                        />
                      </DetailGroup>

                      {/* The address itself is reference material, not a term. */}
                      <div className="flex items-center justify-between border-t pt-2 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <LandPlot className="size-3" /> Slot contract
                        </span>
                        <span className="flex items-center gap-1.5">
                          <a
                            href={`${explorerUrl}/address/${slot.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            {truncateAddress(slot.id)}
                          </a>
                          <button
                            type="button"
                            onClick={() => copyAddress("slot", slot.id)}
                            className="hover:text-foreground transition-colors"
                          >
                            {copiedField === "slot" ? (
                              <Check className="size-3" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                          </button>
                        </span>
                      </div>

                      {/* One notice for all three dimensions, in the reader's
                          own terms. Previously tax and module each had their
                          own line here and the occupancy policy had none. */}
                      {queuedChanges.length > 0 && (
                        <>
                          <div className="border-t" />
                          <PendingUpdatesNotice
                            changes={queuedChanges}
                            viewer={pendingViewer}
                            nowSeconds={nowSeconds}
                          />
                        </>
                      )}

                      {moduleUnverified && (
                        <>
                          <div className="border-t" />
                          <div className="flex items-start gap-1.5 rounded-md border border-destructive/50 bg-destructive/5 px-2.5 py-2 text-[11px] text-destructive">
                            <AlertTriangle className="size-3 mt-0.5 shrink-0" />
                            <span>
                              This slot uses an{" "}
                              <strong>unverified module</strong>. Unverified
                              modules have not been reviewed by the factory
                              admin and may behave unexpectedly.
                            </span>
                          </div>
                        </>
                      )}

                      {(slot.mutableTax || slot.mutableModule) && (
                        <>
                          <div className="border-t" />
                          <div className="flex items-start gap-1.5 rounded-md border border-amber-500/50 bg-amber-500/5 px-2.5 py-2 text-[11px] text-amber-700">
                            <AlertTriangle className="size-3 mt-0.5 shrink-0" />
                            <span>
                              The manager can change{" "}
                              {slot.mutableTax && slot.mutableModule
                                ? "the tax rate and module"
                                : slot.mutableTax
                                  ? "the tax rate"
                                  : "the module"}{" "}
                              on this slot. Changes take effect on the next
                              ownership transition.
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Activity tab */}
                {activeTab === "activity" && (
                  <SlotEventHistory
                    events={normalizeSlotActivity(activityData)}
                    explorerUrl={explorerUrl}
                  />
                )}

                {/* Manage tab (manager only) */}
                {activeTab === "manage" && isManager && (
                  <div className="p-6 space-y-6">
                    {/* Everything queued, with a per-dimension retract. Each
                        cancel touches only its own dimension, so retracting a
                        tax proposal no longer destroys a queued policy change
                        alongside it. */}
                    {queuedChanges.length > 0 && (
                      <PendingUpdatesNotice
                        changes={queuedChanges}
                        viewer="manager"
                        nowSeconds={nowSeconds}
                        onCancel={(kind) =>
                          cancelPendingUpdate(slotAddress as Address, kind)
                        }
                        busy={busy}
                        activeAction={activeAction}
                      />
                    )}

                    {/* Tax Update */}
                    {slot.mutableTax && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <label className="text-sm text-muted-foreground flex items-center gap-1.5">
                            <HandCoins className="size-4" /> Propose Tax Rate
                          </label>
                          <span className="text-sm font-semibold">
                            {(newTaxPct ?? 0).toFixed(1)}%/mo
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="0.5"
                          value={newTaxPct ?? 0}
                          onChange={(e) => setNewTaxPct(Number(e.target.value))}
                          className="w-full h-2 appearance-none bg-secondary rounded-full cursor-pointer accent-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0"
                        />
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>0%</span>
                          <span>25%</span>
                          <span>50%</span>
                          <span>75%</span>
                          <span>100%</span>
                        </div>
                        <Button
                          className="w-full"
                          disabled={
                            busy ||
                            newTaxPct === null ||
                            Math.round(newTaxPct * 100) ===
                              Number(slot.taxPercentage)
                          }
                          onClick={() =>
                            proposeTaxUpdate(
                              slotAddress as Address,
                              BigInt(Math.round((newTaxPct ?? 0) * 100)),
                            )
                          }
                        >
                          {busy && activeAction === "Propose tax" ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            `Propose ${(newTaxPct ?? 0).toFixed(1)}%/mo (currently ${formatBps(slot.taxPercentage.toString())}/mo)`
                          )}
                        </Button>
                      </div>
                    )}

                    {/* Module Update */}
                    {slot.mutableModule && (
                      <div
                        className={`space-y-4 ${slot.mutableTax ? "border-t pt-6" : ""}`}
                      >
                        <label className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <Settings className="size-4" /> Propose Module
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {modules
                            ?.filter((m) => m.verified)
                            .map((m) => (
                              <Button
                                key={m.id}
                                variant={
                                  newModule.toLowerCase() === m.id.toLowerCase()
                                    ? "default"
                                    : "outline"
                                }
                                onClick={() => setNewModule(m.id)}
                              >
                                {m.name || truncateAddress(m.id)}
                              </Button>
                            ))}
                          <Button
                            variant={
                              newModule ===
                              "0x0000000000000000000000000000000000000000"
                                ? "default"
                                : "outline"
                            }
                            onClick={() =>
                              setNewModule(
                                "0x0000000000000000000000000000000000000000",
                              )
                            }
                          >
                            None
                          </Button>
                        </div>
                        <Input
                          type="text"
                          placeholder="Or paste module address..."
                          value={newModule}
                          onChange={(e) => setNewModule(e.target.value)}
                        />
                        <Button
                          className="w-full"
                          disabled={
                            busy ||
                            !newModule ||
                            newModule.toLowerCase() ===
                              slot.utility.toLowerCase()
                          }
                          onClick={() =>
                            proposeUtilityUpdate(
                              slotAddress as Address,
                              newModule as Address,
                            )
                          }
                        >
                          {busy && activeAction === "Propose utility" ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            `Propose Module ${newModule ? truncateAddress(newModule) : ""}`
                          )}
                        </Button>
                      </div>
                    )}

                    {!slot.mutableTax && !slot.mutableModule && (
                      <p className="text-muted-foreground text-center py-6">
                        This slot has no mutable parameters
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Metadata Module card — desktop only */}
              {isMetadataModule && (
                <div className="hidden lg:block rounded-lg border">
                  <div className="flex flex-col bg-muted/50 border-b gap-2 px-2 md:px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <FileBox className="size-3.5" />
                      <h2 className="text-sm font-semibold">Ad Metadata</h2>
                    </div>
                    <p className="text-gray-400 text-xs ml-[18px]">
                      This module hosts metadata that can only be udpated by the
                      occupant
                    </p>
                  </div>
                  <div className="p-2 md:p-4">
                    <MetadataForm
                      slotAddress={slotAddress}
                      moduleAddress={slot.module}
                      isOccupant={!!isOccupant}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Mobile slide-in panel — enters from the right */}
            <div
              className={`lg:hidden transition-all duration-300 ease-in-out ${
                mobilePanel
                  ? "translate-x-0 opacity-100"
                  : "translate-x-full opacity-0 pointer-events-none h-0"
              }`}
            >
              {mobilePanel === "actions" && (
                <div className={`rounded-lg border ${role ? role.accent : ""}`}>
                  <div className="bg-muted/50 border-b px-3 py-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold">
                      {isOccupied
                        ? `Price: ${formatBalance(slot.price, decimals)} ${symbol}`
                        : "Vacant Slot"}
                    </h2>
                    {role && (
                      <span
                        className={`text-[11px] font-medium rounded-full border px-2 py-0.5 ${role.badge}`}
                      >
                        {role.label}
                      </span>
                    )}
                  </div>
                  {renderActionsContent()}
                </div>
              )}

              {mobilePanel === "metadata" && isMetadataModule && (
                <div className="rounded-lg border">
                  <div className="bg-muted/50 border-b px-2 md:px-4 py-2 md:py-3 flex items-center gap-1.5">
                    <FileBox className="size-3.5" />
                    <h2 className="text-sm font-semibold">Ad Metadata</h2>
                  </div>
                  <div className="p-2 md:p-4">
                    <MetadataForm
                      slotAddress={slotAddress}
                      moduleAddress={slot.module}
                      isOccupant={!!isOccupant}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Actions — desktop only */}
          <div className="hidden lg:block lg:sticky lg:top-6">
            {renderActionsCard()}
          </div>
        </div>
      </div>

      {/* Mobile bottom bar — simple buttons, no drawers */}
      <div
        className="fixed left-0 right-0 lg:hidden z-40"
        style={{ bottom: `var(--bottom-bar-h, 0px)` }}
      >
        <div className="bg-background border-t p-3">
          <div className="flex items-center gap-2 max-w-3xl mx-auto">
            {isMetadataModule && (
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() =>
                  setMobilePanel((p) => (p === "metadata" ? null : "metadata"))
                }
              >
                <FileBox className="size-4" />
                {mobilePanel === "metadata" ? "Back" : "Ad"}
              </Button>
            )}
            <Button
              variant="default"
              className="flex-1 gap-2"
              onClick={() =>
                setMobilePanel((p) => (p === "actions" ? null : "actions"))
              }
            >
              {mobilePanel === "actions" ? (
                <>← Back to Info</>
              ) : (
                <>{actionLabel}</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  function renderActionsCard() {
    if (!slot) return null;
    return (
      <div className={`rounded-lg border ${role ? role.accent : ""}`}>
        <div className="bg-muted/50 border-b px-3 py-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            {isOccupied
              ? `Price: ${formatBalance(slot.price, decimals)} ${symbol}`
              : "Vacant Slot"}
          </h2>
          {role && (
            <span
              className={`text-[11px] font-medium rounded-full border px-2 py-0.5 ${role.badge}`}
            >
              {role.label}
            </span>
          )}
        </div>
        {renderActionsContent()}
      </div>
    );
  }

  function renderActionsContent() {
    if (!slot) return null;
    return (
      <>
        {isOccupied && (
          <div className="p-4 border-b space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Banknote className="size-3" /> Deposit
              </span>
              <span>
                {formatBalance(slot.deposit, decimals)} {symbol}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <HandCoins className="size-3" /> Tax Owed
              </span>
              <span>
                {formatBalance(slot.taxOwed, decimals)} {symbol}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Wallet className="size-3" /> Net Balance
              </span>
              <span
                className={`font-bold ${slot.insolvent ? "text-destructive" : ""}`}
              >
                {formatBalance(remaining, decimals)} {symbol}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Clock className="size-3" /> Liquidation In
              </span>
              <span
                className={slot.insolvent ? "text-destructive font-bold" : ""}
              >
                {slot.insolvent
                  ? "NOW"
                  : formatDuration(Number(slot.secondsUntilLiquidation))}
              </span>
            </div>
            {slot.insolvent && (
              <div className="rounded border border-destructive bg-destructive/10 text-destructive text-center py-1 text-xs font-bold">
                INSOLVENT
              </div>
            )}
          </div>
        )}

        {!isOccupied && (
          <div className="p-4 border-b">
            <p className="text-sm text-muted-foreground">
              Vacant — No escrow data
            </p>
          </div>
        )}

        {isConnected && (
          <UserCurrencyBalance currency={slot.currency as Address} />
        )}

        <div className="p-4 space-y-3">
          {!isConnected && !isMiniApp ? (
            <p className="text-sm text-muted-foreground text-center py-2">
              Connect wallet to interact
            </p>
          ) : wrongChain && !isMiniApp ? (
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => switchChain({ chainId: selectedChainId })}
            >
              Switch to{" "}
              {CHAINS.find((c) => c.id === selectedChainId)?.name ??
                "correct network"}
            </Button>
          ) : (
            <>
              {(slot.occupant == null || !isOccupant) && !isRecipient && (
                <>
                  {/* Restated next to the button, not just in the terms panel
                      further up the page. A buy applies every queued change in
                      the same transaction, so this is the last thing a buyer
                      should read before committing. */}
                  {queuedChanges.length > 0 && (
                    <PendingUpdatesNotice
                      changes={queuedChanges}
                      viewer="buyer"
                      nowSeconds={nowSeconds}
                    />
                  )}
                  <BuySection
                    slot={slot}
                    slotAddress={slotAddress}
                    isOccupied={isOccupied}
                  />
                </>
              )}

              {isOccupant && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <PriceInput
                      label="New price"
                      value={ownerPrice}
                      onChange={(n) => {
                        ownerTouched.current = true;
                        setOwnerPrice(n);
                      }}
                      taxBps={slot.taxPercentage}
                      symbol={symbol}
                      disabled={busy}
                      hint={`Currently ${formatBalance(slot.price, decimals)} ${symbol} — raising it raises your own bill`}
                    />
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={
                        busy ||
                        ownerPriceRaw === slot.price ||
                        ownerPriceRaw === 0n
                      }
                      onClick={() =>
                        selfAssess(slotAddress as Address, ownerPriceRaw)
                      }
                    >
                      {busy && activeAction === "Set price" ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        "Set price"
                      )}
                    </Button>
                  </div>

                  <div className="border-t pt-3">
                    <DepositSlider
                      slot={slot}
                      slotAddress={slotAddress}
                      walletBalance={walletBalance}
                    />
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        className="w-full"
                        disabled={busy}
                      >
                        {busy && activeAction === "Release slot" ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <>
                            <ArrowUpFromLine className="size-4 mr-1" /> Release
                            Slot
                          </>
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Release this slot?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will give up your occupancy and return your
                          remaining deposit. You lose your position and the slot
                          becomes claimable by anyone straight away.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => release(slotAddress as Address)}
                        >
                          Release
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}

              {/* collect() is permissionless — anyone can flush settled tax to
                  the recipient. The label only reflects whether the caller is
                  the one getting paid. */}
              {collectable > 0n && (
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={busy}
                  onClick={() => collect(slotAddress as Address)}
                >
                  {busy && activeAction === "Collect tax" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      <HandCoins className="size-4 mr-1" />{" "}
                      {isRecipient ? "Collect Tax" : "Distribute Tax"} (
                      {formatBalance(collectable, decimals)} {symbol})
                    </>
                  )}
                </Button>
              )}

              {isOccupied && !isOccupant && (
                <Button
                  variant="destructive"
                  className="w-full"
                  disabled={busy || !slot.insolvent}
                  onClick={() => liquidate(slotAddress as Address)}
                >
                  {busy && activeAction === "Liquidate" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      <Flame className="size-4 mr-1" /> Liquidate
                    </>
                  )}
                </Button>
              )}
            </>
          )}
        </div>
      </>
    );
  }
}
