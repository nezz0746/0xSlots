import Link from "next/link";

import { Wordmark } from "@/components/marketing/mark";
import { MARKETING_LINKS } from "@/lib/external-links";
import { studio } from "@/lib/site";

// The explorer is on-site now, so it is a Link; the rest still leave and keep
// the ↗ the site uses for that. /blog is deliberately absent — the route still
// builds and still sits in the sitemap, it just is not sold.
const destinations = [
  { label: "Docs", href: MARKETING_LINKS.docs },
  { label: "Source", href: MARKETING_LINKS.github },
  { label: "Telegram", href: MARKETING_LINKS.telegram },
];

export function SiteFooter() {
  return (
    <footer className="border-t-2 border-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 md:flex-row md:items-center md:justify-between md:px-6">
        <Wordmark />

        <nav className="flex flex-wrap items-center gap-x-7 gap-y-3">
          <Link
            href={MARKETING_LINKS.explorer}
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-foreground transition-colors hover:text-destructive"
          >
            Explorer
          </Link>
          {destinations.map((item) => (
            <a
              key={item.label}
              href={item.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.14em] text-foreground transition-colors hover:text-destructive"
            >
              {item.label}
              <span
                aria-hidden="true"
                className="text-[9px] leading-none text-muted-foreground"
              >
                ↗
              </span>
            </a>
          ))}
        </nav>

        {/* The studio that builds this — same credit, less furniture. */}
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Made by{" "}
          <a
            href={studio.url}
            target="_blank"
            rel="noreferrer"
            className="text-foreground transition-colors hover:text-destructive"
          >
            {studio.name}
          </a>
        </p>
      </div>
    </footer>
  );
}
