import { NextResponse } from "next/server";
import { APP_URL } from "@/constants";

/**
 * Farcaster miniapp manifest.
 *
 * TODO — RE-SIGN THE ACCOUNT ASSOCIATION.
 *
 * The `accountAssociation` below is a signature bound to a domain. Its payload
 * decodes to {"domain":"app.0xslots.org"}, signed by fid 1733, and the app now
 * serves from 0xslots.org — so it will NOT verify.
 *
 * It cannot be regenerated in code. Re-sign for `0xslots.org` with fid 1733 at:
 *   https://farcaster.xyz/~/developers/mini-apps/manifest
 *
 * The stale value is left in place deliberately rather than blanked: a wrong
 * association fails verification loudly, an empty one looks intentional.
 */
export function GET() {
  return NextResponse.json({
    "accountAssociation;": {
      "header": "eyJmaWQiOjE3MzMsInR5cGUiOiJjdXN0b2R5Iiwia2V5IjoiMHg4ZjE0NDM1NDM4NzAyRjExMTA4OEMxZGMzNkY5NTQ4ODQyNjI5RmU0In0",
      "payload": "eyJkb21haW4iOiIweHNsb3RzLm9yZyJ9",
      "signature": "k5KFiNk8BnS3O/pBv/7doo39HyoPQhaizpMTF9K8JKIz/MF+3adTRAweDeRjju1bx5V2hGyS22qyLuKGtC2Pnxw="
    },
    miniapp: {
      version: "1",
      name: "0xSlots",
      iconUrl: `${APP_URL}/logo.png`,
      // The explorer, not the marketing page.
      homeUrl: `${APP_URL}/app`,
      imageUrl: `${APP_URL}/api/og`,
      buttonTitle: "Explore",
      splashImageUrl: `${APP_URL}/logo.png`,
      splashBackgroundColor: "#ffffff",
      description: "Taxable Slots",
    },
  });
}
