"use client";

import {
  ArrowDownToLine,
  ChartLine,
  LandPlot,
  List,
  Percent,
  Tag,
  User,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { zeroAddress } from "viem";

import { EventTypeBadge } from "@/components/event-type-badge";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { truncateAddress } from "@/utils";

// ── Mock Data ──────────────────────────────────────────────

const MOCK = {
  recipient: {
    address: "0x1a2B3c4D5e6F7890abCdEf1234567890ABcDeF12",
    type: "SPLIT" as const,
    splits: [
      { address: "0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa", percent: 60 },
      { address: "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB", percent: 25 },
      { address: "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC", percent: 15 },
    ],
  },
  slot: {
    price: "1.5",
    taxRate: "4",
    currency: "WETH",
  },
  occupant: {
    address: "0x5678EF0123456789AbCdEf0123456789aBcDEf01",
    deposit: "0.5",
    taxPerWeek: "0.0138",
    netBalance: "0.48",
    insolvent: false,
  },
  history: [
    {
      address: "0xDDdddDDDdDdDDDddddDDDddDddDDddDDDDdDDdd",
      price: "1.2",
      exitType: "Buy" as const,
      time: "2d ago",
    },
    {
      address: "0xEEeEEEeeEeEeEEeEEeEeeeEeeEeEeEeEEeEeEeE",
      price: "0.8",
      exitType: "Liquidate" as const,
      time: "1w ago",
    },
    {
      address: "0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF",
      price: "0.5",
      exitType: "Release" as const,
      time: "2w ago",
    },
    {
      address: zeroAddress,
      price: "0.3",
      exitType: "Buy" as const,
      time: "1mo ago",
    },
    {
      address: "0x1111111111111111111111111111111111111111",
      price: "0.1",
      exitType: "Liquidate" as const,
      time: "2mo ago",
    },
  ],
  priceHistory: [
    { time: "Mar 1", price: 0.1 },
    { time: "Mar 5", price: 0.3 },
    { time: "Mar 8", price: 0.5 },
    { time: "Mar 12", price: 0.5 },
    { time: "Mar 15", price: 0.8 },
    { time: "Mar 18", price: 0.6 },
    { time: "Mar 22", price: 1.2 },
    { time: "Mar 25", price: 1.0 },
    { time: "Mar 28", price: 1.5 },
  ],
};

// ── Animated dotted line (CSS only) ────────────────────────

function FlowLine() {
  return (
    <div className="flex flex-col justify-center items-center gap-1">
      <div
        className="mx-auto h-20 w-4"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, #22c55e 0px 5px, transparent 5px 12px)",
          backgroundSize: "4px 12px",
          animation: "flow-up 0.8s linear infinite",
        }}
      />
      <div className="rounded-sm px-4 py-2 absolute backdrop-blur border">
        <p className="text-xs text-green-600 font-medium">
          0.06 {MOCK.slot.currency}/mo
        </p>
      </div>
    </div>
  );
}

// ── Demo Page ──────────────────────────────────────────────

