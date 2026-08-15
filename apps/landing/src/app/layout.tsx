import type { Metadata } from "next";
import { JetBrains_Mono, Urbanist } from "next/font/google";

import "./globals.css";
import { APP_URL } from "@/constants";

// Urbanist is a variable font, so the whole weight axis arrives in one file —
// the headline 800s and the 10px muted labels this app leans on cost nothing
// extra. `--font-sans` in globals.css points here.
const urbanist = Urbanist({ subsets: ["latin"], variable: "--font-urbanist" });

// `--font-jetbrains`, NOT `--font-mono`. The theme layer defines
// `--font-mono: var(--font-jetbrains), …`; naming the source the same as the
// target is a cycle, which CSS resolves by throwing the property away.
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  // Lets every page declare relative canonical/OG urls and have Next resolve
  // them against the live origin.
  metadataBase: new URL(APP_URL),
  title: {
    default: "0xSlots — Making collective ownership easy to use",
    // Articles set a bare title; the brand is appended exactly once here.
    template: "%s — 0xSlots",
  },
  description:
    "Name your price and pay a small tax on it. Anyone can buy it from you at that price, any time — so nothing sits idle and everything stays honestly valued. Collectives let a group share what those assets earn and govern them together. On Base, in any ERC-20.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Font variables belong on <html>, not <body>. Tailwind's `@theme` emits
    // `--font-sans: var(--font-urbanist), …` into `:root` — which IS <html> —
    // so with the source variable one level down the reference resolves to
    // nothing, `--font-sans` is invalid at computed-value time, and every
    // `font-sans` element silently falls back to the system stack. That is what
    // was happening: the app never rendered in its own typeface.
    <html lang="en" className={`${urbanist.variable} ${jetbrains.variable}`}>
      <body className="font-sans bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
