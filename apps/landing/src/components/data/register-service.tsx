"use client";

import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Address } from "viem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Reveal } from "@/components/ui/reveal";
import { useSlotAction } from "@/hooks/use-slot-action";
import { useSlotsClient } from "@/hooks/use-slots-client";
import { parseSchema } from "@/lib/slot-data";

/**
 * Registering a shape — the one write on this page anyone may make.
 *
 * Behind a `Reveal` rather than sitting open, because reading the registry is
 * the common reason to be here and adding to it is rare. Same gesture as the
 * slot panel's "Adjust".
 *
 * The schema is validated as it is typed, and the button will not submit an
 * unparseable one. That check is a courtesy and nothing more: the contract does
 * not validate schemas, deliberately — there is no cheap way to check a string
 * parses as a signature on chain — so anyone calling it directly can register
 * anything. What this prevents is the accident, not the abuse, and a service
 * once registered cannot be edited or removed.
 */
export function RegisterService({ module }: { module: Address }) {
  const client = useSlotsClient();
  const { exec, busy } = useSlotAction();

  const [name, setName] = useState("");
  const [schema, setSchema] = useState("");

  const trimmed = schema.trim();
  const parsed = trimmed ? parseSchema(trimmed) : null;
  const schemaBad = trimmed.length > 0 && !parsed;
  const canSubmit = !busy && name.trim().length > 0 && !!parsed;

  const submit = async () => {
    const hash = await exec("Register service", () =>
      client.modules.slotData.registerService(module, {
        schema: trimmed,
        name: name.trim(),
      }),
    );
    if (hash) {
      setName("");
      setSchema("");
      toast.success("Service registered");
    }
  };

  return (
    <Reveal label="Register a service">
      <div className="space-y-3 p-3">
        <p className="text-xs leading-relaxed text-muted-foreground">
          A service is a name and an ABI signature. Anyone may add one, ids are
          sequential, and nothing can be edited or removed afterwards — clients
          render the services they recognise and ignore the rest.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Name
            </span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="creative.v1"
              maxLength={64}
            />
          </label>

          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Schema
            </span>
            <Input
              value={schema}
              onChange={(e) => setSchema(e.target.value)}
              placeholder="string uri"
              maxLength={512}
              aria-invalid={schemaBad}
            />
          </label>
        </div>

        {/* Echoing the parse back is what makes the field teachable: a
            signature is not obviously well-formed by eye, and seeing the
            fields it resolves to is faster than reading an error. */}
        {parsed && (
          <p className="text-[11px] text-muted-foreground">
            {parsed.length} field{parsed.length === 1 ? "" : "s"}:{" "}
            {parsed.map((p, i) => `${p.type} ${p.name || `[${i}]`}`).join(", ")}
          </p>
        )}
        {schemaBad && (
          <p className="text-[11px] text-amber-600">
            Not a readable ABI signature. Try `string uri` or `string
            text,string[] medias`.
          </p>
        )}

        <Button size="sm" disabled={!canSubmit} onClick={() => void submit()}>
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <Plus className="size-3.5" aria-hidden />
          )}
          Register
        </Button>
      </div>
    </Reveal>
  );
}
