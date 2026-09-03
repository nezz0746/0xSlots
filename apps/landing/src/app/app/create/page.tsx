"use client";

import {
  assertSlotInit,
  type SlotInit,
  ZERO_HOOK_DATA,
} from "@0xslots/sdk/slots";
import { SplitV2Type } from "@0xsplits/splits-sdk/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import {
  type Address,
  getAddress,
  type Hex,
  isAddress,
  toHex,
  zeroAddress,
} from "viem";
import {
  useAccount,
  usePublicClient,
  useSwitchChain,
  useWalletClient,
} from "wagmi";
import { PageHeader } from "@/components/page-header";
import { Form } from "@/components/ui/form";
import { useChain } from "@/context/chain";
import { useNavigation } from "@/context/navigation";
import { useSlotsFactory } from "@/hooks/slots/use-slots";
import { useSlotsAction } from "@/hooks/slots/use-slots-action";
import { useSplitClient } from "@/hooks/use-split-client";
import { resolveEnsAddress } from "@/lib/ens";
import { useResolveAddress } from "./address-input";
import { FormSection } from "./components/form-section";
import { MobileBottomBar } from "./components/mobile-bottom-bar";
import { SectionCurrency } from "./components/section-currency";
import { SectionEconomics } from "./components/section-economics";
import { SectionHook } from "./components/section-hook";
import { SectionPermissions } from "./components/section-permissions";
import { SectionRecipient } from "./components/section-recipient";
import type { SubmitState } from "./components/submit-button";
import { SummaryCard } from "./components/summary-card";
import {
  type CreateSlotFormValues,
  createSlotSchema,
  defaultValues,
} from "./schema";
import { percentToBps, SECTION, toSeconds } from "./sections";

/**
 * Create a slot.
 *
 * One scrolling form of titled sections, not a wizard: the eight values are
 * independent, and forcing them into an order taught nobody anything while
 * hiding from every reader how few decisions there actually are. What the
 * wizard did give for free — you could not reach the end without passing the
 * middle — is paid back by the summary card's error list, which names the
 * sections still blocking the button and jumps to them.
 */
