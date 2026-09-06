"use client";

import { NATIVE_CURRENCY_ADDRESS } from "@0xslots/sdk";
import { assertCollectionInit } from "@0xslots/sdk/slots";
import { useWalletModal } from "@0xslots/wallet";
import { useRouter } from "next/navigation";
import { cloneElement, isValidElement, useId, useState } from "react";
import { type Address, isAddress, zeroAddress } from "viem";
import { useAccount, usePublicClient } from "wagmi";

import { ArtChoice } from "@/components/art-choice";
import { CurrencyChoice } from "@/components/currency-choice";
import { Plate } from "@/components/plate";
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
import { useIpfsUpload } from "@/hooks/use-ipfs-upload";
import { useClients } from "@/hooks/use-market";
import { chainName, factoryFor } from "@/lib/chains";
import { createdCollection } from "@/lib/created-collection";
import { confirm } from "@/lib/tx";

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
  // Defaults to the chain's own first token, the same one the explorer picks.
  const [currency, setCurrency] = useState<string>(NATIVE_CURRENCY_ADDRESS);
  const [customCurrency, setCustomCurrency] = useState("");
  const [recipient, setRecipient] = useState("");
  const [manager, setManager] = useState("");

  const [art, setArt] = useState<File[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const publicClient = usePublicClient({ chainId });
  const { phase, upload } = useIpfsUpload();

  const factory = factoryFor(chainId);
  const taxBps = BigInt(Math.round(Number(taxPct || "0") * 100));
  const chosenCurrency = currency === "custom" ? customCurrency : currency;

  // Defaulted to the connected wallet rather than left empty. Both are
  // permanent on every slot this collection ever mints, and an empty field is
  // the easiest way to deploy one that pays nobody.
  const recipientAddr = (recipient || address || "") as string;

  /**
   * Deploy, upload, point at the art — in that order, and only that order.
   *
   * The folder is named after the collection's address, which does not exist
   * until the first transaction is mined, so the art cannot go up first. That
   * is also why this is one submission rather than three buttons: a creator
   * who deployed and then closed the tab would have a collection whose works
   * show nothing, and no obvious way back to finishing the job.
   *
   * Each phase is survivable on its own. A failed upload leaves a deployed
   * collection with no art, which the Metadata dialog on its page can still
   * fix — so the error says that rather than implying the whole thing is lost.
   */
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
      if (!isAddress(chosenCurrency))
        throw new Error("Pick a currency, or give a valid token address");

      const init = {
        name: name.trim(),
        symbol: symbol.trim(),
        maxSupply: BigInt(maxSupply || "0"),
        currency: chosenCurrency as Address,
        taxBps,
        minDepositSeconds: window,
        recipient: recipientAddr as Address,
        manager: (manager || zeroAddress) as Address,
        owner: address,
      };
      // The SDK refuses what the factory would refuse, before spending gas.
      assertCollectionInit(init);

      setBusy("Opening the collection…");
      const hash = await collections.createCollection(init);
      setBusy("Confirming…");
      const receipt = await publicClient?.waitForTransactionReceipt({ hash });
      if (!receipt || receipt.status !== "success")
        throw new Error("The collection was not created.");

      const created = createdCollection(receipt);
      if (!created)
        throw new Error(
          "The collection was created but its address could not be read.",
        );

      if (art.length > 0) {
        // Progress for this phase is the uploader's own; `busy` only names it.
        setBusy("Uploading the art…");
        const root = await upload(created, art, 1, name.trim());
        if (!root)
          throw new Error(
            "The collection is deployed, but the art did not upload. Open it and try again from Metadata.",
          );

        setBusy("Pointing it at the art…");
        const set = await collections.setBaseURI(created, `ipfs://${root}/`);
        await confirm(publicClient, set);
      }

      router.push(`/c/${created}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
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
            <div className="sm:col-span-3">
              <ArtChoice
                files={art}
                onChange={setArt}
                maxSupply={Number(maxSupply || "0")}
                phase={phase}
                disabled={!!busy}
              />
            </div>
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
            <div className="sm:col-span-3">
              <CurrencyChoice
                chainId={chainId}
                value={currency}
                onChange={setCurrency}
                custom={customCurrency}
                onCustom={setCustomCurrency}
              />
            </div>
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
              disabled={!factory || !!busy}
              className="w-full sm:w-auto"
            >
              {/* The phase, not a spinner. This submission is three steps and
                  two of them ask the wallet, so "Opening…" for the whole run
                  would leave the second prompt looking like a duplicate. */}
              {busy ?? "Open collection"}
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

        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          {/* What the collection will look like on the shelf.
              
              Seeded from the name and symbol rather than the address, which
              does not exist yet — so the plates move as they are typed. It is
              the one part of this form that answers "what am I making" rather
              than "what are the terms", and without it the page is a settings
              screen for a thing you cannot see. */}
          <div>
            <p className="mb-2 text-[11px] text-dim">On the shelf</p>
            <div className="border border-line bg-lift p-4">
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="w-9">
                      <Plate seed={`${name}${symbol}${i}`} />
                    </div>
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold leading-none tracking-[-0.02em]">
                    {name.trim() || "Untitled"}
                  </p>
                  <p className="mt-1.5 text-[10px] uppercase tracking-[0.16em] text-dim">
                    {symbol.trim() || "———"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] text-dim">Held</p>
                  <p className="text-[13px] tabular">0 / {maxSupply || "0"}</p>
                </div>
              </div>
            </div>
          </div>

          <TermsPreview
            taxBps={taxBps}
            minDepositSeconds={window}
            symbol={chosenCurrency === NATIVE_CURRENCY_ADDRESS ? "ETH" : ""}
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
