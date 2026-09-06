"use client";

import Link from "next/link";
import { useAccount } from "wagmi";

import { Plate } from "@/components/plate";
import { useCollections } from "@/hooks/use-market";
import { chainName, DEFAULT_CHAIN_ID, factoryFor } from "@/lib/chains";
import { rate } from "@/lib/format";
import type { IndexedCollection } from "@/lib/indexer";

/**
 * The register.
 *
 * Collections as bands rather than cards, because the figure that matters most
 * about one — how much of it is still unminted — is a proportion, and a
 * proportion wants the full width of the page to be read against. The rule
 * under each band IS that figure; the numbers beside it are its caption.
 */
export default function CollectionsPage() {
  const { chainId: connected } = useAccount();
  const chainId = connected ?? DEFAULT_CHAIN_ID;
  const { data, isLoading, error } = useCollections(chainId);
  const deployed = !!factoryFor(chainId);

  return (
    <>
      <section className="mx-auto w-full max-w-6xl px-5 pb-14 pt-16 sm:px-8 sm:pb-20 sm:pt-24">
        <h1 className="expanded max-w-[19ch] text-[2.6rem] font-extrabold leading-[0.95] tracking-[-0.02em] sm:text-6xl">
          Nothing here is off the market.
        </h1>
        <p className="mt-6 max-w-[58ch] text-[16px] leading-relaxed text-dim">
          Every work is held at a price its holder named, and pays rent on that
          number for as long as they keep it. Name a higher one and it is yours.
        </p>
      </section>

      <div className="mx-auto w-full max-w-6xl px-5 pb-28 sm:px-8">
        {!deployed && (
          <Note>
            Slotmarket has not reached {chainName(chainId)}. Switch network, or
            run the protocol locally.
          </Note>
        )}
        {error && <Note>The indexer is unreachable.</Note>}
        {isLoading && <Loading />}
        {data?.length === 0 && deployed && (
          <Note>
            Nothing has opened on {chainName(chainId)} yet.{" "}
            <Link href="/create" className="underline underline-offset-4">
              Open the first collection
            </Link>
            .
          </Note>
        )}

        {data && data.length > 0 && (
          <ul className="border-t border-line">
            {data.map((c, i) => (
              <Band key={c.id} collection={c} index={i} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function Band({
  collection,
  index,
}: {
  collection: IndexedCollection;
  index: number;
}) {
  const minted = collection.totalMinted;
  const max = Number(collection.maxSupply);
  const left = Math.max(0, max - minted);
  const taken = max === 0 ? 0 : minted / max;

  return (
    <li className="border-b border-line">
      <Link
        href={`/c/${collection.id}`}
        className="group block px-1 py-6 transition-colors hover:bg-lift"
      >
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-3">
          {/* The collection's own mark, cut from its address. Four plates
              rather than one: a collection is a set, and a lone square reads as
              a logo. Sized, not proportioned — the row is baseline-aligned, so
              an aspect ratio here has no height to take a ratio of. */}
          <div className="flex shrink-0 gap-1 self-center" aria-hidden>
            {[0, 1, 2, 3].map((n) => (
              <div key={n} className="size-9 overflow-hidden">
                <Plate seed={`${collection.id}0${n}`} />
              </div>
            ))}
          </div>

          <h2 className="font-display text-2xl leading-none">
            {collection.name || "Untitled"}
            <span className="ml-3 font-sans text-[12px] uppercase tracking-[0.14em] text-dim">
              {collection.symbol}
            </span>
          </h2>

          <dl className="ml-auto flex items-baseline gap-8 text-[13px]">
            <Figure label="Rent">{rate(collection.taxBps)}</Figure>
            <Figure label="Unminted">
              <span className={left === 0 ? "text-dim" : undefined}>
                {left === 0 ? "none" : left}
              </span>
            </Figure>
            <Figure label="Held">
              <span className="text-standing">{minted}</span>
              <span className="text-dim"> / {max}</span>
            </Figure>
          </dl>
        </div>

        {/* The depletion. Drawn once on arrival, staggered down the register —
            the page's only motion, and it is showing what the numbers say. */}
        <div className="mt-5 h-[3px] w-full bg-line">
          <div
            className="h-[3px] origin-left animate-deplete bg-ink"
            style={{
              width: `${taken * 100}%`,
              animationDelay: `${Math.min(index, 8) * 70}ms`,
            }}
          />
        </div>
      </Link>
    </li>
  );
}

function Figure({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="text-right">
      <dt className="text-[11px] text-dim">{label}</dt>
      <dd className="mt-1 tabular">{children}</dd>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-y border-line py-6 text-[14px] text-dim">{children}</p>
  );
}

function Loading() {
  return (
    <ul className="border-t border-line" aria-busy>
      {[0, 1, 2].map((i) => (
        <li key={i} className="border-b border-line px-1 py-6">
          <div className="flex items-center gap-6">
            <div className="h-[1.6rem] w-[8.5rem] animate-pulse bg-line" />
            <div className="h-6 w-48 animate-pulse bg-line" />
          </div>
          <div className="mt-5 h-[3px] w-full bg-line" />
        </li>
      ))}
    </ul>
  );
}
