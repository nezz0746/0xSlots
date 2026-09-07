import type { Metadata } from "next";
import { Inter_Tight } from "next/font/google";

import { Header } from "@/components/header";
import { Providers } from "@/components/providers";
import { WalletOverlay } from "@/components/wallet-overlay";
import "./globals.css";

// One family for the whole interface, from the 10px labels to the masthead.
// Tight by construction rather than by tracking, which is what keeps a 48px
// headline and an 11px figure looking like the same voice at both ends.
//
// A second, warmer display face used to name collections and works. It went
// when the ground did: against a cool near-white the contrast read as two
// designs rather than one, and the plates already supply all the personality
// this page needs. Weight and size carry the hierarchy now.
const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-inter-tight",
});

export const metadata: Metadata = {
  title: "Slotmarket",
  description:
    "Art that is never off the market. Every work is held at a price its holder set, and anyone may take it there.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Font variables belong on <html>: Tailwind's @theme emits --font-sans into
    // :root, and a source variable one level down resolves to nothing.
    <html lang="en" className={interTight.variable}>
      <body className="font-sans">
        <Providers>
          <Header />
          <main>{children}</main>
          {/* One wallet surface for the whole app, in the middle of it. */}
          <WalletOverlay />
        </Providers>
      </body>
    </html>
  );
}
