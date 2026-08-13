"use client";

import type { AdType } from "@adland/data";
import { Badge } from "@/components/ui/badge";
import {
  type AdContent,
  adTypeIcons,
  adTypeLabels,
  humanizeKey,
  imageFieldNames,
} from "../lib/ad-helpers";

interface CurrentAdBannerProps {
  ad: AdContent;
  uri: string | null;
}

export function CurrentAdBanner({ ad, uri }: CurrentAdBannerProps) {
  const typeLabel = adTypeLabels[ad.type as AdType] ?? ad.type;
  const TypeIcon = adTypeIcons[ad.type as AdType];

  const displayFields = { ...ad.data, ...(ad.metadata ?? {}) };

  const imageKey = Object.keys(displayFields).find((k) => {
    const v = displayFields[k];
    if (typeof v !== "string" || !v) return false;
    if (
      imageFieldNames.includes(k) &&
      (v.startsWith("http") || v.startsWith("data:"))
    )
      return true;
    return (
      /\.(png|jpg|jpeg|gif|svg|webp)(\?.*)?$/i.test(v) ||
      v.startsWith("data:image/")
    );
  });
  const imageUrl = imageKey ? (displayFields[imageKey] as string) : null;

  const titleKey = ["title", "name", "displayName", "username", "text"].find(
    (k) => displayFields[k] && typeof displayFields[k] === "string",
  );
  const title = titleKey ? (displayFields[titleKey] as string) : null;

  const descKey = ["description", "bio", "symbol", "text"].find(
    (k) =>
      displayFields[k] &&
      typeof displayFields[k] === "string" &&
      k !== titleKey,
  );
  const description = descKey ? (displayFields[descKey] as string) : null;

  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="flex items-start gap-3">
        {imageUrl && (
          <img
            src={imageUrl}
            alt=""
            className="size-10 rounded-md object-cover shrink-0"
          />
        )}

        <div className="flex-1 min-w-0 space-y-0.5">
          {title && <p className="text-sm font-medium truncate">{title}</p>}
          {description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {description}
            </p>
          )}
          {!title && !description && (
            <div className="space-y-0.5">
              {Object.entries(ad.data).map(([key, value]) => (
                <p key={key} className="text-xs truncate">
                  <span className="text-muted-foreground">
                    {humanizeKey(key)}:
                  </span>{" "}
                  {String(value)}
                </p>
              ))}
            </div>
          )}
        </div>

        <Badge variant="outline" className="shrink-0 text-[10px] gap-1">
          {TypeIcon && <TypeIcon className="size-3" />}
          {typeLabel}
        </Badge>
      </div>
    </div>
  );
}
