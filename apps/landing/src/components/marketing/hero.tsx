import Link from "next/link";

import { ParcelField } from "@/components/marketing/parcel-field";
import { Button } from "@/components/ui/button";
import { MARKETING_LINKS } from "@/lib/external-links";

export function Hero() {
  return (
    <section className="relative flex flex-1 flex-col overflow-hidden">
      <ParcelField className="absolute inset-0 h-full w-full" />

      {/* One column since the instrument came out. The page is only this, so it
          holds the screen — but it takes what the flex column in
          `(marketing)/layout.tsx` leaves it rather than claiming a viewport
          height of its own. Measuring the header here was always going to be
          wrong by its border, and the footer's height is not knowable at all
          across breakpoints.

          `flex-1` grows into the space; min-height still resolves to the
          content, so a viewport too short for the copy scrolls rather than
          clipping it. */}
      <div className="relative mx-auto grid w-full max-w-6xl flex-1 content-center gap-14 px-4 py-10 md:px-6 md:py-16">
        <div>
          <p
            className="eyebrow animate-raise"
            style={{ animationDelay: "40ms" }}
          >
            Partial common ownership · Base
          </p>

          {/* Flat and unanimated: the line wraps wherever the measure puts it
              rather than being broken into fixed lines, so the clamp can do its
              job at any width. */}
          <h1 className="mt-5 display text-[clamp(2.1rem,6vw,3.2rem)] max-w-2xl">
            Making <span className="text-destructive">collective ownership</span>{" "}
            easy to use
          </h1>

          {/* Plain language, no jargon and no mechanism the reader has to work
              out for themselves. The interactive instrument that used to sit
              beside this explained the tax by making you operate it; without it
              the words have to carry the idea on their own. */}
          <p
            className="mt-7 max-w-xl animate-raise text-lg leading-relaxed text-foreground/80"
            style={{ animationDelay: "420ms" }}
          >
            Name your price and pay a small tax on it. Anyone can buy it from
            you at that price, any time — so nothing sits idle and everything
            stays honestly valued.
          </p>

          <p
            className="mt-4 max-w-xl animate-raise text-lg leading-relaxed text-foreground/80"
            style={{ animationDelay: "480ms" }}
          >
            Collectives let a group share what those assets earn and govern them
            together.
          </p>

          <div
            className="mt-9 flex animate-raise flex-wrap gap-3"
            style={{ animationDelay: "560ms" }}
          >
            <Button asChild size="lg">
              <Link href={MARKETING_LINKS.explorer}>Open explorer</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href={MARKETING_LINKS.docs} target="_blank" rel="noreferrer">
                Read the docs
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
