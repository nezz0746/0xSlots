import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import { Suspense } from "react";
import { slotsByRecipientQueryOptions } from "@/hooks/slot-queries";
import { getChainFromSearchParams } from "@/lib/config";

import { RecipientPageContent } from "./recipient-page-content";

export default async function RecipientPage({
  params,
  searchParams,
}: {
  params: Promise<{ address: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { address } = await params;
  const chainId = getChainFromSearchParams(await searchParams);

  const queryClient = new QueryClient();

  await queryClient.prefetchQuery(
    slotsByRecipientQueryOptions(chainId, address),
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense
        fallback={
          <div className="min-h-screen">
            <div className="max-w-6xl mx-auto px-6 py-12">
              <div className="rounded-lg border p-12 text-center animate-pulse">
                <p className="text-sm text-muted-foreground">
                  Loading recipient...
                </p>
              </div>
            </div>
          </div>
        }
      >
        <RecipientPageContent address={address} />
      </Suspense>
    </HydrationBoundary>
  );
}
