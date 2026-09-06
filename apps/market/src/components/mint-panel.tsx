"use client";

import { useWalletModal } from "@0xslots/wallet";
import { useState } from "react";
import { type Address, parseUnits } from "viem";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WhatItCostsYou } from "@/components/what-it-costs-you";
import { useClients, useCollection, useMintQuote } from "@/hooks/use-market";
import { isNative } from "@/lib/format";

export function MintPanel({
  chainId,
  collection,
  currency,
  soldOut,
}: {
  chainId: number;
  collection: Address;
  currency: Address;
  soldOut: boolean;
}) {
  const { collections, canWrite } = useClients(chainId);
  const { openConnect } = useWalletModal();
  const [valuation, setValuation] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parsed = (() => {
    try {
      return parseUnits(valuation || "0", 18);
    } catch {
      return 0n;
    }
  })();
  const { data: quote } = useMintQuote(chainId, collection, parsed);
  const { data: indexed } = useCollection(chainId, collection);
  const symbol = isNative(currency) ? "ETH" : "";

  async function mint() {
    setError(null);
    try {
      if (parsed <= 0n) throw new Error("Name a valuation above zero");
      if (!isNative(currency)) {
        setBusy("Approving…");
        await collections.approveMint(collection, parsed);
      }
      setBusy("Minting…");
      await collections.mint(collection, parsed);
      setValuation("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  if (soldOut)
    return (
      <div className="border border-line bg-lift p-5">
        <h3 className="font-display text-lg leading-none">Sold out</h3>
        <p className="mt-2 text-xs text-dim">
          Every token is minted. They are all still for sale — select one.
        </p>
      </div>
    );

  return (
    <div className="border border-line bg-lift p-5">
      <h3 className="font-display text-lg leading-none">Mint</h3>
      <p className="mt-1 text-xs text-dim">
        Name what it is worth to you. That becomes its price, and anyone may
        take it from you there.
      </p>

      <div className="mt-5 grid gap-1.5">
        <Label htmlFor="mint-valuation">Valuation</Label>
        <Input
          id="mint-valuation"
          value={valuation}
          onChange={(e) => setValuation(e.target.value)}
          inputMode="decimal"
          placeholder="0.0"
          className="tabular"
        />
      </div>

      {/* The same grid the buy panel shows, so a minter and a buyer are
          reading one vocabulary. Price and escrow do different things and the
          difference is the whole model: one is spent, one is still yours. */}
      {quote && indexed?.taxBps && indexed?.minDepositSeconds && (
        <div className="mt-4">
          <WhatItCostsYou
            valuation={quote.price}
            taxBps={BigInt(indexed.taxBps)}
            deposit={quote.deposit}
            minDepositSeconds={BigInt(indexed.minDepositSeconds)}
            symbol={symbol}
          />
        </div>
      )}

      {/* Not a disabled button saying "connect a wallet": the picker is a
          click away, so the button that asks for one opens it. */}
      {canWrite ? (
        <Button
          type="button"
          size="block"
          className="mt-5"
          disabled={!!busy || parsed <= 0n}
          onClick={mint}
        >
          {busy ?? "Mint"}
        </Button>
      ) : (
        <Button
          type="button"
          size="block"
          variant="outline"
          className="mt-5"
          onClick={openConnect}
        >
          Connect a wallet
        </Button>
      )}

      {error && (
        <p
          role="alert"
          className="mt-3 text-[12px] leading-snug text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}
