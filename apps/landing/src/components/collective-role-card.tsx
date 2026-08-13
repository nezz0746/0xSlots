"use client";

import { slotCollectiveAbi } from "@0xslots/contracts";
import { Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { type Address, isAddress } from "viem";
import {
  useAccount,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { CopyAddress } from "@/components/copy-address";
import { Input } from "@/components/ui/input";
import type { RoleGroup } from "@/hooks/use-collectives";
import { cn } from "@/lib/utils";

/**
 * One role, its holders, and — for an admin — the controls to change them.
 *
 * A role with no holders still renders. Empty means "only the admin can use
 * this": `onlyRoleOrAdmin` on the contract admits the admin everywhere, so an
 * unheld role is not an ungoverned dimension, and hiding the card would say the
 * opposite of the truth.
 *
 * Grant and revoke are `AccessControl`'s own, both gated on the role's admin —
 * which for all five is `DEFAULT_ADMIN_ROLE`. The UI only appears for an admin,
 * but that is a convenience, not the security boundary: the contract rejects
 * anyone else regardless of what the page renders.
 */
export function CollectiveRoleCard({
  collective,
  group,
  isAdmin,
  onChanged,
}: {
  collective: Address;
  group: RoleGroup;
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const Icon = group.icon;
  const { address: me } = useAccount();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  /** Address armed for an irreversible revoke — see `isLastAdmin`. */
  const [confirming, setConfirming] = useState<Address | null>(null);

  const { writeContract, data: hash, isPending, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // The indexer only learns about the change from the event, so the refetch has
  // to wait for the receipt rather than the send.
  useEffect(() => {
    if (!isSuccess) return;
    onChanged();
    setDraft("");
    setAdding(false);
    setConfirming(null);
    reset();
  }, [isSuccess, onChanged, reset]);

  const busy = isPending || isConfirming;

  const call = (functionName: "grantRole" | "revokeRole", account: Address) =>
    writeContract(
      {
        address: collective,
        abi: slotCollectiveAbi,
        functionName,
        args: [group.hash, account],
      },
      {
        onError: (e) => toast.error(e.message.split("\n")[0] ?? "Failed"),
      },
    );

  const draftValid = isAddress(draft);
  const alreadyHolds =
    draftValid &&
    group.members.some((m) => m.account.toLowerCase() === draft.toLowerCase());

  /**
   * Revoking the LAST admin is unrecoverable.
   *
   * `DEFAULT_ADMIN_ROLE` administers all five roles and itself, so once nobody
   * holds it there is no address left that can ever grant it again. The
   * collective keeps working — slots stay governed by whoever holds the four
   * manager roles today — but membership is frozen forever.
   *
   * Every other revoke is undoable by re-granting, so only this one asks.
   */
  const isLastAdmin =
    group.label === "DEFAULT_ADMIN" && group.members.length === 1;

  return (
    <div className="border bg-background p-2">
      <div className="flex items-start gap-2">
        <span
          className={cn(
            "flex size-6 shrink-0 items-center justify-center",
            group.tint,
          )}
        >
          <Icon className="size-3.5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-semibold">{group.title}</span>
            <span className="text-[10px] text-muted-foreground">
              {group.members.length || "—"}
            </span>
          </div>
          <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
            {group.can}
          </p>

          <div className="mt-1.5 space-y-1">
            {group.members.length === 0 ? (
              <p className="text-[10px] italic text-muted-foreground">
                Nobody — admin only
              </p>
            ) : (
              group.members.map((m) => {
                const isMe =
                  !!me && m.account.toLowerCase() === me.toLowerCase();
                const armed = confirming === m.account;
                return (
                  <div key={m.account} className="space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <CopyAddress address={m.account} />
                      {isAdmin && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            // Two-step only where a mistake cannot be undone.
                            if (isLastAdmin && !armed) {
                              setConfirming(m.account);
                              return;
                            }
                            setConfirming(null);
                            call("revokeRole", m.account);
                          }}
                          title={armed ? "Confirm revoke" : "Revoke"}
                          aria-label={`Revoke ${group.title} from ${m.account}`}
                          className={cn(
                            "shrink-0 transition-colors disabled:opacity-40",
                            armed
                              ? "text-red-600 dark:text-red-500"
                              : "text-muted-foreground hover:text-red-600 dark:hover:text-red-500",
                          )}
                        >
                          <X className="size-3" />
                        </button>
                      )}
                    </div>
                    {armed && (
                      <p className="text-[10px] leading-snug text-red-600 dark:text-red-500">
                        {isMe ? "This is you, and t" : "T"}his is the last
                        admin. Revoking it means no address can ever grant a
                        role on this collective again. Click ✕ once more to
                        confirm.
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {isAdmin && (
            <div className="mt-1.5">
              {adding ? (
                <div className="space-y-1">
                  <Input
                    autoFocus
                    placeholder="0x…"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && draftValid && !alreadyHolds) {
                        call("grantRole", draft as Address);
                      }
                      if (e.key === "Escape") {
                        setAdding(false);
                        setDraft("");
                      }
                    }}
                    className={cn(
                      "h-7 text-[11px]",
                      draft !== "" && !draftValid && "border-red-500",
                    )}
                  />
                  {alreadyHolds && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-500">
                      Already holds this role.
                    </p>
                  )}
                  <div className="flex gap-1">
                    <button
                      type="button"
                      disabled={!draftValid || alreadyHolds || busy}
                      onClick={() => call("grantRole", draft as Address)}
                      className="flex-1 border px-2 py-1 text-[10px] font-medium transition-colors hover:bg-muted disabled:opacity-40"
                    >
                      {busy ? "Granting…" : "Grant"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setAdding(false);
                        setDraft("");
                      }}
                      className="border px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setAdding(true)}
                  className="flex w-full items-center justify-center gap-1 border border-dashed py-1 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                >
                  <Plus className="size-3" />
                  Grant to address
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
