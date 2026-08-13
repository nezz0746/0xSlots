import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import type { Metadata } from "next";
import { Suspense } from "react";
import {
  slotActivityQueryOptions,
  slotQueryOptions,
} from "@/hooks/slot-queries";
import { getChainFromSearchParams } from "@/lib/config";
import { getFrameMetadata } from "@/lib/frame-metadata";
import { truncateAddress } from "@/utils";
import { SlotPageContent } from "./slot-page-content";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slotAddress: string }>;
}): Promise<Metadata> {
  const { slotAddress } = await params;
  const truncated = truncateAddress(slotAddress);

  const { frame, metadata } = getFrameMetadata({
    title: `Slot ${truncated}`,
    // The explorer lives under /app — this is the URL the miniapp opens.
    path: `/app/slots/${slotAddress}`,
    // previewPath is an API route and did NOT move.
    previewPath: `/api/og/slot/${slotAddress}`,
  });

  return {
    ...metadata,
    other: {
      "fc:miniapp": JSON.stringify(frame),
    },
  };
}

export default async function SlotPage({
  params,
  searchParams,
}: {
  params: Promise<{ slotAddress: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slotAddress } = await params;
  const chainId = getChainFromSearchParams(await searchParams);

  const queryClient = new QueryClient();

  await Promise.all([
    queryClient.prefetchQuery(slotQueryOptions(chainId, slotAddress)),
    queryClient.prefetchQuery(slotActivityQueryOptions(chainId, slotAddress)),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense
        fallback={
          <div className="min-h-screen">
            <div className="max-w-6xl mx-auto px-6 py-12">
              <div className="rounded-lg border p-12 text-center animate-pulse">
                <p className="text-sm text-muted-foreground">Loading slot...</p>
              </div>
            </div>
          </div>
        }
      >
        <SlotPageContent slotAddress={slotAddress} />
      </Suspense>
    </HydrationBoundary>
  );
}
