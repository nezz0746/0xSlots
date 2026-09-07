import { CHAINS } from "@0xslots/contracts";
import { ConnectButton } from "@/components/connect-button";
import { Button } from "@/components/ui/button";
import { useFarcaster } from "@/context/farcaster";

/**
 * Everything the button needs to say what it is doing, in one object.
 *
 * Passed down rather than re-derived, because this button is rendered twice —
 * in the desktop summary card and inside the mobile drawer — and two copies
 * deriving "am I busy" independently is how the two of them start disagreeing.
 */
export interface SubmitState {
  isConnected: boolean;
  wrongChain: boolean;
  isSuccess: boolean;
  isPending: boolean;
  isConfirming: boolean;
  creatingSplit: boolean;
  busy: boolean;
  anyResolving: boolean;
  /** The zod schema's verdict on the form. */
  isFormValid: boolean;
  /**
   * `assertSlotInit`'s verdict on the resolved eight values, or null.
   *
   * Separate from `isFormValid` because it is a different question asked of a
   * different object — see `ErrorSummary`. Both must pass before the button
   * arms, so a failure here disables it even on a form the schema likes.
   */
  initError: string | null;
  slotCount: number;
  /** How many of a multi-slot batch have been submitted so far. */
  batchIndex: number;
  recipientMode: string;
}

interface SubmitButtonProps {
  state: SubmitState;
  switchChain: (params: { chainId: number }) => void;
  chainId: number;
  className?: string;
  /** Associate with a <form> by id (needed when rendered in a portal). */
  formId?: string;
}

function getSubmitLabel(state: SubmitState): string {
  const {
    creatingSplit,
    isPending,
    isConfirming,
    recipientMode,
    slotCount,
    batchIndex,
  } = state;
  const isGroup = recipientMode === "group";

  if (creatingSplit) return "1/2 — Creating split…";

  // A batch is n transactions now, not one call with a count. Naming which one
  // is in flight is the difference between "why is my wallet asking again" and
  // a progress bar.
  if (slotCount > 1 && (isPending || isConfirming))
    return `Creating ${Math.min(batchIndex + 1, slotCount)} of ${slotCount}…`;

  if (isPending)
    return isGroup ? "2/2 — Confirm in wallet…" : "Confirm in wallet…";
  if (isConfirming) return isGroup ? "2/2 — Creating slot…" : "Confirming…";
  return slotCount > 1 ? `Create ${slotCount} Slots` : "Create Slot";
}

export function SubmitButton({
  state,
  switchChain,
  chainId,
  className,
  formId,
}: SubmitButtonProps) {
  const { isMiniApp } = useFarcaster();

  if (!state.isConnected && !isMiniApp) {
    return (
      <div className={className}>
        <ConnectButton />
      </div>
    );
  }

  if (state.wrongChain && !isMiniApp) {
    return (
      <Button
        type="button"
        variant="destructive"
        className={className}
        onClick={() => switchChain({ chainId })}
      >
        Switch to{" "}
        {CHAINS.find((c) => c.id === chainId)?.name ?? `chain ${chainId}`}
      </Button>
    );
  }

  if (state.isSuccess) {
    return (
      <div className={`text-center space-y-1 py-2 ${className ?? ""}`}>
        <p className="text-sm text-green-600 font-bold">
          {state.slotCount > 1
            ? `${state.slotCount} SLOTS CREATED`
            : "SLOT CREATED"}
        </p>
        <p className="text-xs text-muted-foreground">Redirecting…</p>
      </div>
    );
  }

  return (
    <Button
      type="submit"
      form={formId}
      className={className}
      disabled={
        state.busy ||
        state.anyResolving ||
        !state.isFormValid ||
        !!state.initError
      }
    >
      {getSubmitLabel(state)}
    </Button>
  );
}
