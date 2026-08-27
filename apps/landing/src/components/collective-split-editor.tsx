"use client";

import { slotCollectiveAbi } from "@0xslots/contracts";
import { Pencil, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { type Address, isAddress } from "viem";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { Input } from "@/components/ui/input";
import type { SplitRecipient } from "@/hooks/use-collectives";
import { cn } from "@/lib/utils";

/**
 * Rewrite a collective's payout split.
 *
 * Gated on `SPLIT_MANAGER_ROLE` OR admin — the same `onlyRoleOrAdmin` the
 * on-chain `setSplit` enforces, so what this offers and what the chain accepts
 * agree. The button is simply absent for anyone else; `AccessControl` is the
 * real gate and would revert regardless.
 *
 * The read-only payout list stays where it is on the page. This is only the
 * edit affordance and the form it opens, so a viewer sees no change.
 */
export function CollectiveSplitEditor({
  collective,
  recipients,
  canManage,
  onChanged,
}: {
  collective: Address;
  recipients: SplitRecipient[];
  canManage: boolean;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  // Rows carry a stable id so removing a middle payee does not remount the
  // inputs below it (and so React has a key that is not the array index).
  const [rows, setRows] = useState<
    { id: number; account: string; shares: string }[]
  >([]);
  const nextId = useRef(0);
  const mkRow = (account = "", shares = "") => ({
    id: nextId.current++,
    account,
    shares,
  });

  const { writeContract, data: hash, isPending, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });
  const busy = isPending || isConfirming;

  useEffect(() => {
    if (isSuccess) {
      toast.success("Split updated");
      setEditing(false);
      onChanged();
      reset();
    }
  }, [isSuccess, onChanged, reset]);

  const open = () => {
    // Seed from the live split so an edit is a diff, not a rewrite from blank.
    // `allocation` is the raw share integer the contract stores, so it round-
    // trips: re-submitting untouched rows reproduces the current split exactly.
    setRows(
      recipients.length
        ? recipients.map((r) => mkRow(r.account, r.allocation))
        : [mkRow()],
    );
    setEditing(true);
  };

  const setRow = (
    id: number,
    patch: Partial<{ account: string; shares: string }>,
  ) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, mkRow()]);
  const removeRow = (id: number) =>
    setRows((rs) => rs.filter((r) => r.id !== id));

  // Validation mirrors the contract's `_validateSplitMemory`: at least one
  // payee, every allocation positive, and the total non-zero. Duplicates pass
  // on-chain but are always a mistake, so they are blocked here where the fix
  // is one edit rather than a reverted transaction.
  const parsed = rows.map((r) => {
    const account = r.account.trim();
    const shares = r.shares.trim();
    return {
      id: r.id,
      rawAccount: r.account,
      rawShares: r.shares,
      account,
      validAddr: isAddress(account),
      sharesNum: Number(shares),
      validShares: /^\d+$/.test(shares) && Number(shares) > 0,
    };
  });
  const total = parsed.reduce(
    (s, r) => s + (r.validShares ? r.sharesNum : 0),
    0,
  );
  const lower = parsed
    .filter((r) => r.validAddr)
    .map((r) => r.account.toLowerCase());
  const hasDuplicate = new Set(lower).size !== lower.length;
  const valid =
    parsed.length > 0 &&
    parsed.every((r) => r.validAddr && r.validShares) &&
    total > 0 &&
    !hasDuplicate;

  const save = () => {
    if (!valid) return;
    writeContract(
      {
        address: collective,
        abi: slotCollectiveAbi,
        functionName: "setSplit",
        args: [
          {
            recipients: parsed.map((r) => r.account as Address),
            // `rawShares` is validated to a positive integer string above, so
            // BigInt() is exact — no float round-trip through `sharesNum`.
            allocations: parsed.map((r) => BigInt(r.rawShares.trim())),
            totalAllocation: BigInt(total),
            // Kept at 0 to match how every collective is created (see the
            // create form). The indexer does not surface the current value, so
            // there is nothing to preserve; 0 is the only value in play.
            distributionIncentive: 0,
          },
        ],
      },
      { onError: (e) => toast.error(e.message.split("\n")[0] ?? "Failed") },
    );
  };

  if (!canManage) return null;

  if (!editing) {
    return (
      <button
        type="button"
        onClick={open}
        className="mt-2 flex items-center gap-1.5 border px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted"
      >
        <Pencil className="size-3" />
        Edit split
      </button>
    );
  }

  return (
    <div className="mt-2 border bg-background p-2">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-xs font-semibold">Edit split</span>
        <span
          className={cn(
            "text-[10px] tabular-nums",
            total > 0
              ? "text-muted-foreground"
              : "text-red-600 dark:text-red-500",
          )}
        >
          total {total || "—"}
        </span>
      </div>

      <div className="space-y-1">
        {parsed.map((r, i) => (
          <div key={r.id} className="flex items-center gap-1">
            <Input
              placeholder="0x…"
              value={r.rawAccount}
              onChange={(e) => setRow(r.id, { account: e.target.value })}
              className={cn(
                "h-7 flex-1 text-[11px]",
                r.rawAccount !== "" && !r.validAddr && "border-red-500",
              )}
            />
            <Input
              inputMode="numeric"
              placeholder="shares"
              value={r.rawShares}
              onChange={(e) => setRow(r.id, { shares: e.target.value })}
              className={cn(
                "h-7 w-20 text-[11px] tabular-nums",
                r.rawShares !== "" && !r.validShares && "border-red-500",
              )}
            />
            <span className="w-11 text-right text-[10px] tabular-nums text-muted-foreground">
              {r.validShares && total > 0
                ? `${((r.sharesNum / total) * 100).toFixed(1)}%`
                : "—"}
            </span>
            <button
              type="button"
              disabled={busy || parsed.length === 1}
              onClick={() => removeRow(r.id)}
              aria-label={`Remove payee ${i + 1}`}
              className="shrink-0 text-muted-foreground transition-colors hover:text-red-600 disabled:opacity-40 dark:hover:text-red-500"
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
      </div>

      {hasDuplicate && (
        <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-500">
          The same address appears more than once.
        </p>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={addRow}
        className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
      >
        <Plus className="size-3" />
        Add payee
      </button>

      <div className="mt-2 flex gap-1">
        <button
          type="button"
          disabled={!valid || busy}
          onClick={save}
          className="flex-1 border px-2 py-1 text-[10px] font-medium transition-colors hover:bg-muted disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save split"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setEditing(false)}
          className="border px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
