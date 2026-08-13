import type { Metadata } from "next";

import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "0xSlots",
    url: "/",
    title: "0xSlots — Making collective ownership easy to use",
    description:
      "Name your price and pay a small tax on it. Anyone can buy it at that price, any time. Collectives let a group share the income and govern together.",
  },
  twitter: {
    card: "summary_large_image",
    title: "0xSlots — Making collective ownership easy to use",
    description:
      "Name your price and pay a small tax on it. Anyone can buy it at that price, any time. Collectives let a group share the income and govern together.",
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // One screen, three bands: header and footer take their natural height and
  // `main` absorbs the rest. The hero used to claim `100svh - header` outright,
  // which pushed the footer exactly its own height below the fold. Letting the
  // hero flex into what remains keeps the page to one screen without anyone
  // hardcoding the footer's height — it wraps taller on mobile, so a fixed
  // subtraction would only be right at one breakpoint.
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="flex flex-1 flex-col">{children}</main>
      <SiteFooter />
    </div>
  );
}