export default function CreatePage() {
  const { push } = useNavigation();
  const { address, isConnected, chainId: walletChainId, chain } = useAccount();
  const { switchChain } = useSwitchChain();
  const { chainId: selectedChainId } = useChain();
  // For the tenure-hook get-or-deploy, which needs both halves before the slot
  // itself can be created.
  const publicClient = usePublicClient({ chainId: selectedChainId });
  const { data: walletClient } = useWalletClient({ chainId: selectedChainId });

  const factory = useSlotsFactory();
  const actions = useSlotsAction();
  const splitClient = useSplitClient();

  const [slotCount, setSlotCount] = useState(1);
  const [creatingSplit, setCreatingSplit] = useState(false);
  const [batchIndex, setBatchIndex] = useState(0);
  const [allSubmitted, setAllSubmitted] = useState(false);
  const createdAddress = useRef<Address | null>(null);

  const form = useForm<CreateSlotFormValues>({
    resolver: zodResolver(createSlotSchema),
    defaultValues,
    mode: "onChange",
  });

  // Only watch what the page itself needs to build the init and submit it.
  const recipientMode = form.watch("recipientMode");
  const recipient = form.watch("recipient");
  const currencyMode = form.watch("currencyMode");
  const presetCurrency = form.watch("presetCurrency");
  const customCurrency = form.watch("customCurrency");
  const taxPercentage = form.watch("taxPercentage");
  const minDepositValue = form.watch("minDepositValue");
  const minDepositUnit = form.watch("minDepositUnit");
  const hookMode = form.watch("hookMode");
  const hook = form.watch("hook");
  const manager = form.watch("manager");
  const mutableTax = form.watch("mutableTax");
  const mutableHook = form.watch("mutableHook");

  // ENS resolution, for submission and for the preflight below.
  const recipientResolved = useResolveAddress(recipient);
  const currencyResolved = useResolveAddress(customCurrency);
  const hookResolved = useResolveAddress(hook);
  const managerResolved = useResolveAddress(manager);

  // ── The one invariant a form gets wrong by default ────────────────────────
  //
  // A manager is REQUIRED when something is mutable and FORBIDDEN when nothing
  // is: `initialize` reverts both ways. So the manager field is not "optional"
  // — it is a function of the two checkboxes above it, and a form that always
  // sent the connected wallet would revert the moment someone unticked both.
  //
  // Enforced HERE, at the single point where the value is produced, rather than
  // in the section that renders the field: the section can hide an input, but
  // only this can decide what is sent.
  const needsManager = mutableTax || mutableHook;
  const resolvedManager = (
    needsManager ? managerResolved.resolved : zeroAddress
  ) as Address;

  const resolvedCurrency = (
    currencyMode === "preset" ? presetCurrency : currencyResolved.resolved
  ) as Address;

  const resolvedHook = (
    hookMode === "none" ? zeroAddress : hookResolved.resolved
  ) as Address;

  /**
   * The recipient as far as the preflight can know it.
   *
   * In group mode the real recipient is a 0xSplits address that does not exist
   * until submit, so there is nothing concrete to check. Everything else in
   * `SlotInit` is known, and the only thing `assertSlotInit` asks of a
   * recipient is that it is not the zero address — which every deployed split
   * satisfies by construction. Standing the connected account in for it keeps
   * the other seven checks live instead of switching the whole preflight off.
   */
  const previewRecipient = (
    recipientMode === "group"
      ? address
      : recipient.trim()
        ? recipientResolved.resolved
        : address
  ) as Address | undefined;

  const init = useMemo<SlotInit | null>(() => {
    if (!previewRecipient || !isAddress(previewRecipient, { strict: false }))
      return null;
    if (!isAddress(resolvedCurrency, { strict: false })) return null;
    if (
      resolvedHook !== zeroAddress &&
      !isAddress(resolvedHook, { strict: false })
    )
      return null;
    if (needsManager && !isAddress(resolvedManager, { strict: false }))
      return null;
    return {
      recipient: previewRecipient,
      currency: resolvedCurrency,
      manager: resolvedManager,
      hook: resolvedHook,
      taxPercentage: percentToBps(taxPercentage),
      minDepositSeconds: toSeconds(minDepositValue, minDepositUnit),
      mutableTax,
      mutableHook,
    };
  }, [
    previewRecipient,
    resolvedCurrency,
    resolvedManager,
    resolvedHook,
    needsManager,
    taxPercentage,
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

  const wrongChain = isConnected && walletChainId !== selectedChainId;
  const busy = actions.busy || creatingSplit;
  const anyResolving =
    recipientResolved.isResolving ||
    currencyResolved.isResolving ||
    hookResolved.isResolving ||
    managerResolved.isResolving;

  // The chain's default currency is seeded by SectionCurrency, next to the
  // FormField that registers `presetCurrency`. Seeding it from here silently
  // did nothing: react-hook-form re-syncs unregistered fields back to their
  // schema default during mount, so the write was undone before first paint.

  useEffect(() => {
    // `isSuccess` tracks the LAST transaction's receipt, and a batch produces
    // several — so the redirect waits for the loop to finish as well, or a
    // three-slot batch would navigate away after the first one confirmed.
    if (actions.isSuccess && allSubmitted) {
      const target = createdAddress.current
        ? `/app/slots/${createdAddress.current}`
        : "/app";
      const timeout = setTimeout(() => push(target), 1500);
      return () => clearTimeout(timeout);
    }
  }, [actions.isSuccess, allSubmitted, push]);

  const submitState: SubmitState = {
    isConnected,
    wrongChain,
    isSuccess: actions.isSuccess && allSubmitted,
    isPending: actions.isPending,
    isConfirming: actions.isConfirming,
    creatingSplit,
    busy,
    anyResolving,
    isFormValid: form.formState.isValid,
    initError,
    slotCount,
    batchIndex,
    recipientMode,
  };

  async function onSubmit(data: CreateSlotFormValues) {
    if (!isConnected || wrongChain || !factory) return;

    const currency =
      data.currencyMode === "preset"
        ? data.presetCurrency
        : currencyResolved.resolved || data.customCurrency;
    if (!isAddress(currency, { strict: false })) return;

    // ── Recipient ──
    //
    // A group is a 0xSplits split, deployed first and then handed to the slot
    // as a plain address. Nothing about it reaches the protocol: from the
    // slot's side a split and a wallet are the same eight-field init.
    let recipientAddress: string;

    if (data.recipientMode === "group") {
      setCreatingSplit(true);
      try {
        const resolvedRecipients = await Promise.all(
          data.splitRecipients.map(async (r) => {
            let addr = r.address.trim();
            if (isAddress(addr, { strict: false })) {
              addr = getAddress(addr);
            } else {
              addr = await resolveEnsAddress(addr);
            }
            return {
              address: addr as Address,
              percentAllocation: r.percentAllocation,
            };
          }),
        );
        const ZERO_SALT =
          "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

        const splitParams = {
          recipients: resolvedRecipients,
          splitType: SplitV2Type.Pull,
          distributorFeePercent: data.distributorFeePercent,
          salt: ZERO_SALT,
        };
        // 0xSplits does not deploy to every chain — notably not a local anvil,
        // where the client is null rather than throwing on construction.
        if (!splitClient) {
          throw new Error(
            "Splits are not available on this chain — pick a single recipient address instead.",
          );
        }
        // The same members at the same allocations produce the same address, so
        // a second slot for the same group costs no deployment.
        const { splitAddress: predictedAddress, deployed } =
          await splitClient.isDeployed(splitParams);

        if (deployed) {
          recipientAddress = predictedAddress;
        } else {
          const { splitAddress } = await splitClient.createSplit(splitParams);
          recipientAddress = splitAddress;
        }
      } catch (err) {
        console.error("Failed to create split:", err);
        setCreatingSplit(false);
        return;
      }
      setCreatingSplit(false);
    } else {
      recipientAddress =
        (data.recipient.trim()
          ? recipientResolved.resolved
          : (address ?? "")) || "";
    }

    if (!isAddress(recipientAddress, { strict: false })) return;

    /**
     * The hook to attach, and its configuration.
     *
     * Both, together, because they are one decision. The tenure mode used to
     * mean "get or deploy a hook for this duration" — a second wallet prompt on
     * an unusual number, and a CREATE2 factory to make the address derivable.
     * The duration now travels as the slot's own `hookData`, so one address
     * serves every window and there is nothing to deploy.
     */
    const hookAddress = (
      data.hookMode === "none"
        ? zeroAddress
        : hookResolved.resolved || data.hook
    ) as Address;

    // 32 bytes, big-endian seconds — the shape `MinimumTenureHook` decodes.
    // Zero is not a short window but an unconfigured one, and the hook refuses
    // it at creation rather than vetoing every buy afterwards.
    const hookData: Hex =
      data.hookMode === "tenure"
        ? toHex(toSeconds(data.tenureValue, data.tenureUnit), { size: 32 })
        : ZERO_HOOK_DATA;

    if (
      hookAddress !== zeroAddress &&
      !isAddress(hookAddress, { strict: false })
    )
      return;

    const managerAddress = (
      data.mutableTax || data.mutableHook
        ? managerResolved.resolved || data.manager
        : zeroAddress
    ) as Address;

    const slotInit: SlotInit = {
      recipient: getAddress(recipientAddress),
      currency: getAddress(currency),
      manager:
        managerAddress === zeroAddress
          ? zeroAddress
          : getAddress(managerAddress),
      hook: hookAddress === zeroAddress ? zeroAddress : getAddress(hookAddress),
      hookData,
      taxPercentage: percentToBps(data.taxPercentage),
      minDepositSeconds: toSeconds(data.minDepositValue, data.minDepositUnit),
      mutableTax: data.mutableTax,
      mutableHook: data.mutableHook,
    };

    // The last gate before gas. `createSlot` asserts this again inside the SDK,
    // so this is belt-and-braces — but it is the one that can still show the
    // reason in the form rather than in a toast after a failed send.
    try {
      assertSlotInit(slotInit);
    } catch (e) {
      console.error("[create] refusing to send an init the chain rejects:", e);
      return;
    }

    setAllSubmitted(false);
    setBatchIndex(0);
    createdAddress.current = null;

    // A single slot gets a simulation first: the factory returns the address it
    // will deploy to, and a transaction hash carries no return value — so
    // asking now is the only way to land the user on their own slot afterwards
    // instead of on the index. It also surfaces a hook's veto as that hook's
    // own revert reason, which a sent-and-reverted transaction cannot.
    if (slotCount === 1) {
      const predicted = await actions.preflight("Preview slot", () =>
        actions.client.simulateCreateSlot(slotInit),
      );
      if (!predicted) return;
      createdAddress.current = predicted;
    }

    // There is one `createSlot(SlotInit)` and no batch entry point, so a count
    // above one is n transactions. Sent in sequence and stopped on the first
    // refusal, because a wallet rejection halfway through a strip should leave
    // the slots already made and not queue five more prompts behind it.
    for (let i = 0; i < slotCount; i++) {
      setBatchIndex(i);
      const hash = await actions.createSlot(slotInit);
      if (!hash) return;
    }
    setAllSubmitted(true);
  }

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
      <PageHeader maxWidth="max-w-6xl">
        <div>
          <h1 className="text-xl font-bold tracking-tight leading-tight">
            Create a slot
          </h1>
          <p className="text-muted-foreground text-xs">
            Eight values, fixed at birth except the ones you say may move
            {chain?.name ? ` · ${chain.name}` : ""}.
          </p>
        </div>
      </PageHeader>

      <div className="max-w-6xl mx-auto px-3 md:px-5 py-4 md:py-8 pb-24 lg:pb-8">
        <Form {...form}>
          <form
            id="create-slot-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex gap-6 items-start"
          >
            {/* Left: Form */}
            {/* No divide-y: FormSection carries border-t first:border-t-0, so
                the first section sits flush against the card's own border. */}
            <div className="flex-1 min-w-0 rounded-lg border">
              <FormSection meta={SECTION.recipient}>
                <SectionRecipient />
              </FormSection>

              <FormSection meta={SECTION.currency}>
                <SectionCurrency />
              </FormSection>

              <FormSection meta={SECTION.economics}>
                <SectionEconomics />
              </FormSection>

              <FormSection meta={SECTION.hook}>
                <SectionHook />
              </FormSection>

              <FormSection meta={SECTION.permissions}>
                <SectionPermissions />
              </FormSection>
            </div>

            <SummaryCard
              slotCount={slotCount}
              setSlotCount={setSlotCount}
              submitState={submitState}
              switchChain={switchChain}
              chainId={selectedChainId}
            />

            <MobileBottomBar
              slotCount={slotCount}
              setSlotCount={setSlotCount}
              submitState={submitState}
              switchChain={switchChain}
              chainId={selectedChainId}
            />
          </form>
        </Form>
      </div>
    </div>
  );
}
