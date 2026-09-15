import { ArrowUpRight } from "lucide-react";
import Image from "next/image";

/**
 * What has been built with slots.
 *
 * Informational and nothing more: no live figures, no reachability check. A
 * number on a marketing page has to be right every time it is looked at, and a
 * status dot that goes red during a deploy says "broken" about a protocol when
 * it means "a container restarted". None of the three send an
 * Access-Control-Allow-Origin header either, so a client-side fetch would have
 * been blocked whatever it was fetching.
 *
 * The marks are each app's own icon, copied in rather than hotlinked: a
 * marketing page should not go blank in one corner because another deployment
 * is mid-restart, and the browser is not asked to reach three more origins.
 * Sources are `adland/apps/web/public/icon.png`, `ens-slots` and `nft-slots`
 * `apps/web/src/app/icon.svg`.
 *
 * The chain is the part a reader needs and cannot infer, and it is not always
 * one — OpenCollections serves Base and Base Sepolia both. The dot answers the
 * only binary question worth asking: is any of this on a mainnet.
 */
const APPS = [
  {
    name: "AdLand",
    domain: "adland.space",
    href: "https://adland.space",
    icon: "/apps/adland.png",
    chains: ["Base"],
    blurb:
      "Sponsored placements on buildings and websites, settled in USDC. One script tag renders whoever holds the slot right now.",
  },
  {
    name: "Nameslots",
    domain: "nameslots.0xslots.org",
    href: "https://nameslots.0xslots.org",
    icon: "/apps/nameslots.svg",
    chains: ["Sepolia"],
    blurb:
      "ENS subnames as slots. Each one is held at a price its holder set, so a name nobody is using does not sit idle.",
  },
  {
    name: "OpenCollections",
    domain: "collections.0xslots.org",
    href: "https://collections.0xslots.org",
    icon: "/apps/collections.svg",
    chains: ["Base", "Base Sepolia"],
    blurb:
      "A marketplace where nothing is ever off the market. Every work is bound to a slot and pays rent on its holder's own valuation.",
  },
] as const;

const MAINNETS = new Set(["Base", "Ethereum"]);

export function TestApps() {
  return (
    <section className="border-t border-border/60">
      <div className="mx-auto w-full max-w-6xl px-4 py-14 md:px-6 md:py-16">
        <p className="eyebrow">Built with slots</p>

        <ul className="mt-8 grid gap-px overflow-hidden rounded-lg border border-border/60 bg-border/60 md:grid-cols-3">
          {APPS.map((app) => {
            const onMainnet = app.chains.some((c) => MAINNETS.has(c));
            return (
              <li key={app.domain} className="bg-background">
                <a
                  href={app.href}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex h-full flex-col gap-3 p-6 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40"
                >
                  <div className="flex items-center gap-3">
                    <Image
                      src={app.icon}
                      alt=""
                      width={32}
                      height={32}
                      className="size-8 shrink-0 rounded-md object-contain"
                    />
                    <span className="font-semibold tracking-tight">
                      {app.name}
                    </span>
                    <ArrowUpRight
                      size={16}
                      aria-hidden
                      className="ml-auto shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                    />
                  </div>

                  <p className="text-sm leading-relaxed text-foreground/70">
                    {app.blurb}
                  </p>

                  {/* Pushed down so the chain line sits on one baseline across
                      all three, whatever length the blurbs run to. */}
                  <div className="mt-auto flex items-center gap-2 pt-2">
                    <span
                      aria-hidden
                      className={`size-1.5 shrink-0 rounded-full ${
                        onMainnet ? "bg-emerald-500" : "bg-amber-500"
                      }`}
                    />
                    <span className="text-xs text-muted-foreground">
                      {app.chains.join(" · ")}
                    </span>
                    <span className="ml-auto truncate font-mono text-[11px] text-muted-foreground/70">
                      {app.domain}
                    </span>
                  </div>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
