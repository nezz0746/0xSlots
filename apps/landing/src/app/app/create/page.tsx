"use client";

import { getChainTokens } from "@0xslots/sdk";
import { SplitV2Type } from "@0xsplits/splits-sdk/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { type Address, getAddress, isAddress, zeroAddress } from "viem";
import { useAccount, useSwitchChain } from "wagmi";
import { PageHeader } from "@/components/page-header";
import { Form } from "@/components/ui/form";
import { useChain } from "@/context/chain";
import { useNavigation } from "@/context/navigation";
import { useSlotAction } from "@/hooks/use-slot-action";
import { useSplitClient } from "@/hooks/use-split-client";
import { resolveEnsAddress } from "@/lib/ens";
import { toRawUnits } from "@/utils";
import { useResolveAddress } from "./address-input";
import { FormSection } from "./components/form-section";
import { MobileBottomBar } from "./components/mobile-bottom-bar";
import { OccupancySection } from "./components/occupancy-section";
import { SectionCurrency } from "./components/section-currency";
import { SectionEconomics } from "./components/section-economics";
import { SectionModule } from "./components/section-module";
import { SectionPermissions } from "./components/section-permissions";
import { SectionRecipient } from "./components/section-recipient";
import { SummaryCard } from "./components/summary-card";
import { useErc20Check } from "./hooks/use-erc20-check";
import {
  type CreateSlotFormValues,
  createSlotSchema,
  defaultValues,
  percentToBps,
  toSeconds,
} from "./schema";
import { SECTION } from "./sections";

