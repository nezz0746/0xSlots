import Link from "next/link";

import { Wordmark } from "@/components/marketing/mark";
import { Button } from "@/components/ui/button";
import { MARKETING_LINKS } from "@/lib/external-links";

// No nav. The page is a hero and a footer, so there is nowhere on-site to
// send anyone — the two destinations that matter are the hero's own buttons,
// and this one is here because it is the action, not a link.
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/90 backdrop-blur-sm">
      {/* max-w and px both match the hero's content column, so the wordmark
          sits on the same left edge as the headline below it. */}
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-6">
        {/* The marketing home, not the explorer — the "Open explorer" button
            beside this is the way across. */}
        <Link href="/" className="text-foreground">
          <Wordmark />
        </Link>

        <Button asChild size="sm">
          <Link href={MARKETING_LINKS.explorer}>Open explorer</Link>
        </Button>
      </div>
    </header>
  );
}
