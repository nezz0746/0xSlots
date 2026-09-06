"use client";

import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { useIpfsUpload } from "@/hooks/use-ipfs-upload";

/**
 * Put a collection's art on IPFS and hand back the base it resolves under.
 *
 * The files are stored under their token numbers and nothing else, because
 * `tokenURI` is the base plus the id with no separator of its own — so the
 * order they are picked in IS the order they are minted in, and the caller
 * says which number to start at.
 */
export function UploadArt({
  collection,
  startAt,
  collectionName,
  onUploaded,
  disabled,
}: {
  collection: string;
  /** The next unminted id, so a second upload continues the run. */
  startAt: number;
  /** Names the metadata documents, so a token reads as one of a collection. */
  collectionName?: string;
  onUploaded: (base: string) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const { phase, upload, reset } = useIpfsUpload();
  const busy =
    phase.kind === "opening" ||
    phase.kind === "sending" ||
    phase.kind === "committing";

  async function pick(files: FileList | null) {
    if (!files?.length) return;
    const root = await upload(
      collection,
      Array.from(files),
      startAt,
      collectionName,
    );
    // A trailing slash, always: without it token 1 resolves to `…<cid>1`.
    if (root) onUploaded(`ipfs://${root}/`);
  }

  return (
    <div>
      <input
        ref={input}
        type="file"
        multiple
        accept="image/*,video/*,application/json"
        hidden
        onChange={(e) => {
          void pick(e.target.files);
          // Cleared so picking the same files twice still fires a change.
          e.target.value = "";
        }}
      />

      <Button
        type="button"
        variant="outline"
        size="block"
        disabled={disabled || busy}
        onClick={() => input.current?.click()}
      >
        {busy ? "Uploading…" : "Upload the art"}
      </Button>

      <Progress phase={phase} startAt={startAt} onRetry={reset} />
    </div>
  );
}

function Progress({
  phase,
  startAt,
  onRetry,
}: {
  phase: ReturnType<typeof useIpfsUpload>["phase"];
  startAt: number;
  onRetry: () => void;
}) {
  if (phase.kind === "idle")
    return (
      <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
        Each file is stored under its token number, in the order you pick them —
        the first becomes No. {startAt}. They are pinned to Économe and
        replicated across its cluster.
      </p>
    );

  if (phase.kind === "failed")
    return (
      <div className="mt-2">
        <p role="alert" className="text-[11px] leading-snug text-ebbing">
          {phase.message}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 text-[11px] text-muted-foreground underline underline-offset-4 hover:text-ink"
        >
          Start again
        </button>
      </div>
    );

  if (phase.kind === "done")
    return (
      <p className="mt-2 text-[11px] leading-snug text-live">
        {phase.total} {phase.total === 1 ? "work" : "works"} pinned. The base
        below points at them — save it to make it the collection's.
      </p>
    );

  // Opening and committing are indeterminate; only sending has a figure.
  const done =
    phase.kind === "sending"
      ? phase.done
      : phase.kind === "committing"
        ? phase.total
        : 0;
  const total = phase.kind === "opening" ? 0 : phase.total;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div className="mt-2">
      <div className="h-1 w-full overflow-hidden bg-lift">
        <div
          className={`h-1 bg-standing transition-[width] duration-300 ${
            phase.kind === "opening" ? "animate-pulse w-1/6" : ""
          }`}
          style={phase.kind === "opening" ? undefined : { width: `${pct}%` }}
        />
      </div>
      <p className="mt-1.5 flex items-baseline justify-between gap-3 text-[11px] text-muted-foreground">
        <span>
          {phase.kind === "opening"
            ? "Opening the folder…"
            : phase.kind === "describing"
              ? "Writing the metadata…"
              : phase.kind === "committing"
                ? "Pinning the folder…"
                : `Batch ${phase.batch} of ${phase.batches}`}
        </span>
        {phase.kind !== "opening" && (
          <span className="tabular">
            {done} / {phase.total}
          </span>
        )}
      </p>
    </div>
  );
}
