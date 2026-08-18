import type { SlotsChain } from "@0xslots/sdk";

export const title = "0xSlots — Collective ownership made easy";

export const description =
  "Slots are a flexible and composable collective ownership primitive that make it easy for you to experiment with different ways of sharing and governing digital assets";

export const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

/** 30 days in seconds (used for tax-rate calculations). */
export const MONTH_SECONDS = 30n * 24n * 60n * 60n;

export const useTunnel = process.env.NEXT_PUBLIC_USE_TUNNEL === "true";

export const APP_URL = useTunnel
  ? "https://really-intense-guppy.ngrok-free.app"
  : (process.env.NEXT_PUBLIC_APP_URL ?? "https://0xslots.org");

export const AD_SLOTS: Partial<Record<SlotsChain, string[]>> = {
  // Slot addresses will be provided — using placeholders
  [8453 as SlotsChain]: [
    "0xb6a6d14bb374b6aa6d52b2b982547031fddfeed5",
    "0xa6eb42f770f0c4c95a9de8b70b1c178a8ea90575",
    "0x21834896daa664f2081442a777c354335654afd6",
  ],
};
