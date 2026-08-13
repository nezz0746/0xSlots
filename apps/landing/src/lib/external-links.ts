import sdk from "@farcaster/miniapp-sdk";
import { BookOpen, Github, type LucideIcon, Send } from "lucide-react";

export interface ExternalLink {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const EXTERNAL_LINKS: ExternalLink[] = [
  { label: "Docs", href: "https://docs.0xslots.org", icon: BookOpen },
  {
    label: "GitHub",
    href: "https://github.com/adcommune/0xSlots",
    icon: Github,
  },
  { label: "Telegram", href: "https://t.me/+AQ3SdkC0SCM4NTdk", icon: Send },
];

/**
 * Open an off-app URL. Inside a miniapp `window.open` is a no-op, so the host
 * SDK has to do it.
 */
export function openExternal(href: string, isMiniApp: boolean) {
  if (isMiniApp) {
    sdk.actions.openUrl(href);
  } else {
    window.open(href, "_blank");
  }
}

/**
 * Marketing-page destinations. The explorer and create links are INTERNAL now
 * that both sites share an origin — they were absolute URLs to
 * app.0xslots.org while vitrine was its own deployment.
 */
export const MARKETING_LINKS = {
  explorer: "/app",
  create: "/app/create",
  docs: "https://docs.0xslots.org",
  github: "https://github.com/adcommune/0xSlots",
  telegram: "https://t.me/+AQ3SdkC0SCM4NTdk",
} as const;
