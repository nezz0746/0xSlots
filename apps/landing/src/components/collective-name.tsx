"use client";

import { Check, Pencil, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EnsName } from "@/components/ens-name";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  MAX_COLLECTIVE_NAME,
  useCollectiveName,
} from "@/hooks/use-collective-names";

/**
 * What to call a collective in a list.
 *
 * The name the user gave it if there is one, otherwise the same ENS-or-hex
 * label everything else uses. Never both: the address travels beside this in
 * every place it is rendered, so repeating it here would only make the row
 * harder to scan.
 */
export function CollectiveLabel({
  address,
  className,
}: {
  address: string;
  className?: string;
}) {
  const { name } = useCollectiveName(address);

  if (!name) return <EnsName address={address} className={className} />;

  return (
    <span className={className} title={address}>
      {name}
    </span>
  );
}

/**
 * The collective's title, renameable in place.
 *
 * The name is local to this browser — nothing is signed and no transaction is
 * sent — so the affordance is deliberately quiet: a pencil rather than a form,
 * and a tooltip that says where the name lives. Submitting empty clears it and
 * falls back to the generic title.
 */
export function CollectiveNameHeading({ address }: { address: string }) {
  const { name, rename } = useCollectiveName(address);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  function open() {
    setDraft(name ?? "");
    setEditing(true);
  }

  function commit() {
    rename(draft);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          value={draft}
          maxLength={MAX_COLLECTIVE_NAME}
          placeholder="Name this collective"
          aria-label="Collective name"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
          className="h-8 w-52 text-sm"
        />
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Save name"
          onClick={commit}
        >
          <Check className="size-3.5" />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Cancel rename"
          onClick={() => setEditing(false)}
        >
          <X className="size-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <h1 className="truncate text-xl font-bold leading-tight tracking-tight">
        {name ?? "Collective"}
      </h1>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={name ? "Rename collective" : "Name collective"}
            onClick={open}
            className="text-muted-foreground"
          >
            <Pencil />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {name ? "Rename" : "Name it"} — saved in this browser only
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
