"use client";

import { alchemyRpcUrl } from "@0xslots/config/transports";
import {
  Ad,
  AdBadge,
  AdEmpty,
  AdImage,
  AdLoaded,
  AdLoading,
  AdTitle,
} from "@adland/react";
import { adlandSupported } from "@/lib/adland-chains";
import Autoplay from "embla-carousel-autoplay";
import { useCallback, useEffect, useState } from "react";
import { EnsAddress } from "@/components/ens-address";
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { AD_SLOTS, APP_URL, alchemyKey } from "@/constants";
import { useChain } from "@/context/chain";
import { useFarcaster } from "@/context/farcaster";
import { useSlotOnChain } from "@/hooks/use-slot-onchain";
import { truncateAddress } from "@/utils";

function AdCard({
  slot,
  chainId,
  rpcUrl,
}: {
  slot: string;
  chainId: number;
  rpcUrl?: string;
}) {
  const { isMiniApp } = useFarcaster();
  const { data: slotData } = useSlotOnChain(slot, chainId);

  // See lib/adland-chains — <Ad slot=...> throws on an unknown chain.
  if (!adlandSupported(chainId)) return null;

  return (
    <Ad
      slot={slot}
      chainId={chainId}
      rpcUrl={rpcUrl}
      // <Ad> appends /slots/{slot} to this. The explorer moved under /app, so
      // the base has to carry it or every ad CTA 404s — nothing type-checks
      // this, so it fails silently.
      baseLinkUrl={`${APP_URL}/app`}
      auth={isMiniApp ? "farcaster" : "none"}
      className="flex items-center gap-3 rounded-lg border bg-card p-2 cursor-pointer hover:bg-accent/50 transition-colors h-16 md:h-18"
    >
      <AdLoaded className="flex items-center gap-3 w-full">
        <AdImage className="size-12 md:size-14 rounded-md object-cover shrink-0" />
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <AdTitle className="text-sm md:text-base font-medium truncate" />
          <div className="flex items-center gap-1.5">
            <AdBadge className="flex items-center gap-1 text-[10px] text-muted-foreground" />
            {slotData?.occupant && (
              <span className="text-[10px] text-muted-foreground">
                · ad by <EnsAddress address={slotData.occupant} />
              </span>
            )}
          </div>
        </div>
      </AdLoaded>
      <AdEmpty className="flex flex-col items-center justify-center w-full gap-0.5">
        <span className="text-sm text-muted-foreground">Your ad here</span>
        <span className="text-[10px] text-muted-foreground/60">
          {truncateAddress(slot)}
        </span>
      </AdEmpty>
      <AdLoading className="flex items-center gap-3 w-full animate-pulse">
        <div className="size-12 rounded-md bg-muted shrink-0" />
        <div className="flex flex-col gap-1.5">
          <div className="h-4 w-24 rounded bg-muted" />
          <div className="h-3 w-16 rounded bg-muted" />
        </div>
      </AdLoading>
    </Ad>
  );
}

function AdCarousel({
  slots,
  chainId,
  rpcUrl,
}: {
  slots: string[];
  chainId: number;
  rpcUrl?: string;
}) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  const onSelect = useCallback(() => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap());
  }, [api]);

  useEffect(() => {
    if (!api) return;
    onSelect();
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api, onSelect]);

  return (
    <div className="space-y-1.5">
      <Carousel
        opts={{ loop: true }}
        plugins={[Autoplay({ delay: 6000, stopOnInteraction: false })]}
        setApi={setApi}
      >
        <CarouselContent>
          {slots.map((slot) => (
            <CarouselItem key={slot}>
              <AdCard slot={slot} chainId={chainId} rpcUrl={rpcUrl} />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
      <div className="flex justify-center gap-1">
        {slots.map((slot, i) => (
          <button
            key={slot}
            type="button"
            className={`h-0.5 rounded-full transition-colors ${
              i === current
                ? "w-4 bg-foreground"
                : "w-2.5 bg-muted-foreground/30"
            }`}
            onClick={() => api?.scrollTo(i)}
          />
        ))}
      </div>
    </div>
  );
}

export function AdBar() {
  const { chainId } = useChain();
  const slots = AD_SLOTS[chainId];
  const rpcUrl = alchemyKey ? alchemyRpcUrl(chainId, alchemyKey) : undefined;

  if (!slots?.length) return null;

  return (
    <div className="">
      {/* Mobile: carousel */}
      <div className="md:hidden">
        <AdCarousel slots={slots} chainId={chainId} rpcUrl={rpcUrl} />
      </div>

      {/* Desktop: flex row */}
      <div className="hidden md:grid md:grid-cols-3 gap-3">
        {slots.map((slot) => (
          <AdCard key={slot} slot={slot} chainId={chainId} rpcUrl={rpcUrl} />
        ))}
      </div>
    </div>
  );
}
