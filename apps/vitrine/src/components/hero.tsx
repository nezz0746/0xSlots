import { ParcelField } from "@/components/parcel-field";
import { ButtonLink } from "@/components/ui/button";
import { links } from "@/lib/links";

/**
 * One entry per rendered line.
 *
 * Each must fit on a single line at the clamp below. A wrapped entry is not
 * just a layout risk — every entry gets its own animation delay, so one that
 * spans two lines makes those two rise together while the rest arrive
 * separately, and the stagger stops reading as a stagger.
 *
 * This headline is much longer than the one it replaced, so the clamp is
 * smaller and the column wider to keep four honest lines.
 */
const HEADLINE = ["Making", "collective", "ownership", "easy to use"];

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <ParcelField className="absolute inset-0 h-full w-full" />

      {/* One column since the instrument came out. The page is only this, so it
          holds the screen: one viewport minus the sticky header, contents
          centred inside it. */}
      <div className="relative mx-auto grid min-h-[calc(100svh-3.5rem)] max-w-4xl content-center gap-14 px-4 py-16 md:px-6 md:py-20">
        <div>
          <p
            className="eyebrow animate-raise"
            style={{ animationDelay: "40ms" }}
          >
            Partial common ownership · Base
          </p>

          <h1 className="mt-5 display text-[clamp(2.1rem,6vw,4rem)]">
            {HEADLINE.map((line, i) => (
              <span
                key={line}
                className="block animate-raise"
                style={{ animationDelay: `${120 + i * 90}ms` }}
              >
                {line}
              </span>
            ))}
          </h1>

          {/* Plain language, no jargon and no mechanism the reader has to work
              out for themselves. The interactive instrument that used to sit
              beside this explained the tax by making you operate it; without it
              the words have to carry the idea on their own. */}
          <p
            className="mt-7 max-w-xl animate-raise text-lg leading-relaxed text-ink/80"
            style={{ animationDelay: "420ms" }}
          >
            Name your price and pay a small tax on it. Anyone can buy it from
            you at that price, any time — so nothing sits idle and everything
            stays honestly valued.
          </p>

          <p
            className="mt-4 max-w-xl animate-raise text-lg leading-relaxed text-ink/80"
            style={{ animationDelay: "480ms" }}
          >
            Collectives let a group share what those assets earn and govern them
            together.
          </p>

          <div
            className="mt-9 flex animate-raise flex-wrap gap-3"
            style={{ animationDelay: "560ms" }}
          >
            <ButtonLink
              href={links.explorer}
              target="_blank"
              rel="noreferrer"
              size="lg"
            >
              Open explorer
            </ButtonLink>
            <ButtonLink
              href={links.docs}
              target="_blank"
              rel="noreferrer"
              size="lg"
              variant="outline"
            >
              Read the docs
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