export default function DemoPage() {
  const [bottomTab, setBottomTab] = useState<"history" | "chart">("history");

  return (
    <>
      <style>{`
        @keyframes flow-up {
          to { background-position: 0 -12px; }
        }
      `}</style>

      <div className="flex justify-center p-8">
        <div className="flex w-full max-w-sm flex-col gap-0">
          {/* ── Recipient Card ── */}
          <div className="rounded-lg border p-4">
            <div className="flex flex-row items-center gap-2">
              <User className="size-4" />
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Recipient
              </p>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-sm font-mono font-medium">
                {truncateAddress(MOCK.recipient.address)}
              </span>
              <Badge variant="outline" className="text-[10px] ml-auto">
                {MOCK.recipient.type}
              </Badge>
            </div>

            {/* Split bar — greyscale */}
            <div className="mt-3 space-y-1.5">
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                {MOCK.recipient.splits.map((s, i) => (
                  <div
                    key={s.address}
                    className="transition-all first:rounded-l-full last:rounded-r-full"
                    style={{
                      width: `${s.percent}%`,
                      backgroundColor: `hsl(0 0% ${30 + i * 18}%)`,
                    }}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                {MOCK.recipient.splits.map((s, i) => (
                  <span
                    key={s.address}
                    className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
                  >
                    <span
                      className="inline-block size-1.5 rounded-full"
                      style={{ backgroundColor: `hsl(0 0% ${30 + i * 18}%)` }}
                    />
                    {truncateAddress(s.address)}{" "}
                    <span className="font-medium text-foreground">
                      {s.percent}%
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* ── Flow line with annotation ── */}
          <FlowLine />

          {/* ── Slot Card ── */}
          <div className="rounded-lg border p-4">
            <div className="flex flex-row items-center gap-2">
              <LandPlot className="w-4 h-4" />
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Slot
              </p>
            </div>
            <div className="mt-2 flex items-stretch gap-0 rounded-md border overflow-hidden">
              {/* Price (base) */}
              <div className="flex-1 px-3 py-2">
                <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Tag className="size-3" />
                  Self-assessed Price
                </p>
                <p className="text-sm font-bold">
                  {MOCK.slot.price} {MOCK.slot.currency}
                </p>
              </div>
              {/* Tax share — green to match the flow */}
              <div className="border-l bg-green-500/8 px-3 py-2 flex flex-col items-end justify-center">
                <p className="flex items-center gap-1 text-[10px] text-green-600">
                  <Percent className="size-3" />
                  Tax
                </p>
                <p className="text-sm font-bold text-green-600">
                  {MOCK.slot.taxRate}%
                  <span className="text-[10px] font-normal text-green-500">
                    {" "}
                    / mo
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* ── Occupant card — "a cheval", overlapping bottom of slot card ── */}
          <div className="mx-3 -mt-3 relative z-10 rounded-lg border bg-background p-3">
            {/* Current occupant */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="size-4" />
                <span className="text-xs font-mono font-medium">
                  {truncateAddress(MOCK.occupant.address)}
                </span>
              </div>
              <Badge
                variant={MOCK.occupant.insolvent ? "destructive" : "secondary"}
                className="text-[10px]"
              >
                {MOCK.occupant.insolvent ? "INSOLVENT" : "OCCUPIED"}
              </Badge>
            </div>
            <div className="mt-2 flex items-center justify-between text-center">
              <MiniStat
                icon={ArrowDownToLine}
                label="Deposit"
                value={`${MOCK.occupant.deposit}`}
              />
              <MiniStat
                icon={Percent}
                label="Tax / wk"
                value={`${MOCK.occupant.taxPerWeek}`}
                className="text-green-600"
              />
              <MiniStat
                icon={Wallet}
                label="Net"
                value={`${MOCK.occupant.netBalance}`}
              />
            </div>

            {/* Bottom tabs: History / Price — full width */}
            <div className="mt-3 border-t pt-3">
              <div className="grid grid-cols-2 gap-0 rounded-md border p-0.5">
                <button
                  onClick={() => setBottomTab("history")}
                  className={cn(
                    "rounded py-1.5 text-[10px] font-medium transition-colors flex items-center justify-center gap-1",
                    bottomTab === "history"
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <List className="size-3" />
                  History
                </button>
                <button
                  onClick={() => setBottomTab("chart")}
                  className={cn(
                    "rounded py-1.5 text-[10px] font-medium transition-colors flex items-center justify-center gap-1",
                    bottomTab === "chart"
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <ChartLine className="size-3" />
                  Price
                </button>
              </div>

              <div className="mt-2">
                {bottomTab === "history" ? (
                  <div className="space-y-0">
                    {MOCK.history.map((h) => (
                      <div
                        key={h.address}
                        className="flex items-center gap-2 border-t py-1.5 first:border-t-0 first:pt-0"
                      >
                        <EventTypeBadge type={h.exitType} />
                        <span className="text-[11px] font-mono">
                          {truncateAddress(h.address)}
                        </span>
                        <span className="ml-auto text-[10px] text-muted-foreground">
                          {h.time}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <PriceChart
                    data={MOCK.priceHistory}
                    currency={MOCK.slot.currency}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── SVG Price Chart ─────────────────────────────────────────

function PriceChart({
  data,
  currency,
}: {
  data: { time: string; price: number }[];
  currency: string;
}) {
  const W = 280;
  const H = 100;
  const PAD = { top: 8, right: 8, bottom: 20, left: 8 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const prices = data.map((d) => d.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const points = data.map((d, i) => ({
    x: PAD.left + (i / (data.length - 1)) * chartW,
    y: PAD.top + chartH - ((d.price - min) / range) * chartH,
  }));

  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x},${p.y}`)
    .join(" ");
  const area = `${line} L ${points[points.length - 1].x},${PAD.top + chartH} L ${points[0].x},${PAD.top + chartH} Z`;

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        preserveAspectRatio="none"
      >
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = PAD.top + chartH * (1 - t);
          return (
            <line
              key={t}
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y}
              y2={y}
              stroke="currentColor"
              strokeOpacity={0.07}
            />
          );
        })}
        {/* Fill */}
        <path d={area} fill="currentColor" fillOpacity={0.04} />
        {/* Line */}
        <path
          d={line}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Dots */}
        {points.map((p, i) => (
          <circle
            key={data[i].time}
            cx={p.x}
            cy={p.y}
            r={2}
            fill="currentColor"
          />
        ))}
        {/* X-axis labels */}
        {data.map((d, i) => {
          if (i % 2 !== 0 && i !== data.length - 1) return null;
          return (
            <text
              key={d.time}
              x={points[i].x}
              y={H - 4}
              textAnchor="middle"
              className="fill-muted-foreground"
              fontSize={8}
            >
              {d.time}
            </text>
          );
        })}
      </svg>
      {/* Current price label */}
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] text-muted-foreground">
          Assessed price over time
        </span>
        <span className="text-[10px] font-semibold">
          {prices[prices.length - 1]} {currency}
        </span>
      </div>
    </div>
  );
}

// ── Small helper components ────────────────────────────────

function MiniStat({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="text-center">
      <p className="flex items-center justify-center gap-0.5 text-[10px] text-muted-foreground">
        <Icon className="size-3" />
        {label}
      </p>
      <p className={cn("text-xs font-bold", className)}>{value}</p>
    </div>
  );
}
