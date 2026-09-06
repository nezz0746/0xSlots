import type { Metadata } from "next";
import { Archivo, Fraunces } from "next/font/google";

import { Header } from "@/components/header";
import { Providers } from "@/components/providers";
import { WalletOverlay } from "@/components/wallet-overlay";
import "./globals.css";

// One grotesque doing the whole interface, from the 11px figures to the
// masthead — the width axis is what lets the two ends look like different
// typefaces without being any.
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
});

// Names of things. Its optical-size axis is why a collection title at 40px and
// the same title at 14px in a list both read as the same voice.
const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["opsz", "WONK"],
  variable: "--font-fraunces",
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
    <html lang="en" className={`${archivo.variable} ${fraunces.variable}`}>
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