export default function CreatePage() {
  const { push } = useNavigation();
  const { address, isConnected, chainId: walletChainId, chain } = useAccount();
  const { switchChain } = useSwitchChain();
  const { chainId: selectedChainId } = useChain();
  const {
    createSlot: sdkCreateSlot,
    createSlotWithTenure: sdkCreateSlotWithTenure,
    createSlotWithPriceFloor: sdkCreateSlotWithPriceFloor,
    createSlots: sdkCreateSlots,
    isPending,
    isConfirming,
    isSuccess,
  } = useSlotAction();
  const splitClient = useSplitClient();
  const [slotCount, setSlotCount] = useState(1);
  const [creatingSplit, setCreatingSplit] = useState(false);

  const form = useForm<CreateSlotFormValues>({
    resolver: zodResolver(createSlotSchema),
    defaultValues,
    mode: "onChange",
  });

  // A tenure or price policy may need deploying first, which the single-slot
  // helpers handle and the batch path does not. Clamp rather than silently
  // discard the policy the user just configured.
  const occupancyConfigured = form.watch("occupancyPolicyMode") !== "none";
  useEffect(() => {
    if (occupancyConfigured && slotCount !== 1) setSlotCount(1);
  }, [occupancyConfigured, slotCount]);

  // Only watch what the page itself needs for submission logic
  const watchedRecipientMode = form.watch("recipientMode");
  const watchedRecipient = form.watch("recipient");
  const watchedCustomCurrency = form.watch("customCurrency");
  const watchedModule = form.watch("module");
  const watchedManager = form.watch("manager");
  const watchedMutableTax = form.watch("mutableTax");
  const watchedMutableModule = form.watch("mutableModule");

  const watchedMutablePolicy = form.watch("mutablePolicy");

  const needsManager =
    watchedMutableTax || watchedMutableModule || watchedMutablePolicy;

  // A price floor is denominated in the slot's own currency, so converting it
  // to raw units needs THAT token's decimals — 1 USDC is 1e6, 1 WETH is 1e18.
  const watchedCurrencyMode = form.watch("currencyMode");
  const watchedPresetCurrency = form.watch("presetCurrency");
  const presetTokenInfo = getChainTokens(selectedChainId).find(
    (t) => t.address === watchedPresetCurrency,
  );
  const customTokenInfo = useErc20Check(
    watchedCurrencyMode === "custom" ? watchedCustomCurrency : "",
  );
  const currencyDecimals =
    (watchedCurrencyMode === "preset"
      ? presetTokenInfo?.decimals
      : customTokenInfo.data?.decimals) ?? 18;

  // ENS resolution for submission
  const recipientResolved = useResolveAddress(watchedRecipient);
  const currencyResolved = useResolveAddress(watchedCustomCurrency);
  const moduleResolved = useResolveAddress(watchedModule);
  const managerResolved = useResolveAddress(watchedManager);

  const wrongChain = walletChainId !== selectedChainId;
  const busy = isPending || isConfirming || creatingSplit;
  const anyResolving =
    recipientResolved.isResolving ||
    currencyResolved.isResolving ||
    moduleResolved.isResolving ||
    managerResolved.isResolving;

  // The chain's default currency is seeded by SectionCurrency, next to the
  // FormField that registers `presetCurrency`. Seeding it from here silently
  // did nothing: react-hook-form re-syncs unregistered fields back to their
  // schema default during mount, so the write was undone before first paint.

  useEffect(() => {
    if (isSuccess) {
      const timeout = setTimeout(() => push("/app"), 1500);
      return () => clearTimeout(timeout);
    }
  }, [isSuccess, push]);

  const submitState = {
    isConnected,
    wrongChain,
    isSuccess,
    isPending,
    isConfirming,
    creatingSplit,
    busy,
    anyResolving,
    isFormValid: form.formState.isValid,
    slotCount,
    recipientMode: watchedRecipientMode,
  };

  async function onSubmit(data: CreateSlotFormValues) {
    if (!isConnected || wrongChain) return;

    const currency =
      data.currencyMode === "preset"
        ? data.presetCurrency
        : currencyResolved.resolved || data.customCurrency;
    const module = moduleResolved.resolved || "";
    const manager = needsManager ? managerResolved.resolved : zeroAddress;

    if (!isAddress(currency as string)) return;

    let recipient: string;

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
        // Check if this exact split already exists
        const { splitAddress: predictedAddress, deployed } =
          await splitClient.isDeployed(splitParams);

        if (deployed) {
          recipient = predictedAddress;
        } else {
          const { splitAddress } = await splitClient.createSplit(splitParams);
          recipient = splitAddress;
        }
      } catch (err) {
        console.error("Failed to create split:", err);
        setCreatingSplit(false);
        return;
      }
      setCreatingSplit(false);
    } else {
      recipient =
        recipientResolved.resolved || data.recipient || (address ?? "");
    }

    if (!isAddress(recipient as string)) return;

    // A policy chosen by address is known now. One chosen by duration or price
    // floor is resolved by the helpers below, which overwrite this.
    const occupancyPolicy = (
      data.occupancyPolicyMode !== "none" &&
      isAddress(data.occupancyPolicy as string)
        ? data.occupancyPolicy
        : zeroAddress
    ) as Address;

    const config = {
      mutableTax: data.mutableTax,
      mutableModule: data.mutableModule,
      mutablePolicy: data.mutablePolicy,
      manager: (isAddress(manager as string)
        ? manager
        : zeroAddress) as Address,
    };
    const initParams = {
      taxPercentage: BigInt(Math.round(Number(data.taxPercentage) * 100)),
      module: (isAddress(module as string) ? module : zeroAddress) as Address,
      liquidationBountyBps: percentToBps(data.liquidationBountyPercent),
      minDepositSeconds: toSeconds(data.minDepositValue, data.minDepositUnit),
      occupancyPolicy,
    };

    // A policy chosen by duration or by price floor lives at a CREATE2 address
    // derived from those terms, so it may not exist yet — these helpers deploy
    // it first when needed, then create. Every other mode already has a
    // concrete address sitting in `initParams.occupancyPolicy`.
    if (slotCount === 1 && data.occupancyPolicyMode === "tenure") {
      sdkCreateSlotWithTenure(
        {
          recipient: recipient as Address,
          currency: currency as Address,
          config,
          initParams,
        },
        toSeconds(data.tenureValue, data.tenureUnit),
      );
    } else if (slotCount === 1 && data.occupancyPolicyMode === "price") {
      // The floor is denominated in the slot's own currency, so it converts
      // with THAT token's decimals — 1 USDC is 1e6, 1 WETH is 1e18 — and the
      // policy rejects a mismatched pairing on-chain.
      sdkCreateSlotWithPriceFloor(
        {
          recipient: recipient as Address,
          currency: currency as Address,
          config,
          initParams,
        },
        toRawUnits(data.minPriceValue, currencyDecimals),
      );
    } else if (slotCount === 1) {
      sdkCreateSlot({
        recipient: recipient as Address,
        currency: currency as Address,
        config,
        initParams,
      });
    } else {
      sdkCreateSlots({
        recipient: recipient as Address,
        currency: currency as Address,
        config,
        initParams,
        count: BigInt(slotCount),
      });
    }
  }

  return (
    <div className="min-h-screen">
      <PageHeader maxWidth="max-w-6xl">
        <div>
          <h1 className="text-xl font-bold tracking-tight leading-tight">
            Create Slot
          </h1>
          <p className="text-muted-foreground text-xs">
            Deploy a new slot on {chain?.name}
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

              <FormSection meta={SECTION.module}>
                <SectionModule />
              </FormSection>

              <FormSection meta={SECTION.occupancy}>
                <OccupancySection />
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
