import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

import "./globals.css";
import { APP_URL } from "@/constants";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
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
    <html lang="en">
      <body
        className={`${inter.variable} ${jetbrains.variable} font-sans bg-background text-foreground`}
      >
        {children}
      </body>
    </html>
  );
}
