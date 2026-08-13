import type { AdType } from "@adland/data";
import type { LucideIcon } from "lucide-react";
import {
  AppWindow,
  Coins,
  ExternalLink,
  MessageSquare,
  UserCircle,
} from "lucide-react";

export const adTypeIcons: Record<AdType, LucideIcon> = {
  link: ExternalLink,
  cast: MessageSquare,
  miniapp: AppWindow,
  token: Coins,
  farcasterProfile: UserCircle,
};

export const adTypeLabels: Record<AdType, string> = {
  link: "Link",
  cast: "Farcaster Cast",
  miniapp: "Mini App",
  token: "Token",
  farcasterProfile: "Farcaster Profile",
};

export const adTypeColors: Record<string, string> = {
  link: "bg-blue-500/10 text-blue-600",
  cast: "bg-purple-500/10 text-purple-600",
  miniapp: "bg-cyan-500/10 text-cyan-600",
  token: "bg-amber-500/10 text-amber-600",
  farcasterProfile: "bg-pink-500/10 text-pink-600",
};

export const imageFieldNames = [
  "pfpUrl",
  "image",
  "imageUrl",
  "icon",
  "logoURI",
];

export function humanizeKey(key: string): string {
  const acronyms: Record<string, string> = {
    url: "URL",
    uri: "URI",
    id: "ID",
    fid: "FID",
  };
  if (acronyms[key.toLowerCase()]) return acronyms[key.toLowerCase()];
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/^./, (s) => s.toUpperCase());
}

export function isImageUrl(value: unknown, key?: string): boolean {
  if (typeof value !== "string" || !value) return false;
  if (
    key &&
    imageFieldNames.includes(key) &&
    (value.startsWith("http") || value.startsWith("data:"))
  )
    return true;
  return (
    /\.(png|jpg|jpeg|gif|svg|webp)(\?.*)?$/i.test(value) ||
    value.startsWith("data:image/")
  );
}

export type AdContent = {
  type: string;
  data: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};
