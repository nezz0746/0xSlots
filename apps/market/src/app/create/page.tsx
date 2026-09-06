"use client";

import { assertCollectionInit } from "@0xslots/sdk/slots";
import { useWalletModal } from "@0xslots/wallet";
import { useRouter } from "next/navigation";
import { cloneElement, isValidElement, useId, useState } from "react";
import { type Address, isAddress, zeroAddress } from "viem";
import { useAccount } from "wagmi";

import { TermsPreview } from "@/components/terms-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActiveChain } from "@/hooks/use-active-chain";
import { useClients } from "@/hooks/use-market";
import { chainName, factoryFor } from "@/lib/chains";

/** Windows a collection realistically wants, rather than a seconds field. */
const WINDOWS = [
  { label: "1 day", seconds: 86_400n },
  { label: "7 days", seconds: 604_800n },
  { label: "30 days", seconds: 2_592_000n },
] as const;

export default function CreatePage() {
  const router = useRouter();
  const { address } = useAccount();
  const { chainId } = useActiveChain();
  const { collections, canWrite } = useClients(chainId);
  const { openConnect } = useWalletModal();

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [maxSupply, setMaxSupply] = useState("100");
  const [taxPct, setTaxPct] = useState("10");
  const [window, setWindow] = useState<bigint>(604_800n);
  const [currency, setCurrency] = useState("");
  const [recipient, setRecipient] = useState("");
  const [manager, setManager] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const factory = factoryFor(chainId);
  const taxBps = BigInt(Math.round(Number(taxPct || "0") * 100));

  // Defaulted to the connected wallet rather than left empty. Both are
  // permanent on every slot this collection ever mints, and an empty field is
  // the easiest way to deploy one that pays nobody.
  const recipientAddr = (recipient || address || "") as string;

  async function create() {
    setError(null);
    try {
      if (!address) throw new Error("Connect a wallet");
      if (!factory)
        throw new Error(`No collection factory on ${chainName(chainId)}`);
      if (!isAddress(recipientAddr))
        throw new Error("Recipient is not an address");
      if (manager && !isAddress(manager))
        throw new Error("Manager is not an address");
      if (currency && !isAddress(currency))
        throw new Error("Currency is not an address");

      const init = {
        name: name.trim(),
        symbol: symbol.trim(),
        maxSupply: BigInt(maxSupply || "0"),
        currency: (currency || zeroAddress) as Address,
        taxBps,
        minDepositSeconds: window,
        recipient: recipientAddr as Address,
        manager: (manager || zeroAddress) as Address,
        owner: address,
      };
      // The SDK refuses what the factory would refuse, before spending gas.
      assertCollectionInit(init);

      setBusy(true);
      await collections.createCollection(init);
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-5 pb-28 pt-14 sm:px-8 sm:pt-20">
      <h1 className="text-4xl font-semibold leading-none tracking-[-0.035em] sm:text-5xl">
        Open a collection
      </h1>
      <p className="mt-5 max-w-[48ch] text-[15px] leading-relaxed text-dim">
        You set the terms once, here. Everyone who mints chooses only what their
        work is worth to them — and holds it at that price until someone pays
        it.
      </p>

      {!factory && (
        <p className="mt-8 border-y border-line py-5 text-[14px] text-dim">
          Slotmarket has not reached {chainName(chainId)}.
        </p>
      )}

      <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_23rem] lg:gap-14">
        <form
          className="space-y-9"
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
        >
          <Section title="Identity">
            <Field label="Name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Bound Collection"
              />
            </Field>
            <Field label="Symbol">
              <Input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="BND"
              />
            </Field>
            <Field label="Max supply">
              <Input
                value={maxSupply}
                onChange={(e) => setMaxSupply(e.target.value)}
                inputMode="numeric"
                className="tabular"
              />
            </Field>
          </Section>

          <Section title="Terms">
            <Field label="Rent" hint="% of the holder's valuation, per 30 days">
              <Input
                value={taxPct}
                onChange={(e) => setTaxPct(e.target.value)}
                inputMode="decimal"
                className="tabular"
              />
            </Field>
            <Field label="Funded window" hint="what a mint's escrow buys">
              <WindowSelect value={window} onChange={setWindow} />
            </Field>
            <Field label="Currency" hint="blank for native ETH">
              <Input
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                placeholder="0x… or blank"
              />
            </Field>
          </Section>

          <Section title="Who holds what">
            <Field label="Recipient" hint="receives the rent, for ever">
              <Input
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder={address ?? "0x…"}
              />
            </Field>
            <Field
              label="Manager"
              hint="may change the rent. Blank fixes it for ever"
            >
              <Input
                value={manager}
                onChange={(e) => setManager(e.target.value)}
                placeholder="blank"
              />
            </Field>
          </Section>

          {canWrite ? (
            <Button
              type="submit"
              size="lg"
              disabled={!factory || busy}
              className="w-full sm:w-auto"
            >
              {busy ? "Opening…" : "Open collection"}
            </Button>
          ) : (
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={openConnect}
            >
              Connect a wallet
            </Button>
          )}

          {error && (
            <p role="alert" className="text-[12px] leading-snug text-ebbing">
              {error}
            </p>
          )}
        </form>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <TermsPreview
            taxBps={taxBps}
            minDepositSeconds={window}
            symbol={currency ? "" : "ETH"}
          />

          {/* The two that cannot be undone. Said once, next to the button that
              commits them, rather than as a hint under each field where a
              reader meets them one at a time and never together. */}
          <p className="mt-5 border-l-2 border-ebbing pl-3 text-[12px] leading-snug text-dim">
            The recipient and the manager are fixed on every slot this
            collection ever mints, and nothing changes either afterwards. Use
            addresses you will still control in a year.
          </p>
        </aside>
      </div>
    </div>
  );
}

/** Root takes no id, so the trigger receives it and the label points there. */
function WindowSelect({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: bigint;
  onChange: (seconds: bigint) => void;
}) {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(BigInt(v))}>
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {WINDOWS.map((w) => (
          <SelectItem key={w.label} value={String(w.seconds)}>
            {w.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset>
      <legend className="text-[11px] text-dim">{title}</legend>
      <div className="mt-4 grid gap-5 sm:grid-cols-3">{children}</div>
    </fieldset>
  );
}

/**
 * A control and what it decides.
 *
 * The hint sits under the field rather than beside the label: these are
 * consequences, not names, and half of them ("fixes it for ever") are the
 * reason somebody stops and reads before typing.
 */
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactElement<{ id?: string }>;
}) {
  // The label is a sibling rather than a wrapper — a Select trigger inside a
  // <label> swallows its own click — so the id is minted here and handed down.
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {isValidElement(children) ? cloneElement(children, { id }) : children}
      {hint && (
        <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
