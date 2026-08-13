"use client";

import { useSplitMetadata } from "@0xsplits/splits-sdk-react";
import { Loader2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { splitsSupported } from "@/lib/splits-support";
import { truncateAddress } from "@/utils";

const COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-purple-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-orange-500",
  "bg-indigo-500",
];

export { COLORS as SPLIT_COLORS };

// ─── Pure presentational bar ─────────────────────────────────────────────────

export interface SplitBarRecipient {
  address: string;
  percent: number;
}

/** Renders a segmented progress bar + legend from static data. */
export function SplitBar({ recipients }: { recipients: SplitBarRecipient[] }) {
  if (!recipients.length) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
        {recipients.map((r, i) => (
          <Tooltip key={`${r.address}-${i}`}>
            <TooltipTrigger asChild>
              <div
                className={`${COLORS[i % COLORS.length]} transition-all first:rounded-l-full last:rounded-r-full`}
                style={{ width: `${r.percent}%` }}
              />
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {r.address ? truncateAddress(r.address) : `#${i + 1}`} —{" "}
              {r.percent}%
            </TooltipContent>
          </Tooltip>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {recipients.map((r, i) => (
          <span
            key={`${r.address}-${i}`}
            className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
          >
            <span
              className={`inline-block size-1.5 rounded-full ${COLORS[i % COLORS.length]}`}
            />
            {r.address ? truncateAddress(r.address) : `Recipient ${i + 1}`}{" "}
            <span className="font-medium text-foreground">{r.percent}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Fetching wrapper (for on-chain splits) ──────────────────────────────────

export function SplitRecipientsBar({
  chainId,
  splitAddress,
}: {
  chainId: number;
  splitAddress: string;
}) {
  // Same reason as SplitsClientSync: the hook throws rather than returning
  // empty on a chain splits does not know.
  if (!splitsSupported(chainId)) return null;
  return <Bar chainId={chainId} splitAddress={splitAddress} />;
}

function Bar({
  chainId,
  splitAddress,
}: {
  chainId: number;
  splitAddress: string;
}) {
  const { data: splitMetadata, isLoading } = useSplitMetadata(
    chainId,
    splitAddress,
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        <span className="text-[10px]">Loading split...</span>
      </div>
    );
  }

  if (!splitMetadata?.recipients?.length) return null;

  return (
    <SplitBar
      recipients={splitMetadata.recipients.map((r) => ({
        address: r.recipient.address,
        percent: r.percentAllocation,
      }))}
    />
  );
}
