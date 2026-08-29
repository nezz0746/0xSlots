import Link from "next/link";

import { Wordmark } from "@/components/marketing/mark";
import { Button } from "@/components/ui/button";
import { MARKETING_LINKS } from "@/lib/external-links";

// Almost no nav. The home page is a hero and a footer, and the action that
// matters is "Open explorer". The one on-site page worth a link is the public
// leaderboard, so it sits as a quiet text link beside the button — not a second
// button competing with the primary action.
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

        <div className="flex items-center gap-4">
          <Link
            href="/leaderboard"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Leaderboard
          </Link>
          <Button asChild size="sm">
            <Link href={MARKETING_LINKS.explorer}>Open explorer</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
