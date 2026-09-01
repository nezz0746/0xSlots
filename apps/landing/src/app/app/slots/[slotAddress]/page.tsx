import type { Metadata } from "next";
import { getFrameMetadata } from "@/lib/frame-metadata";
import { truncateAddress } from "@/utils";
import { SlotView } from "./slot-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slotAddress: string }>;
}): Promise<Metadata> {
  const { slotAddress } = await params;

  const { frame, metadata } = getFrameMetadata({
    title: `Slot ${truncateAddress(slotAddress)}`,
    path: `/app/slots/${slotAddress}`,
    previewPath: `/api/og/slot/${slotAddress}`,
  });

  return { ...metadata, other: { "fc:miniapp": JSON.stringify(frame) } };
}

/**
 * One slot.
 *
 * Nothing is prefetched on the server any more. Every figure on this page —
 * tax owed, solvency, seconds until liquidation — is a function of
 * `block.timestamp`, so a server-rendered snapshot is stale before it reaches
 * the browser, and the slot's own chain is a client-side selection the server
 * cannot see.
 */
export default async function SlotPage({
  params,
}: {
  params: Promise<{ slotAddress: string }>;
}) {
  const { slotAddress } = await params;
  return <SlotView slotAddress={slotAddress} />;
}
