import Image from "next/image";
import { Button } from "@/components/ui/button";
import { NavLink } from "@/context/navigation";

export default function DocsPage() {
  return (
    <>
      {/* Hero */}
      <section className="px-6 pt-16 pb-12 lg:pt-24 lg:pb-20 min-h-[85vh] flex flex-col justify-center items-start max-w-3xl mx-auto">
        <div className="flex flex-row md:gap-4 items-center gap-2">
          <div className="aspect-square h-24 w-24">
            <Image
              src={"/logo.png"}
              alt="0xslots logo"
              width={200}
              height={200}
            />
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[0.95] tracking-tight">
            0xSlots
            <span className="block mt-2 text-xl lg:text-2xl font-bold normal-case tracking-normal leading-tight">
              Modular & Immutable collective ownership slot.
            </span>
          </h1>
        </div>

        <p className="mt-8 text-base leading-relaxed max-w-lg text-muted-foreground">
          Perpetual onchain real estate powered by partial common ownership. No
          permanent monopolies. No idle assets. Only recurring market selection.
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <Button variant="outline" asChild>
            <NavLink href="/app">Explore</NavLink>
          </Button>
        </div>
      </section>
    </>
  );
}
