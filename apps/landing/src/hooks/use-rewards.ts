"use client";

import { useQuery } from "@tanstack/react-query";
import { useChain } from "@/context/chain";
import { computeLeaderboard } from "@/lib/rewards";

// Re-exported so in-app callers can keep importing everything from one place.
export {
  type LeaderboardEntry,
  POINTS_PER_BUY,
  POINTS_PER_HOUR,
  pointsFor,
} from "@/lib/rewards";

/**
 * The leaderboard for one explicit chain.
 *
 * Split from {@link useLeaderboard} so a surface without the app's chain
 * selector — the marketing site — could show a board for a fixed chain. The
 * heavy lifting lives in `lib/rewards` so the server-rendered marketing page
 * shares the exact same formula.
 */
export function useLeaderboardFor(chainId: number) {
  return useQuery({
    queryKey: ["rewards-leaderboard", chainId],
    queryFn: ({ signal }) =>
      computeLeaderboard(chainId, Math.floor(Date.now() / 1000), signal),
  });
}

/** The leaderboard for the app's currently-selected chain. */
export function useLeaderboard() {
  const { chainId } = useChain();
  return useLeaderboardFor(chainId);
}
