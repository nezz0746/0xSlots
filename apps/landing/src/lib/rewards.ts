import { type Address, zeroAddress } from "viem";
import { indexerUrlFor } from "@/lib/indexer";

/**
 * Slot Points — the reward program's pure logic, with no React and no client
 * boundary, so BOTH the in-app client hook (`use-rewards`) and the server-
 * rendered marketing page can share one source of truth for the formula.
 *
 * Every occupant of every slot earns; there is no eligibility list. Points come
 * from HOLD TIME and ACTIVITY — both currency-agnostic — and deliberately NOT
 * from tax paid, which is denominated in each slot's own currency and cannot be
 * summed across a person's slots without adding numbers that share no unit.
 */

/** Points per HOUR a slot is occupied — the core "you were a paying occupant" signal. */
export const POINTS_PER_HOUR = 1;

/**
 * Points per BUY — one slot purchase (a `Bought` event).
 *
 * Rewards taking part in the market. This replaced a "posts" metric, which
 * counted metadata updates — but those only happen on module-bearing slots, so
 * they measured which MODULE a slot ran, not what its occupant did. A buy and
 * an hour held are universal to every slot, module or not. And a buy is not
 * free to farm: each one costs a deposit plus the price.
 */
export const POINTS_PER_BUY = 50;

/**
 * The scoring window: only activity in the last N days counts.
 *
 * Rolling ("a month ago from now"), recomputed each render. To run a fixed
 * season instead — accumulating from a launch date rather than a moving 30-day
 * window — replace the derived start in `computeLeaderboard` with an absolute
 * unix timestamp.
 */
export const REWARDS_WINDOW_DAYS = 30;

/**
 * Addresses excluded from the board, lowercased. Empty for now.
 *
 * For team wallets, the faucet, test churners — anyone whose ranking would be
 * noise rather than a real occupant. Applied to both occupants and buyers.
 */
export const REWARDS_BLACKLIST: ReadonlySet<string> = new Set<string>([
  // "0x…",
]);

export interface LeaderboardEntry {
  rank: number;
  account: Address;
  points: number;
  /** Seconds occupied, summed across the account's slots on this chain. */
  holdSeconds: number;
  /** Slot purchases (`Bought` events) by this account on this chain. */
  buys: number;
  /** Distinct slots the account has occupied. */
  slots: number;
  /** Slots the account is holding RIGHT NOW (an open, unbooked occupancy). */
  activeSlots: number;
}

interface AccountSlotRow {
  account: Address;
  slot: Address;
  holdTime: string;
  /** Set while the account is CURRENTLY occupying this slot; null otherwise. */
  lastOccupiedAt: string | null;
}

interface BoughtRow {
  buyer: Address;
}

// Two roots in one request: current occupancies from `accountSlots`, and buys
// WITHIN THE WINDOW from `boughtEvents` (filtered by `timestamp_gte: $start`).
//
// No `holdTime_gt` filter on accountSlots, on purpose. `holdTime` only absorbs a
// period when the occupancy ENDS — while someone is still holding, it reads 0
// and their live time lives in `lastOccupiedAt`. We fetch all rows and window
// the hold in JS from `lastOccupiedAt`.
const QUERY = /* GraphQL */ `
  query Leaderboard($chainId: Int!, $start: BigInt!) {
    accountSlots(
      where: { chainId: $chainId }
      orderBy: "lastInteractedAt"
      orderDirection: "desc"
      limit: 1000
    ) {
      items {
        account
        slot
        holdTime
        lastOccupiedAt
      }
    }
    boughtEvents(
      where: { chainId: $chainId, timestamp_gte: $start }
      limit: 1000
    ) {
      items {
        buyer
      }
    }
  }
`;

/** Points for one aggregated occupant. Pure, so any surface can quote it. */
export function pointsFor(holdSeconds: number, buys: number): number {
  return (
    Math.round((holdSeconds / 3600) * POINTS_PER_HOUR) + buys * POINTS_PER_BUY
  );
}

/**
 * Fetch, aggregate and rank the leaderboard for one chain.
 *
 * @param nowSeconds current unix time — passed in rather than read here so the
 *   caller controls it: the client hook uses `Date.now()`, a server render uses
 *   its render time, and both stay testable.
 */
export async function computeLeaderboard(
  chainId: number,
  nowSeconds: number,
  signal?: AbortSignal,
): Promise<LeaderboardEntry[]> {
  // Rolling window start. Buys are filtered by it server-side; hold time is
  // clipped to it below.
  const start = nowSeconds - REWARDS_WINDOW_DAYS * 86_400;

  const res = await fetch(indexerUrlFor(chainId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: QUERY,
      variables: { chainId, start: String(start) },
    }),
    signal,
    // Server renders cache this; a client fetch ignores it.
    next: { revalidate: 120 },
  });
  if (!res.ok) throw new Error(`Indexer ${res.status}`);

  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(json.errors[0]?.message ?? "Query failed");
  }

  const rows: AccountSlotRow[] = json.data?.accountSlots?.items ?? [];
  const bought: BoughtRow[] = json.data?.boughtEvents?.items ?? [];

  const byAccount = new Map<
    string,
    {
      holdSeconds: number;
      buys: number;
      slots: number;
      activeSlots: number;
    }
  >();
  const seed = (key: string) => {
    const acc = byAccount.get(key) ?? {
      holdSeconds: 0,
      buys: 0,
      slots: 0,
      activeSlots: 0,
    };
    byAccount.set(key, acc);
    return acc;
  };

  const excluded = (key: string) =>
    key === zeroAddress || REWARDS_BLACKLIST.has(key);

  for (const r of rows) {
    const key = r.account.toLowerCase();
    // Zero address is a synthetic occupant; the blacklist is team/faucet/test
    // wallets. Neither belongs on the board.
    if (excluded(key)) continue;
    const acc = seed(key);
    // Windowed hold. `lastOccupiedAt` set == holding right now, and it is the
    // start of the still-open occupancy. Count only time inside the window,
    // clipping the start to it. Closed past occupancies (booked `holdTime`) are
    // NOT counted — they belong to earlier windows, and for anyone STILL holding
    // the current period already captures their in-window time here.
    const holdingNow = r.lastOccupiedAt != null;
    if (holdingNow) {
      acc.holdSeconds += Math.max(
        0,
        nowSeconds - Math.max(Number(r.lastOccupiedAt), start),
      );
      acc.activeSlots += 1;
    }
    acc.slots += 1;
  }

  for (const b of bought) {
    const key = b.buyer.toLowerCase();
    if (excluded(key)) continue;
    seed(key).buys += 1;
  }

  return (
    [...byAccount.entries()]
      .map(([account, a]) => ({
        account: account as Address,
        points: pointsFor(a.holdSeconds, a.buys),
        holdSeconds: a.holdSeconds,
        buys: a.buys,
        slots: a.slots,
        activeSlots: a.activeSlots,
      }))
      // A row can exist with no hold and no buys (an occupancy that opened and
      // closed in one block). Zero points is not a rank.
      .filter((e) => e.points > 0)
      .sort((x, y) => y.points - x.points)
      .map((e, i) => ({ rank: i + 1, ...e }))
  );
}
