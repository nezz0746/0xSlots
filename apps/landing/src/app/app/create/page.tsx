"use client";

import { knownHooks } from "@0xslots/contracts/slots";
import { getChainTokens } from "@0xslots/sdk";
import { assertSlotInit, type SlotInit } from "@0xslots/sdk/slots";
import { AlertCircle, Check, Loader2, Plug, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { type Address, isAddress, zeroAddress } from "viem";
import { useAccount, useSwitchChain } from "wagmi";
import { PageHeader } from "@/components/page-header";
import { TokenLogo } from "@/components/token-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useChain } from "@/context/chain";
import { NavLink, useNavigation } from "@/context/navigation";
import { useSlotsFactory } from "@/hooks/slots/use-slots";
import { useSlotsAction } from "@/hooks/slots/use-slots-action";
import { truncateAddress } from "@/utils";
import { AddressInput, useResolveAddress } from "./address-input";
import { FormSection } from "./components/form-section";
import { useErc20Check } from "./hooks/use-erc20-check";
import {
  percentToBps,
  SECTION,
  type TimeUnit,
  timeUnits,
  toSeconds,
} from "./sections";

const CUSTOM = "custom";
const NO_HOOK = "none";

export default function CreatePage() {
  const { push } = useNavigation();
  const { address, isConnected, chainId: walletChainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const { chainId } = useChain();
  const factory = useSlotsFactory();
  const actions = useSlotsAction();

  const tokens = getChainTokens(chainId);
  const hooks = knownHooks[chainId] ?? [];

  // ─── form state ───────────────────────────────────────────────────────────
  const [recipient, setRecipient] = useState("");
  const [useMyAccount, setUseMyAccount] = useState(true);
  const [currencyChoice, setCurrencyChoice] = useState<string>("");
  const [customCurrency, setCustomCurrency] = useState("");
  const [tax, setTax] = useState("1");
  const [minDepositValue, setMinDepositValue] = useState("1");
  const [minDepositUnit, setMinDepositUnit] = useState<TimeUnit>("days");
  const [hookChoice, setHookChoice] = useState<string>(NO_HOOK);
  const [customHook, setCustomHook] = useState("");
  const [mutableTax, setMutableTax] = useState(false);
  const [mutableHook, setMutableHook] = useState(false);
  const [manager, setManager] = useState("");
  const [useMeAsManager, setUseMeAsManager] = useState(true);

  // Seed the chain's default currency, and re-seed on a chain change so a token
  // from the previous network never survives the switch.
  useEffect(() => {
    const fallback = tokens[0]?.address;
    if (!fallback) return;
    setCurrencyChoice((current) =>
      current === CUSTOM || tokens.some((t) => t.address === current)
        ? current
        : fallback,
    );
  }, [tokens]);

  const recipientResolved = useResolveAddress(recipient);
  const customCurrencyResolved = useResolveAddress(customCurrency);
  const managerResolved = useResolveAddress(manager);
  const erc20 = useErc20Check(
    currencyChoice === CUSTOM ? customCurrencyResolved.resolved : "",
  );

  const resolvedRecipient = (
    useMyAccount ? address : recipientResolved.resolved
  ) as Address | undefined;

  const resolvedCurrency = (
    currencyChoice === CUSTOM ? customCurrencyResolved.resolved : currencyChoice
  ) as Address;

  const resolvedHook = (
    hookChoice === NO_HOOK
      ? zeroAddress
      : hookChoice === CUSTOM
        ? customHook.trim()
        : hookChoice
  ) as Address;

  // ── The one invariant a form gets wrong by default ──────────────────────
  //
  // A manager is REQUIRED when something is mutable and FORBIDDEN when nothing
  // is: `initialize` reverts `NotManager()` both ways. So the manager field is
  // not "optional" — it is a function of the two checkboxes above it, and a
  // form that always sent the connected wallet would revert the moment someone
  // unticked both.
  const needsManager = mutableTax || mutableHook;
  const resolvedManager = (
    !needsManager
      ? zeroAddress
      : useMeAsManager
        ? (address ?? zeroAddress)
        : managerResolved.resolved
  ) as Address;

  const init = useMemo<SlotInit | null>(() => {
    if (!resolvedRecipient || !isAddress(resolvedRecipient)) return null;
    if (!isAddress(resolvedCurrency)) return null;
    if (resolvedHook !== zeroAddress && !isAddress(resolvedHook)) return null;
    return {
      recipient: resolvedRecipient,
      currency: resolvedCurrency,
      manager: resolvedManager,
      hook: resolvedHook,
      taxPercentage: percentToBps(tax),
      minDepositSeconds: toSeconds(minDepositValue, minDepositUnit),
      mutableTax,
      mutableHook,
    };
  }, [
    resolvedRecipient,
    resolvedCurrency,
    resolvedManager,
    resolvedHook,
    tax,
    minDepositValue,
    minDepositUnit,
    mutableTax,
    mutableHook,
  ]);

  /**
   * The SDK's own validation, run before the button is pressed.
   *
   * Same function the client calls on submit, so the inline message and the
   * revert it prevents can never disagree. Showing it here rather than only in
   * a failure toast is the difference between a form error and a mystery.
   */
  const initError = useMemo(() => {
    if (!init) return null;
    try {
      assertSlotInit(init);
      return null;
    } catch (e) {
      return e instanceof Error
        ? e.message.replace(/^createSlot: /, "")
        : String(e);
    }
  }, [init]);

  const resolving =
    recipientResolved.isResolving ||
    customCurrencyResolved.isResolving ||
    managerResolved.isResolving;

  const wrongChain = isConnected && walletChainId !== chainId;
  const ready =
    isConnected && !!factory && !!init && !initError && !resolving && !wrongChain;

  const selectedToken = tokens.find((t) => t.address === currencyChoice);

  useEffect(() => {
    if (actions.isSuccess) {
      const t = setTimeout(() => push("/app"), 1200);
      return () => clearTimeout(t);
    }
  }, [actions.isSuccess, push]);

  if (!factory)
    return (
      <div className="min-h-screen px-3 py-8 md:px-5">
        <div className="border p-8 text-center text-sm text-muted-foreground">
          The Slots protocol is not deployed on this chain, so there is nothing
          here to create a slot with.
        </div>
      </div>
    );

  return (
    <div className="min-h-screen">
      <PageHeader maxWidth="max-w-3xl">
        <div className="flex flex-col">
          <h1 className="text-xl font-bold leading-tight tracking-tight">
            Create a slot
          </h1>
          <p className="text-xs text-muted-foreground">
            Eight values, fixed at birth except the ones you say may move.
          </p>
        </div>
      </PageHeader>

      <div className="mx-auto max-w-3xl px-3 py-4 md:px-5">
        <div className="border bg-card">
          {/* ── Recipient ─────────────────────────────────────────────── */}
          <FormSection meta={SECTION.recipient}>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setUseMyAccount(true)}
                className={`border-2 p-3 text-sm ${useMyAccount ? "border-primary bg-primary/5" : "border-border"}`}
              >
                My account
              </button>
              <button
                type="button"
                onClick={() => setUseMyAccount(false)}
                className={`border-2 p-3 text-sm ${!useMyAccount ? "border-primary bg-primary/5" : "border-border"}`}
              >
                Another address
              </button>
            </div>
            {useMyAccount ? (
              <p className="text-xs text-muted-foreground">
                {address ? truncateAddress(address) : "Connect a wallet first."}
              </p>
            ) : (
              <AddressInput
                value={recipient}
                onChange={setRecipient}
                placeholder="0x… or vitalik.eth"
                hint="A wallet, a split, or a collective — the protocol only cares that it is not the zero address."
              />
            )}
            <p className="text-[10px] text-muted-foreground">
              Want the tax governed by a group?{" "}
              <NavLink
                href="/app/collectives"
                className="underline underline-offset-2"
              >
                <Users className="inline size-3" /> Create a collective
              </NavLink>{" "}
              first, then paste its address here.
            </p>
          </FormSection>

          {/* ── Currency ──────────────────────────────────────────────── */}
          <FormSection meta={SECTION.currency}>
            <Select
              value={currencyChoice}
              onValueChange={(v) => setCurrencyChoice(v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a currency">
                  {currencyChoice === CUSTOM ? (
                    <>
                      <TokenLogo />
                      <span>Custom ERC-20</span>
                    </>
                  ) : selectedToken ? (
                    <>
                      <TokenLogo
                        slug={selectedToken.logo}
                        symbol={selectedToken.symbol}
                      />
                      <span>
                        {selectedToken.name} ({selectedToken.symbol})
                      </span>
                    </>
                  ) : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {tokens.map((token) => (
                  <SelectItem key={token.address} value={token.address}>
                    <TokenLogo slug={token.logo} symbol={token.symbol} />
                    <span>
                      {token.name} ({token.symbol})
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {token.address === zeroAddress
                        ? "native"
                        : truncateAddress(token.address)}
                    </span>
                  </SelectItem>
                ))}
                <SelectItem value={CUSTOM}>
                  <TokenLogo />
                  <span>Custom ERC-20</span>
                </SelectItem>
              </SelectContent>
            </Select>

            {currencyChoice === CUSTOM ? (
              <>
                <AddressInput
                  value={customCurrency}
                  onChange={setCustomCurrency}
                  placeholder="0x… ERC-20 address"
                />
                {erc20.isLoading ? (
                  <p className="flex items-center gap-1.5 text-[10px] text-blue-500">
                    <Loader2 className="size-3 animate-spin" /> Checking token…
                  </p>
                ) : null}
                {erc20.data ? (
                  <p className="flex items-center gap-1.5 text-[10px] text-green-600">
                    <Check className="size-3" />
                    {erc20.data.name} ({erc20.data.symbol}) ·{" "}
                    {erc20.data.decimals} decimals
                  </p>
                ) : null}
                {erc20.isError && erc20.isValidAddress ? (
                  <p className="flex items-center gap-1.5 text-[10px] text-destructive">
                    <AlertCircle className="size-3" /> Not an ERC-20 on this
                    chain.
                  </p>
                ) : null}
              </>
            ) : null}

            {resolvedCurrency === zeroAddress ? (
              <p className="text-[10px] leading-snug text-muted-foreground">
                Native ETH. Buying pays by transaction value, and signed sell
                orders are unavailable — filling one pulls an ERC-20 allowance,
                which native ETH does not have.
              </p>
            ) : null}
          </FormSection>

          {/* ── Economics ─────────────────────────────────────────────── */}
          <FormSection meta={SECTION.economics}>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Tax rate</label>
                <span className="text-sm font-semibold tabular-nums">
                  {tax || 0}% / 30 days
                </span>
              </div>
              <input
                type="range"
                min="0.01"
                max="100"
                step="0.01"
                value={Number(tax) || 0.01}
                onChange={(e) => setTax(e.target.value)}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary"
              />
              <Input
                value={tax}
                inputMode="decimal"
                onChange={(e) => setTax(e.target.value)}
                className="mt-1"
              />
              {percentToBps(tax) <= 0n || percentToBps(tax) > 10_000n ? (
                <p className="text-[10px] text-destructive">
                  Must be above 0 and at most 100% per 30 days. A slot taxing
                  nothing could never liquidate anybody.
                </p>
              ) : null}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">
                Minimum funded runway
              </label>
              <div className="flex gap-0">
                <Input
                  value={minDepositValue}
                  inputMode="decimal"
                  onChange={(e) => setMinDepositValue(e.target.value)}
                  className="rounded-r-none"
                />
                <Select
                  value={minDepositUnit}
                  onValueChange={(v) => setMinDepositUnit(v as TimeUnit)}
                >
                  <SelectTrigger className="w-28 rounded-l-none border-l-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timeUnits.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[10px] leading-snug text-muted-foreground">
                How far ahead a buyer must fund, and the floor a withdrawal may
                not go below. Zero means no minimum.
              </p>
            </div>
          </FormSection>

          {/* ── Hook ──────────────────────────────────────────────────── */}
          <FormSection meta={SECTION.hook}>
            <Select value={hookChoice} onValueChange={setHookChoice}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_HOOK}>No hook</SelectItem>
                {hooks.map((h) => (
                  <SelectItem key={h.address} value={h.address}>
                    {h.name}
                  </SelectItem>
                ))}
                <SelectItem value={CUSTOM}>Custom address</SelectItem>
              </SelectContent>
            </Select>

            {hookChoice === CUSTOM ? (
              <Input
                value={customHook}
                placeholder="0x… hook address"
                onChange={(e) => setCustomHook(e.target.value)}
                className="font-mono text-xs"
              />
            ) : null}

            {hooks.find((h) => h.address === hookChoice) ? (
              <p className="flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
                <Plug className="mt-0.5 size-3 shrink-0" />
                {hooks.find((h) => h.address === hookChoice)?.description}
              </p>
            ) : null}

            <p className="text-[10px] leading-snug text-muted-foreground">
              A hook declares which callbacks it wants, and the slot snapshots
              that list once at attach time. A hook that subscribes to nothing is
              rejected outright, so an attached hook always does something.
            </p>
          </FormSection>

          {/* ── Permissions ───────────────────────────────────────────── */}
          <FormSection meta={SECTION.permissions}>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={mutableTax}
                className="mt-1"
                onChange={(e) => setMutableTax(e.target.checked)}
              />
              <span>
                The tax rate may change
                <span className="block text-[10px] text-muted-foreground">
                  A manager may propose a new rate. It lands at the next
                  occupancy transition, never on a sitting occupant.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={mutableHook}
                className="mt-1"
                onChange={(e) => setMutableHook(e.target.checked)}
              />
              <span>
                The hook may change
                <span className="block text-[10px] text-muted-foreground">
                  A manager may attach, replace or detach the hook — again, at
                  the next transition.
                </span>
              </span>
            </label>

            {needsManager ? (
              <div className="space-y-2 border-t pt-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setUseMeAsManager(true)}
                    className={`border-2 p-2 text-xs ${useMeAsManager ? "border-primary bg-primary/5" : "border-border"}`}
                  >
                    Me
                  </button>
                  <button
                    type="button"
                    onClick={() => setUseMeAsManager(false)}
                    className={`border-2 p-2 text-xs ${!useMeAsManager ? "border-primary bg-primary/5" : "border-border"}`}
                  >
                    Another address
                  </button>
                </div>
                {!useMeAsManager ? (
                  <AddressInput
                    value={manager}
                    onChange={setManager}
                    placeholder="0x… or a collective"
                  />
                ) : null}
                <p className="text-[10px] leading-snug text-muted-foreground">
                  Required, because something above is mutable. Somebody has to
                  be able to exercise it.
                </p>
              </div>
            ) : (
              <p className="border-t pt-3 text-[11px] leading-snug text-muted-foreground">
                <strong className="font-medium text-foreground">
                  No manager.
                </strong>{" "}
                With nothing mutable this slot is immutable forever, and the
                protocol refuses a manager on it — the absence of one is what
                makes the promise real rather than a matter of somebody&apos;s
                restraint.
              </p>
            )}
          </FormSection>

          {/* ── Submit ────────────────────────────────────────────────── */}
          <div className="space-y-2 border-t px-3 py-4 md:px-6">
            {initError ? (
              <p className="flex items-start gap-1.5 text-xs text-destructive">
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                {initError}
              </p>
            ) : null}
            {wrongChain ? (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => switchChain({ chainId })}
              >
                Switch network
              </Button>
            ) : (
              <Button
                className="w-full"
                disabled={!ready || actions.busy}
                onClick={() => init && actions.createSlot(init)}
              >
                {actions.busy ? "Creating…" : "Create slot"}
              </Button>
            )}
            {!isConnected ? (
              <p className="text-[10px] text-muted-foreground">
                Connect a wallet to create a slot.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
