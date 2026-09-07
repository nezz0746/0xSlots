import { QueryClient } from "@tanstack/react-query";

/**
 * The shared react-query configuration.
 *
 * One factory rather than `new QueryClient()` in each provider tree, because
 * the two trees are the same app — the miniapp and the web build differ in how
 * a wallet connects, not in how a failed query should behave.
 *
 * ── Why `retry` is a function ──
 *
 * The default is three attempts with exponential backoff, roughly seven seconds
 * before an error reaches the UI. That is right for a dropped connection and
 * wrong for anything the server has already given a final answer to: a query
 * the schema cannot satisfy fails identically on every attempt, so the retries
 * buy nothing and cost the user seven seconds of spinner.
 *
 * This was not theoretical. Pointed at an indexer running the retired
 * protocol's schema, every explorer query failed validation and spent that time
 * looking like a slow network rather than the wrong database.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => {
          // Marked fatal by the thrower: asking again cannot change the answer.
          if ((error as { fatal?: boolean })?.fatal) return false;
          return failureCount < 2;
        },
      },
    },
  });
}
