"use client";

import { Badge } from "@/components/ui/badge";
import { humanizeKey, isImageUrl } from "../lib/ad-helpers";

interface MetadataPreviewProps {
  type: string;
  data: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

function isUrl(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return value.startsWith("http://") || value.startsWith("https://");
}

function FieldValue({
  value,
  fieldKey,
}: {
  value: unknown;
  fieldKey?: string;
}) {
  if (value == null || value === "") {
    return <span className="text-muted-foreground italic">—</span>;
  }
  if (isImageUrl(value, fieldKey)) {
    return (
      <img
        src={value as string}
        alt=""
        className="h-8 w-8 rounded object-cover"
      />
    );
  }
  if (isUrl(value)) {
    return (
      <a
        href={value as string}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline break-all"
      >
        {String(value)}
      </a>
    );
  }
  return <span className="break-all">{String(value)}</span>;
}

function FieldList({ fields }: { fields: Record<string, unknown> }) {
  return (
    <div className="space-y-1.5">
      {Object.entries(fields).map(([key, value]) => (
        <div key={key} className="flex justify-between gap-2 text-xs">
          <span className="text-muted-foreground shrink-0">
            {humanizeKey(key)}
          </span>
          <FieldValue value={value} fieldKey={key} />
        </div>
      ))}
    </div>
  );
}

export function MetadataPreview({
  type,
  data,
  metadata,
}: MetadataPreviewProps) {
  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[10px]">
          {type}
        </Badge>
        <span className="text-xs text-muted-foreground">Preview</span>
      </div>

      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
          Data
        </p>
        <FieldList fields={data} />
      </div>

      {metadata && Object.keys(metadata).length > 0 && (
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
            Enriched Metadata
          </p>
          <FieldList fields={metadata} />
        </div>
      )}
    </div>
  );
}
