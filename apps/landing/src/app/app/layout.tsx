import type { Metadata } from "next";
import { Toaster } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Providers } from "@/components/providers";
import { APP_URL } from "@/constants";

export const metadata: Metadata = {
  title: "0xSlots — Immutable & Modular Collective Ownership Slots",
  description:
    "Immutable & modular collective ownership slots on Ethereum. Perpetual onchain real estate powered by partial common ownership. Any ERC-20.",
  other: {
    "fc:miniapp": JSON.stringify({
      version: "1",
      imageUrl: `${APP_URL}/api/og`,
      button: {
        title: "Open 0xSlots",
        action: {
          type: "launch_miniapp",
          name: "0xSlots",
          // The explorer lives under /app now — the miniapp must open there,
          // not on the marketing page.
          url: `${APP_URL}/app`,
          splashImageUrl: `${APP_URL}/logo.png`,
          splashBackgroundColor: "#ffffff",
        },
      },
    }),
  },
};

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <Toaster position="bottom-right" richColors />
      <AppShell>{children}</AppShell>
    </Providers>
  );
}
