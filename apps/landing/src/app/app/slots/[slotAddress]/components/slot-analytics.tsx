"use client";

import { Eye, Globe, Loader2, MousePointerClick } from "lucide-react";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  useSlotAnalytics,
  useSlotDomainAnalytics,
} from "../hooks/use-slot-analytics";

type Period = "24h" | "7d" | "30d";

const periods: { value: Period; label: string }[] = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
];

const chartConfig = {
  views: {
    label: "Views",
    color: "oklch(0.62 0.19 259)",
  },
  clicks: {
    label: "Clicks",
    color: "oklch(0.65 0.17 162)",
  },
} satisfies ChartConfig;

export function SlotAnalytics({ slotAddress }: { slotAddress: string }) {
  const [period, setPeriod] = useState<Period>("30d");
  const { data, isLoading, isError } = useSlotAnalytics(slotAddress, period);
  const { data: domainData } = useSlotDomainAnalytics(slotAddress, period);

  if (isError) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Eye className="size-3 text-blue-500" />
            <span className="text-xs text-muted-foreground">
              {data?.totals.views.toLocaleString() ?? "-"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <MousePointerClick className="size-3 text-emerald-500" />
            <span className="text-xs text-muted-foreground">
              {data?.totals.clicks.toLocaleString() ?? "-"}
            </span>
          </div>
          {data && data.totals.views > 0 && (
            <span className="text-[10px] text-muted-foreground">
              {((data.totals.clicks / data.totals.views) * 100).toFixed(1)}% CTR
            </span>
          )}
        </div>
        <div className="flex gap-0.5 rounded-md border p-0.5">
          {periods.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                period === p.value
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : data ? (
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-35 w-full"
        >
          <BarChart
            data={data.series}
            barCategoryGap="20%"
            barGap={-20}
            margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={6}
              tickFormatter={(value: string) => {
                const d = new Date(`${value}T00:00:00`);
                return d.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                });
              }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    const d = new Date(`${String(value)}T00:00:00`);
                    return d.toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    });
                  }}
                />
              }
            />
            <Bar
              dataKey="views"
              fill="var(--color-views)"
              opacity={0.35}
              barSize={20}
              radius={[3, 3, 0, 0]}
            />
            <Bar
              dataKey="clicks"
              fill="var(--color-clicks)"
              barSize={20}
              radius={[3, 3, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      ) : null}

      {/* Domain breakdown */}
      {domainData && domainData.domains.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Globe className="size-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              By domain
            </span>
          </div>
          <div className="rounded-md border text-xs">
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-2.5 py-1.5 border-b bg-muted/30 text-[10px] text-muted-foreground font-medium">
              <span>Domain</span>
              <span className="text-right">Views</span>
              <span className="text-right">Clicks</span>
            </div>
            {domainData.domains.map((d) => (
              <div
                key={d.domain}
                className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-2.5 py-1.5 border-b last:border-b-0"
              >
                <span className="truncate">{d.domain}</span>
                <span className="text-right tabular-nums text-muted-foreground">
                  {d.views.toLocaleString()}
                </span>
                <span className="text-right tabular-nums text-muted-foreground">
                  {d.clicks.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
