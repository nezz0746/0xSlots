"use client";

import { useWalletModal } from "@0xslots/wallet";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { Address } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { BalanceLine } from "@/components/balance-line";
import { Figures } from "@/components/figures";
import { Button } from "@/components/ui/button";
import { ValuationInput } from "@/components/valuation-input";
import { useCurrency, useCurrencyBalance } from "@/hooks/use-currency";
import { useClients, useCollection, useMintQuote } from "@/hooks/use-market";
import { amount, duration, isNative } from "@/lib/format";
import { confirm } from "@/lib/tx";

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
  const { isConnected } = useAccount();
  const queryClient = useQueryClient();
  const publicClient = usePublicClient({ chainId });
  const { symbol, decimals } = useCurrency(chainId, currency);
  const balance = useCurrencyBalance(chainId, currency);

  const [valuation, setValuation] = useState(0n);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: quote } = useMintQuote(chainId, collection, valuation);
  const { data: indexed } = useCollection(chainId, collection);

  const at = (v: bigint) => amount(v, decimals, symbol);
  const taxBps = BigInt(indexed?.taxBps ?? 0);
  const window = BigInt(indexed?.minDepositSeconds ?? 0);
  // What the wallet actually has to send. Zero until a valuation is named.
  const total = quote?.total ?? 0n;
  const short = balance !== undefined && total > balance;

  async function mint() {
    setError(null);
    try {
      if (!isNative(currency)) {
        setBusy("Approving…");
        await collections.approveMint(collection, valuation);
      }
      setBusy("Minting…");
      const hash = await collections.mint(collection, valuation);

      // `mint` returns as soon as the wallet accepts the transaction, not when
      // it is mined. Refreshing on that hash asked the indexer about a block
      // it had not seen, so the page kept showing the count it loaded with and
      // the work just paid for was missing from the hang.
      setBusy("Confirming…");
      await confirm(publicClient, hash);
      setValuation(0n);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["collection"] }),
        queryClient.invalidateQueries({ queryKey: ["collections"] }),
        queryClient.invalidateQueries({ queryKey: ["tokens"] }),
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  if (soldOut)
    return (
      <div className="border border-line bg-lift p-5">
        <h3 className="text-lg font-semibold leading-none tracking-[-0.02em]">
          Sold out
        </h3>
        <p className="mt-2 text-xs text-dim">
          Every work is minted. They are all still for sale — select one.
        </p>
      </div>
    );

  return (
    <div className="border border-line bg-lift p-5">
      <h3 className="text-lg font-semibold leading-none tracking-[-0.02em]">
        Mint
      </h3>
      <p className="mt-1 text-xs text-dim">
        Name what it is worth to you. That becomes its price, and anyone may
        take it from you there.
      </p>

      <div className="mt-5">
        <ValuationInput
          id="mint-valuation"
          label="Valuation"
          value={valuation}
          onChange={setValuation}
          decimals={decimals}
          taxBps={taxBps}
          symbol={symbol}
          disabled={!!busy}
          below={
            isConnected ? (
              <BalanceLine balance={balance} total={total} at={at} />
            ) : null
          }
        />
      </div>

      {/* The same three the buy panel and the explorer show, so a minter and a
          bidder are reading one vocabulary. */}
      {valuation > 0n && (
        <div className="mt-4">
          <Figures
            items={[
              {
                label: "You send",
                value: at(total),
                tone: short ? "gone" : "standing",
                foot: short ? "too much" : undefined,
              },
              {
                label: "Rent / mo",
                qualifier: `${Number(taxBps) / 100}%`,
                value: at((valuation * taxBps) / 10_000n),
              },
              { label: "Runway", value: duration(Number(window)) },
            ]}
          />
          <p className="mt-1.5 text-[10px] leading-snug text-dim">
            {at(valuation)} is the price you pay out, {at(quote?.deposit ?? 0n)}{" "}
            is escrow you get back.
          </p>
        </div>
      )}

      {canWrite ? (
        <Button
          type="button"
          size="block"
          className="mt-5"
          disabled={!!busy || valuation <= 0n || short}
          onClick={mint}
        >
          {busy ??
            (valuation <= 0n ? "Name a valuation" : `Mint for ${at(total)}`)}
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

      {/* Said where the decision is made rather than as a disabled button with
          no explanation. A price of zero owes zero rent for ever, so nothing
          would ever accrue and nothing could ever be liquidated — the core
          refuses it on every seating, not just on a mint. */}
      {valuation <= 0n && (
        <p className="mt-3 text-[11px] leading-snug text-dim">
          A work cannot be held at nothing. Rent is a share of the price, so a
          price of zero would never come due and the work could never change
          hands the way every other one here does.
        </p>
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
