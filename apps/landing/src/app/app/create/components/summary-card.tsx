import { findKnownHook } from "@0xslots/contracts/slots";
import { getChainTokens } from "@0xslots/sdk";
import { Clock, Coins, HandCoins, KeyRound, Plug } from "lucide-react";
import { useFormContext } from "react-hook-form";
import { type Address, isAddress } from "viem";
import { SplitBar } from "@/components/split-recipients-bar";
import { Separator } from "@/components/ui/separator";
import { truncateAddress } from "@/utils";
import { useResolveAddress } from "../address-input";
import { useErc20Check } from "../hooks/use-erc20-check";
import { type CreateSlotFormValues, formatValueUnit } from "../schema";
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

/**
 * The whole slot, on one sticky card, with every line a link back to the field
 * that produced it.
 *
 * This is the last thing read before signing something immutable, so it says
 * what the slot IS rather than what was filled in: "Instant buy" rather than a
 * blank occupancy row, "No manager" rather than an omitted one.
 */
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
  const minDepositValue = form.watch("minDepositValue");
  const minDepositUnit = form.watch("minDepositUnit");
  const splitRecipients = form.watch("splitRecipients");
  const hookMode = form.watch("hookMode");
  const hook = form.watch("hook");
  const mutableTax = form.watch("mutableTax");
  const mutableHook = form.watch("mutableHook");
  const manager = form.watch("manager");

  const recipientResolved = useResolveAddress(recipient);
  const effectiveRecipient =
    recipientMode === "group" ? "Group" : recipientResolved.resolved || "";

  // Currency resolution
  const chainTokens = getChainTokens(chainId);
  const presetToken = chainTokens.find((t) => t.address === presetCurrency);
  const erc20 = useErc20Check(currencyMode === "custom" ? customCurrency : "");
  const currencyLabel =
    currencyMode === "preset" && presetToken
      ? presetToken.symbol
      : erc20.data
        ? erc20.data.symbol
        : null;
  const currencySubLabel =
    currencyMode === "preset" && presetToken
      ? presetToken.name
      : erc20.data
        ? erc20.data.name
        : null;

  const knownHook = findKnownHook(chainId, hook as Address);
  const hasMutable = mutableTax || mutableHook;

  return (
    // `self-stretch` is what makes the `sticky` below actually stick. A sticky
    // element can only travel inside its containing block, and the parent form
    // is `items-start` — which sizes this column to its own content, leaving the
    // card exactly as tall as its wrapper and therefore nowhere to move. The
    // column has to span the form's full height for the card to ride down it.
    <div className="hidden w-72 shrink-0 self-stretch lg:block">
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
                    : isAddress(effectiveRecipient, { strict: false })
                      ? truncateAddress(effectiveRecipient)
                      : "My Account"}
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

            {/* Tax Rate */}
            <SummaryRow
              section="economics"
              label="Tax Rate"
              icon={<HandCoins className="size-3" />}
            >
              {taxPercentage || "0"}% / 30d
            </SummaryRow>

            {/* Min Deposit */}
            <SummaryRow
              section="economics"
              label="Min Deposit"
              icon={<Clock className="size-3" />}
            >
              {formatValueUnit(minDepositValue || "0", minDepositUnit)}
            </SummaryRow>

            {/* Hook — the address; the row below says what it MEANS. */}
            <SummaryRow
              section="hook"
              label="Hook"
              icon={<Plug className="size-3" />}
            >
              <span className="truncate max-w-32 inline-block align-bottom">
                {hookMode === "none" || !hook
                  ? "None"
                  : (knownHook?.name ??
                    (isAddress(hook, { strict: false })
                      ? truncateAddress(hook)
                      : "—"))}
              </span>
            </SummaryRow>

            <OccupancySummaryRows onJump={scrollToSection} />

            {/* Mutability. Always stated, both ways round: "No manager" is the
                stronger promise of the two and the one worth reading twice. */}
            <SummaryRow
              section="permissions"
              label="Mutable"
              icon={<KeyRound className="size-3" />}
            >
              {hasMutable
                ? mutableTax && mutableHook
                  ? "Tax + Hook"
                  : mutableTax
                    ? "Tax"
                    : "Hook"
                : "Nothing — immutable"}
            </SummaryRow>

            {hasMutable && (
              <SummaryRow section="permissions" label="Manager">
                <span className="truncate max-w-32 inline-block align-bottom">
                  {isAddress(manager, { strict: false })
                    ? truncateAddress(manager)
                    : "—"}
                </span>
              </SummaryRow>
            )}

            {/* Total */}
            <div className="flex justify-between border-t pt-2 mt-2">
              <span className="text-muted-foreground">Total</span>
              <span className="font-semibold">{slotCount}× identical</span>
            </div>
          </div>

          <Separator />

          <ErrorSummary
            onJump={scrollToSection}
            initError={submitState.initError}
          />

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
