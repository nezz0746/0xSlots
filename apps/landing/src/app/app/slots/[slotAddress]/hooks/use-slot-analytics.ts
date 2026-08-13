"use client";

import { adlandApiUrl } from "@adland/data";
import { useQuery } from "@tanstack/react-query";

type Period = "24h" | "7d" | "30d";

export interface SlotAnalytics {
  slot: string;
  period: Period;
  series: { date: string; views: number; clicks: number }[];
  totals: { views: number; clicks: number };
}

export interface DomainBreakdown {
  domain: string;
  views: number;
  clicks: number;
}

export interface SlotDomainAnalytics {
  slot: string;
  period: Period;
  domains: DomainBreakdown[];
}

export function useSlotAnalytics(slotAddress: string, period: Period = "30d") {
  return useQuery<SlotAnalytics>({
    queryKey: ["slot-analytics", slotAddress, period],
    queryFn: async () => {
      const res = await fetch(
        `${adlandApiUrl}/analytics/slots/${slotAddress}?period=${period}`,
      );
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
    staleTime: 60_000,
    enabled: !!slotAddress,
  });
}

export function useSlotDomainAnalytics(
  slotAddress: string,
  period: Period = "30d",
) {
  return useQuery<SlotDomainAnalytics>({
    queryKey: ["slot-domain-analytics", slotAddress, period],
    queryFn: async () => {
      const res = await fetch(
        `${adlandApiUrl}/analytics/slots/${slotAddress}/domains?period=${period}`,
      );
      if (!res.ok) throw new Error("Failed to fetch domain analytics");
      return res.json();
    },
    staleTime: 60_000,
    enabled: !!slotAddress,
  });
}
