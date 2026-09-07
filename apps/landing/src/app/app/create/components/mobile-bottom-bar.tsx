import { findKnownHook } from "@0xslots/contracts/slots";
import { getChainTokens } from "@0xslots/sdk";
import {
  ChevronUp,
  Clock,
  Coins,
  HandCoins,
  KeyRound,
  Plug,
} from "lucide-react";
import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { type Address, isAddress } from "viem";
import { useAccount } from "wagmi";
import { SplitBar } from "@/components/split-recipients-bar";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
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

interface MobileBottomBarProps {
  slotCount: number;
  setSlotCount: (count: number) => void;
  submitState: SubmitState;
  switchChain: (params: { chainId: number }) => void;
  chainId: number;
}

/**
 * The summary card, for a viewport with no room for a sticky column.
 *
 * Same rows, same order, same jump targets — deliberately, because the desktop
 * card is where the pre-signing read happens and a mobile user is entitled to
 * the same read. The one thing that differs is that it starts collapsed.
 */
export function MobileBottomBar({
  slotCount,
  setSlotCount,
  submitState,
  switchChain,
  chainId,
}: MobileBottomBarProps) {
  const [open, setOpen] = useState(false);
  const { address } = useAccount();
  const form = useFormContext<CreateSlotFormValues>();
  const recipientMode = form.watch("recipientMode");
  const recipient = form.watch("recipient");
  const currencyMode = form.watch("currencyMode");
  const presetCurrency = form.watch("presetCurrency");
  const customCurrency = form.watch("customCurrency");
  const taxBps = form.watch("taxBps");
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
    recipientMode === "group"
      ? "Group"
      : recipientResolved.resolved || recipient || (address ?? "");

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
  // Nothing is sequential any more, so "ready" means the form actually
  // validates — not that you reached the last of three steps.
  const ready = submitState.isFormValid && !submitState.initError;

  // The sheet covers the form, so it has to get out of the way before the
  // scroll — otherwise the jump lands behind it and looks like nothing
  // happened. One frame is enough for the close animation to start.
  const jumpTo = (id: SectionId) => {
    setOpen(false);
    requestAnimationFrame(() => scrollToSection(id));
  };

  return (
    <div
      className="fixed left-0 right-0 lg:hidden z-50"
      style={{ bottom: `var(--bottom-bar-h, 0px)` }}
    >
      <Drawer open={open} onOpenChange={setOpen}>
        {/* Collapsed bar */}
        <div className="bg-background border-t p-3">
          <div className="max-w-3xl mx-auto">
            <DrawerTrigger asChild>
              <Button
                variant={ready ? "default" : "outline"}
                className={`w-full gap-2 ${ready ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
              >
                <ChevronUp className="size-4" />
                Finalize
              </Button>
            </DrawerTrigger>
          </div>
        </div>

        {/* Bottom sheet */}
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Slot Summary</DrawerTitle>
          </DrawerHeader>

          <div className="px-4 pb-2 space-y-4">
            {/* Slot count */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Slots</span>
              <SlotCounter value={slotCount} onChange={setSlotCount} />
            </div>

            <Separator />

            {/* Details */}
            <div className="space-y-3 text-sm">
              {/* Recipient */}
              <div>
                <SummaryRow
                  section="recipient"
                  label="Recipient"
                  onJump={jumpTo}
                >
                  {recipientMode === "group"
                    ? "Group"
                    : isAddress(effectiveRecipient, { strict: false })
                      ? truncateAddress(effectiveRecipient)
                      : "My Account"}
                </SummaryRow>
                {recipientMode === "group" &&
                  splitRecipients.filter((r) => r.address.trim()).length >
                    0 && (
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
                onJump={jumpTo}
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
                onJump={jumpTo}
              >
                {taxBps || "0"}% / 30d
              </SummaryRow>

              {/* Min Deposit */}
              <SummaryRow
                section="economics"
                label="Min Deposit"
                icon={<Clock className="size-3" />}
                onJump={jumpTo}
              >
                {formatValueUnit(minDepositValue || "0", minDepositUnit)}
              </SummaryRow>

              {/* Hook */}
              <SummaryRow
                section="hook"
                label="Hook"
                icon={<Plug className="size-3" />}
                onJump={jumpTo}
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

              <OccupancySummaryRows onJump={jumpTo} />

              {/* Mutability */}
              <SummaryRow
                section="permissions"
                label="Mutable"
                icon={<KeyRound className="size-3" />}
                onJump={jumpTo}
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
                <SummaryRow
                  section="permissions"
                  label="Manager"
                  onJump={jumpTo}
                >
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
                <span className="font-semibold">{slotCount}x identical</span>
              </div>
            </div>
          </div>

          <DrawerFooter>
            <ErrorSummary onJump={jumpTo} initError={submitState.initError} />
            <SubmitButton
              state={submitState}
              switchChain={switchChain}
              chainId={chainId}
              className="w-full"
              formId="create-slot-form"
            />
            <DrawerClose asChild>
              <Button variant="outline" className="w-full">
                Close
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

/** A summary line that closes the drawer, then scrolls to its section. */
function SummaryRow({
  section,
  label,
  icon,
  onJump,
  children,
}: {
  section: SectionId;
  label: string;
  icon?: React.ReactNode;
  onJump: (id: SectionId) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onJump(section)}
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
