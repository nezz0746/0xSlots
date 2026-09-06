"use client";

import { use, useState } from "react";
import type { Address } from "viem";
import { useAccount } from "wagmi";

import { BuyPanel } from "@/components/buy-panel";
import { HoldPanel } from "@/components/hold-panel";
import { MintPanel } from "@/components/mint-panel";
import { TokenGrid } from "@/components/token-grid";
import { useActiveChain } from "@/hooks/use-active-chain";
import { useCollection, useTokens } from "@/hooks/use-market";
import { rate, truncate } from "@/lib/format";

const ZERO = "0x0000000000000000000000000000000000000000";

export default function CollectionPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = use(params);
  const collection = address as Address;

  const { chainId } = useActiveChain();
  // Named apart from the route's `address`, which is the collection. The two
  // are both addresses and both in scope, and comparing a token's owner
  // against the wrong one is a mistake nothing would report.
  const { address: wallet } = useAccount();

  const { data: c, isLoading } = useCollection(chainId, collection);
  const { data: tokens } = useTokens(chainId, collection);

  const [selected, setSelected] = useState<string | null>(null);
  const token = tokens?.find((t) => t.tokenId === selected) ?? null;
  // Holding a work and wanting one are different panels, because they are
  // different sets of actions — not one panel with the buttons greyed out.
  const mine =
    !!token && !!wallet && token.owner.toLowerCase() === wallet.toLowerCase();

  if (isLoading)
    return (
      <p className="mx-auto max-w-6xl px-5 py-16 text-[14px] text-dim sm:px-8">
        Loading…
      </p>
    );
  if (!c)
    return (
      <p className="mx-auto max-w-6xl px-5 py-16 text-[14px] text-dim sm:px-8">
        No such collection on this network.
      </p>
    );

  const minted = c.totalMinted;
  const max = Number(c.maxSupply);
  const soldOut = minted >= max;

  return (
    <div className="mx-auto w-full max-w-6xl px-5 pb-28 sm:px-8">
      <header className="border-b border-line pb-8 pt-14 sm:pt-20">
        <h1 className="text-4xl font-semibold leading-none tracking-[-0.035em] sm:text-5xl">
          {c.name || "Untitled"}
        </h1>
        <p className="mt-3 text-[12px] uppercase tracking-[0.16em] text-dim">
          {c.symbol}
        </p>

        <dl className="mt-9 grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
          <Fact label="Held">
            <span className="text-standing">{minted}</span>
            <span className="text-dim"> / {max}</span>
          </Fact>
          <Fact label="Rent">{rate(c.taxBps)}</Fact>
          <Fact label="Rent goes to">{truncate(c.recipient)}</Fact>
          {/* The one thing a buyer is entitled to know before committing:
              whether the rate they are buying into can move. */}
          <Fact label="Terms">
            {c.manager && c.manager !== ZERO ? "rent can change" : "fixed"}
          </Fact>
        </dl>
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_23rem] lg:gap-14">
        <section>
          <TokenGrid
            tokens={tokens ?? []}
            chainId={chainId}
            currency={c.currency}
            baseURI={c.baseURI}
            selected={selected}
            onSelect={setSelected}
          />
        </section>

        {/* Beside the hang on a laptop, under it on a phone — in the flow of
            the page either way. Nothing slides up over the work. */}
        <aside className="order-first lg:order-none lg:sticky lg:top-8 lg:self-start">
          {token && mine ? (
            <HoldPanel
              chainId={chainId}
              tokenId={token.tokenId}
              slot={token.slot}
              currency={c.currency}
            />
          ) : token ? (
            <BuyPanel
              chainId={chainId}
              tokenId={token.tokenId}
              slot={token.slot}
              currency={c.currency}
              onDone={() => setSelected(null)}
            />
          ) : (
            <MintPanel
              chainId={chainId}
              collection={collection}
              currency={c.currency}
              soldOut={soldOut}
            />
          )}
        </aside>
      </div>
    </div>
  );
}

function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-[11px] text-dim">{label}</dt>
      <dd className="mt-1.5 tabular text-[15px]">{children}</dd>
    </div>
  );
}
