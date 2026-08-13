import { getChainTokens } from "@0xslots/sdk";
import { Clock, Coins, HandCoins, Puzzle, Sparkles } from "lucide-react";
import { useFormContext } from "react-hook-form";
import { isAddress } from "viem";
import { SplitBar } from "@/components/split-recipients-bar";
import { Separator } from "@/components/ui/separator";
import { truncateAddress } from "@/utils";
import { useResolveAddress } from "../address-input";
import { useErc20Check } from "../hooks/use-erc20-check";
import type { CreateSlotFormValues } from "../schema";
import { type SectionId, scrollToSection } from "../sections";
import { ErrorSummary } from "./error-summary";
import { OccupancySummaryRows } from "./occupancy-summary-rows";
import { SlotCounter } from "./slot-counter";
import { SubmitButton, type SubmitState } from "./submit-button";

interface SummaryCardProps {
  slotCount: number;
  setSlotCount: (count: number) => void;
  submitState: SubmitState;
  switchChain: (params: { chainId: number }) => void;
  chainId: number;
}

export function SummaryCard({
  slotCount,
  setSlotCount,
  submitState,
  switchChain,
  chainId,
}: SummaryCardProps) {
  const form = useFormContext<CreateSlotFormValues>();
  const recipientMode = form.watch("recipientMode");
  const recipient = form.watch("recipient");
  const currencyMode = form.watch("currencyMode");
  const presetCurrency = form.watch("presetCurrency");
  const customCurrency = form.watch("customCurrency");
  const taxPercentage = form.watch("taxPercentage");
  const bounty = form.watch("liquidationBountyPercent");
  const minDepositValue = form.watch("minDepositValue");
  const minDepositUnit = form.watch("minDepositUnit");
  const splitRecipients = form.watch("splitRecipients");
  const moduleMode = form.watch("moduleMode");
  const module = form.watch("module");
  const mutableTax = form.watch("mutableTax");
  const mutableModule = form.watch("mutableModule");

  const recipientResolved = useResolveAddress(recipient);
  const effectiveRecipient =
    recipientMode === "group" ? "Group" : recipientResolved.resolved || "";

  // Currency resolution
  const chainTokens = getChainTokens(chainId);
  const presetToken = chainTokens.find((t) => t.address === presetCurrency);
  const erc20 = useErc20Check(currencyMode === "custom" ? customCurrency : "");
  const currencyLabel =
    currencyMode === "preset" && presetToken
      ? `${presetToken.symbol}`
      : erc20.data
        ? `${erc20.data.symbol}`
        : null;
  const currencySubLabel =
    currencyMode === "preset" && presetToken
      ? presetToken.name
      : erc20.data
        ? erc20.data.name
        : null;

  const hasMutable = mutableTax || mutableModule;

  return (
    <div className="hidden lg:block w-72 shrink-0">
      <div className="sticky top-8 rounded-lg border">
        <div className="bg-muted/50 border-b px-3 py-3">
          <p className="text-xs text-muted-foreground font-semibold">Summary</p>
        </div>

        <div className="p-4 space-y-4">
          {/* Slot count selector */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Slots</span>
            <SlotCounter value={slotCount} onChange={setSlotCount} />
          </div>

          <Separator />

          <div className="space-y-2 text-sm">
            {/* Recipient */}
            <div>
              <SummaryRow section="recipient" label="Recipient">
                <span className="truncate max-w-32 inline-block align-bottom">
                  {recipientMode === "group"
                    ? "Group"
                    : isAddress(effectiveRecipient as `0x${string}`)
                      ? truncateAddress(effectiveRecipient)
                      : "—"}
                </span>
              </SummaryRow>
              {recipientMode === "group" &&
                splitRecipients.filter((r) => r.address.trim()).length > 0 && (
                  <div className="mt-2">
                    <SplitBar
                      recipients={splitRecipients
                        .filter((r) => r.address.trim())
                        .map((r) => ({
                          address: r.address,
                          percent: r.percentAllocation,
                        }))}
                    />
                  </div>
                )}
            </div>

            {/* Currency */}
            <SummaryRow
              section="currency"
              label="Currency"
              icon={<Coins className="size-3" />}
            >
              {currencyLabel ? (
                <>
                  {currencyLabel}
                  {currencySubLabel && currencySubLabel !== currencyLabel && (
                    <span className="text-muted-foreground font-normal ml-1">
                      {currencySubLabel}
                    </span>
                  )}
                </>
              ) : (
                "—"
              )}
            </SummaryRow>

            {/* Module */}
            {moduleMode !== "none" && module && (
              <SummaryRow
                section="module"
                label="Module"
                icon={<Puzzle className="size-3" />}
              >
                <span className="truncate max-w-32 inline-block align-bottom">
                  {moduleMode === "verified"
                    ? "Metadata"
                    : truncateAddress(module)}
                </span>
              </SummaryRow>
            )}

            {/* Tax Rate */}
            <SummaryRow
              section="economics"
              label="Tax Rate"
              icon={<HandCoins className="size-3" />}
            >
              {taxPercentage || "0"}%/mo
            </SummaryRow>

            {/* Min Deposit */}
            <SummaryRow
              section="economics"
              label="Min Deposit"
              icon={<Clock className="size-3" />}
            >
              {minDepositValue || "0"} {minDepositUnit}
            </SummaryRow>

            <OccupancySummaryRows />

            {/* Mutable — only show if something is mutable */}
            {hasMutable && (
              <SummaryRow section="permissions" label="Mutable">
                {mutableTax && mutableModule
                  ? "Tax + Module"
                  : mutableTax
                    ? "Tax"
                    : "Module"}
              </SummaryRow>
            )}

            {/* Liq. Bounty */}
            <SummaryRow
              section="permissions"
              label="Liq. Bounty"
              icon={<Sparkles className="size-3 text-amber-500" />}
            >
              {bounty || "0"}%
            </SummaryRow>

            {/* Total */}
            <div className="flex justify-between border-t pt-2 mt-2">
              <span className="text-muted-foreground">Total</span>
              <span className="font-semibold">{slotCount}× identical</span>
            </div>
          </div>

          <Separator />

          <ErrorSummary onJump={scrollToSection} />

          <SubmitButton
            state={submitState}
            switchChain={switchChain}
            chainId={chainId}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
}

/** A summary line that scrolls the form to the section it describes. */
function SummaryRow({
  section,
  label,
  icon,
  children,
}: {
  section: SectionId;
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => scrollToSection(section)}
      className="flex w-full justify-between rounded px-1 -mx-1 py-0.5 text-left hover:bg-muted/60 transition-colors"
    >
      <span className="text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </span>
      <span className="font-semibold text-xs text-right">{children}</span>
    </button>
  );
}
