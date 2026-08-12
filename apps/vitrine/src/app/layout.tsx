import type { Metadata, Viewport } from "next";
import { Archivo, JetBrains_Mono, Public_Sans } from "next/font/google";
import { title as siteTitle, siteUrl, tagline } from "@/lib/site";
import "@/app/globals.css";

// Archivo carries a width axis, and the `display` utility drives it to
// wdth 118 — without declaring the axis here the face falls back to a
// normal width and the display type loses its signage weight.
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  weight: "variable",
  variable: "--font-archivo",
  display: "swap",
});

const publicSans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-public-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#E9E9E4",
};

export const metadata: Metadata = {
  // Lets every page declare relative canonical/OG urls and have Next
  // resolve them against the live origin.
  metadataBase: new URL(siteUrl),
  title: {
    default: `${siteTitle} — ${tagline}`,
    // Articles set a bare title; the brand is appended exactly once here.
    template: `%s — ${siteTitle}`,
  },
  description:
    "Name your price and pay a small tax on it. Anyone can buy it from you at that price, any time — so nothing sits idle and everything stays honestly valued. Collectives let a group share what those assets earn and govern them together. On Base, in any ERC-20.",
  alternates: { canonical: "/" },
  icons: { icon: "/mark.svg" },
  openGraph: {
    type: "website",
    siteName: siteTitle,
    url: "/",
    title: `${siteTitle} — ${tagline}`,
    description:
      "Name your price and pay a small tax on it. Anyone can buy it at that price, any time. Collectives let a group share the income and govern together.",
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteTitle} — ${tagline}`,
    description:
      "Name your price and pay a small tax on it. Anyone can buy it at that price, any time. Collectives let a group share the income and govern together.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${archivo.variable} ${publicSans.variable} ${jetbrainsMono.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
