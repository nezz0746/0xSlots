"use client";

import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { UploadPhase } from "@/hooks/use-ipfs-upload";

/**
 * The art, chosen now and uploaded after the collection exists.
 *
 * Picked rather than uploaded on selection, because the folder is named after
 * the collection's address and there is no address until the first transaction
 * is mined. So this holds the files and the submit does the work — which also
 * means nothing is pinned for a collection that never got deployed.
 *
 * Optional on purpose. A collection can open with no art and be given some
 * later from its own page, and a required upload here would make the cheapest
 * thing on the form the biggest commitment.
 */
export function ArtChoice({
  files,
  onChange,
  maxSupply,
  phase,
  disabled,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  /** The run, so picking more works than places is caught before any gas. */
  maxSupply: number;
  phase: UploadPhase;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const tooMany = maxSupply > 0 && files.length > maxSupply;

  return (
    <div className="grid gap-1.5">
      <Label>Art</Label>
      <input
        ref={input}
        type="file"
        multiple
        accept="image/*,video/*,application/json"
        hidden
        onChange={(e) => {
          onChange(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => input.current?.click()}
        >
          {files.length > 0 ? "Choose different files" : "Choose files"}
        </Button>
        {files.length > 0 && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange([])}
            className="text-[12px] text-muted-foreground underline underline-offset-4 hover:text-ink"
          >
            Clear
          </button>
        )}
      </div>

      {/* Progress belongs here rather than beside the button, because during a
          submission this is the only part of the form still doing anything. */}
      {phase.kind === "sending" ||
      phase.kind === "describing" ||
      phase.kind === "committing" ? (
        <Batches phase={phase} />
      ) : tooMany ? (
        <p className="text-[11px] leading-snug text-ebbing">
          {files.length} files for {maxSupply} places. Raise the supply or drop
          some — the extras would upload with nothing to mint them.
        </p>
      ) : files.length > 0 ? (
        <p className="text-[11px] leading-snug text-muted-foreground">
          {files.length} {files.length === 1 ? "work" : "works"}, minted in the
          order shown — the first becomes No. 1. They upload once the collection
          is deployed, since the folder is named after its address.
        </p>
      ) : (
        <p className="text-[11px] leading-snug text-muted-foreground">
          Optional. A collection can open empty and be given its art later.
        </p>
      )}
    </div>
  );
}

function Batches({
  phase,
}: {
  phase: Extract<
    UploadPhase,
    { kind: "sending" | "describing" | "committing" }
  >;
}) {
  const done = phase.kind === "sending" ? phase.done : phase.total;
  const pct = phase.total === 0 ? 0 : Math.round((done / phase.total) * 100);
  return (
    <div>
      <div className="h-1 w-full overflow-hidden bg-lift">
        <div
          className="h-1 bg-standing transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1.5 flex items-baseline justify-between gap-3 text-[11px] text-muted-foreground">
        <span>
          {phase.kind === "committing"
            ? "Pinning the folder…"
            : phase.kind === "describing"
              ? "Writing the metadata…"
              : `Batch ${phase.batch} of ${phase.batches}`}
        </span>
        <span className="tabular">
          {done} / {phase.total}
        </span>
      </p>
    </div>
  );
}
