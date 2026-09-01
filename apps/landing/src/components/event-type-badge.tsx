import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Ban,
  CircleDollarSign,
  Flame,
  Gavel,
  HandCoins,
  KeyRound,
  Plug,
  Receipt,
  Rocket,
  Scale,
  ShoppingCart,
  Tag,
  TriangleAlert,
  Undo2,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import type { EventType } from "@/types";

/**
 * One tint and one glyph per event kind.
 *
 * Colours are grouped by what the event DOES rather than picked freshly: money
 * arriving is green-ish, money leaving is warm, governance is indigo/cyan, and
 * anything that means something went wrong is red. `Hook Failed` is the loudest
 * on purpose — it is the only row in the feed that reports a bug.
 */
const EVENT_TYPES: Record<EventType, { color: string; icon: ReactNode }> = {
  Deploy: {
    color: "bg-sky-500/10 text-sky-600",
    icon: <Rocket className="size-3" />,
  },
  Buy: {
    color: "bg-green-500/10 text-green-600",
    icon: <ShoppingCart className="size-3" />,
  },
  // The seller's half of a negotiated hand-over. Same family as Buy, because
  // the two are always the same transition seen from two sides.
  Sell: {
    color: "bg-teal-500/10 text-teal-600",
    icon: <HandCoins className="size-3" />,
  },
  Release: {
    color: "bg-yellow-500/10 text-yellow-600",
    icon: <ArrowUpFromLine className="size-3" />,
  },
  Liquidate: {
    color: "bg-red-500/10 text-red-600",
    icon: <Flame className="size-3" />,
  },
  Price: {
    color: "bg-blue-500/10 text-blue-600",
    icon: <Tag className="size-3" />,
  },
  Deposit: {
    color: "bg-emerald-500/10 text-emerald-600",
    icon: <ArrowDownToLine className="size-3" />,
  },
  Withdraw: {
    color: "bg-orange-500/10 text-orange-600",
    icon: <CircleDollarSign className="size-3" />,
  },
  Settle: {
    color: "bg-slate-500/10 text-slate-600",
    icon: <Scale className="size-3" />,
  },
  Collect: {
    color: "bg-purple-500/10 text-purple-600",
    icon: <HandCoins className="size-3" />,
  },
  // A payout that could not be pushed. Amber rather than green: the money
  // exists and did NOT arrive.
  Credit: {
    color: "bg-amber-500/10 text-amber-600",
    icon: <Wallet className="size-3" />,
  },
  Claim: {
    color: "bg-lime-500/10 text-lime-600",
    icon: <Receipt className="size-3" />,
  },
  Operator: {
    color: "bg-violet-500/10 text-violet-600",
    icon: <KeyRound className="size-3" />,
  },
  "Tax Proposed": {
    color: "bg-indigo-500/10 text-indigo-600",
    icon: <Gavel className="size-3" />,
  },
  // Was "Module Proposed". Same slot in the feed, different protocol concept:
  // one hook address, not a gallery of modules.
  "Hook Proposed": {
    color: "bg-cyan-500/10 text-cyan-600",
    icon: <Plug className="size-3" />,
  },
  "Terms Applied": {
    color: "bg-indigo-500/10 text-indigo-600",
    icon: <Gavel className="size-3" />,
  },
  "Update Cancelled": {
    color: "bg-gray-500/10 text-gray-600",
    icon: <Ban className="size-3" />,
  },
  "Order Cancelled": {
    color: "bg-gray-500/10 text-gray-600",
    icon: <Undo2 className="size-3" />,
  },
  "Hook Failed": {
    color: "bg-red-500/15 text-red-700 dark:text-red-400",
    icon: <TriangleAlert className="size-3" />,
  },
};

export function EventTypeBadge({ type }: { type: string }) {
  const style = EVENT_TYPES[type as EventType];
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap ${style?.color ?? "bg-muted text-muted-foreground"}`}
    >
      {style?.icon}
      {type}
    </span>
  );
}
