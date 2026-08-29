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

// Two roots in one request: hold time from `accountSlots`, buy counts from
// `boughtEvents`.
//
// No `holdTime_gt` filter, on purpose. `holdTime` only absorbs a period when
// the occupancy ENDS — while someone is still holding, it reads 0 and their
// live time lives in `lastOccupiedAt`. Filtering on `holdTime > 0` therefore
// dropped every current occupant whose hold had not been booked yet: on Base
// that hid a holder sitting on a slot for ~140 days. We fetch all rows and
// discard the truly-empty ones by computed points instead.
const QUERY = /* GraphQL */ `
  query Leaderboard($chainId: Int!) {
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
    boughtEvents(where: { chainId: $chainId }, limit: 1000) {
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
  const res = await fetch(indexerUrlFor(chainId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { chainId } }),
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

  for (const r of rows) {
    const key = r.account.toLowerCase();
    // The zero address turns up as a synthetic occupant (e.g. metadata written
    // against a vacated slot). It is nobody, and it should not sit on a public
    // leaderboard, so it is dropped rather than ranked.
    if (key === zeroAddress) continue;
    const acc = seed(key);
    // `lastOccupiedAt` set == holding right now. It is also the start of the
    // still-open occupancy: booked `holdTime` (closed periods only) plus the
    // time since it began, with no overlap to double-count.
    const holdingNow = r.lastOccupiedAt != null;
    const live = holdingNow
      ? Math.max(0, nowSeconds - Number(r.lastOccupiedAt))
      : 0;
    acc.holdSeconds += Number(r.holdTime) + live;
    acc.slots += 1;
    if (holdingNow) acc.activeSlots += 1;
  }

  for (const b of bought) {
    const key = b.buyer.toLowerCase();
    if (key === zeroAddress) continue;
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
