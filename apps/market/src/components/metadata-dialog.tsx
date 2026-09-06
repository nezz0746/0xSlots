"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { Address } from "viem";
import { usePublicClient } from "wagmi";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useClients } from "@/hooks/use-market";
import { confirm } from "@/lib/tx";

/**
 * Where the collection's art lives. Owner only.
 *
 * The whole of what owning a collection is for: it confers no power over the
 * terms, the slots, or anybody's tokens, and saying so here is the point. An
 * "owner" control that looked like it could touch the rent would be read as a
 * reason not to mint.
 *
 * Behind a dialog rather than inline, because it is set once and then almost
 * never again. As a strip under the header it took a band of the page above
 * the works on every visit, from the one person who had already finished with
 * it. The trigger renders only for the owner: everyone else has nothing to
 * decide, and a disabled field is just a claim about somebody else's
 * permissions.
 */
export function MetadataDialog({
  chainId,
  collection,
  baseURI,
}: {
  chainId: number;
  collection: Address;
  /** What the collection currently points at, from the indexer. */
  baseURI: string | null;
}) {
  const { collections, canWrite } = useClients(chainId);
  const queryClient = useQueryClient();
  const publicClient = usePublicClient({ chainId });

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const current = baseURI ?? "";
  const value = draft ?? current;
  const changed = value.trim() !== current;
  // `tokenURI` is this plus the token id with nothing between them, so a base
  // that does not end in a separator resolves every token to the wrong place.
  // Said rather than corrected: the contract stores it verbatim, and quietly
  // appending a slash would make this field disagree with the chain.
  const missingSeparator =
    value.trim().length > 0 && !/[/=]$/.test(value.trim());

  async function save() {
    setError(null);
    setBusy("Saving…");
    try {
      const hash = await collections.setBaseURI(collection, value.trim());
      setBusy("Confirming…");
      await confirm(publicClient, hash);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["collection"] }),
        queryClient.invalidateQueries({ queryKey: ["token-art"] }),
      ]);
      setDraft(null);
      setOpen(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(/rejected|denied/i.test(message) ? "Cancelled" : message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0">
          Metadata
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Metadata base</DialogTitle>
          <DialogDescription>
            Each token resolves to this followed by its number.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-1.5">
          <Label htmlFor="base-uri">Base</Label>
          <Input
            id="base-uri"
            value={value}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="https://… or ipfs://…"
            disabled={!!busy}
            spellCheck={false}
          />
        </div>

        {missingSeparator && (
          <p className="-mt-2 text-[11px] leading-snug text-waning">
            This ends in no separator, so token 1 resolves to
            <span className="tabular"> {value.trim()}1</span>. Add a slash
            unless that is what you meant.
          </p>
        )}

        <p className="-mt-2 text-[11px] leading-snug text-muted-foreground">
          Setting it changes what every work in the collection displays, and
          nothing else — not the rent, not the terms, not who holds what.
        </p>

        <div className="grid gap-1.5">
          <Button
            type="button"
            size="block"
            disabled={!canWrite || !!busy || !changed}
            onClick={save}
          >
            {busy ?? (changed ? "Save" : "Nothing to change")}
          </Button>
          <DialogClose asChild>
            <Button type="button" variant="ghost" size="sm">
              Cancel
            </Button>
          </DialogClose>
        </div>

        {error && (
          <p role="alert" className="text-[12px] leading-snug text-destructive">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
