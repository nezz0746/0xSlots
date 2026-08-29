"use client";

import { Clock, ShoppingCart, Trophy } from "lucide-react";
import { CopyAddress } from "@/components/copy-address";
import { PageHeader } from "@/components/page-header";
import {
  type LeaderboardEntry,
  POINTS_PER_BUY,
  POINTS_PER_HOUR,
  useLeaderboard,
} from "@/hooks/use-rewards";
import { formatDuration } from "@/utils";

/**
 * Slot Points — the leaderboard, and the rules that produce it.
 *
 * One page on purpose: a leaderboard nobody can check is a black box. The rules
 * sit right under it, quoting the exact constants the numbers are computed from,
 * so a rank is always reproducible from public indexer data.
 */
export default function RewardsPage() {
  const { data: entries, isLoading, error } = useLeaderboard();

  return (
    <div className="min-h-screen">
      <PageHeader>
        <div className="flex items-center gap-3">
          <Trophy className="size-5 text-muted-foreground" />
          <div>
            <h1 className="text-xl font-bold leading-tight tracking-tight">
              Slot Points
            </h1>
            <p className="text-xs text-muted-foreground">
              Rewards for holding and using slots — every occupant earns
            </p>
          </div>
        </div>
      </PageHeader>

      <div className="w-full space-y-6 px-3 py-4 md:px-5">
        {/* ── Leaderboard ─────────────────────────────────── */}
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider">
            Leaderboard
          </h2>

          {isLoading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : error ? (
            <p className="text-xs text-red-600 dark:text-red-500">
              Could not reach the indexer.
            </p>
          ) : !entries?.length ? (
            <p className="border px-3 py-6 text-center text-xs text-muted-foreground">
              No occupants have earned points on this network yet. Hold a slot
              to get on the board.
            </p>
          ) : (
            <div className="border">
              <div className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 border-b bg-muted/40 px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground md:grid-cols-[2rem_1fr_6rem_5rem_5rem]">
                <span>#</span>
                <span>Occupant</span>
                <span className="hidden text-right md:block">Held</span>
                <span className="hidden text-right md:block">Buys</span>
                <span className="text-right">Points</span>
              </div>
              <div className="divide-y">
                {entries.map((e) => (
                  <Row key={e.account} entry={e} />
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── Rules ───────────────────────────────────────── */}
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider">
            How points work
          </h2>
          <div className="space-y-2 border p-3 text-xs leading-relaxed">
            <p className="text-muted-foreground">
              Points reward what the protocol is built on: holding a slot and
              using it. There is no eligibility list — every occupant of every
              slot earns, and a rank is computable by anyone from public indexer
              data. The board is per-network.
            </p>

            <div className="grid gap-2 sm:grid-cols-2">
              <Rule
                icon={Clock}
                title={`${POINTS_PER_HOUR} point / hour held`}
                body="For every hour you occupy a slot. Squatting an idle slot still costs its tax, so points and cost move together — you earn by being a real, paying occupant, not by parking cheaply."
              />
              <Rule
                icon={ShoppingCart}
                title={`${POINTS_PER_BUY} points / buy`}
                body="For each slot you buy. A buy costs the price plus a deposit, and it is what puts you in a slot to begin with; hold time then rewards keeping it."
              />
            </div>

            <p className="text-[11px] text-muted-foreground">
              Tax paid is deliberately not counted: each slot is priced in its
              own currency, so tax across your slots would add numbers that
              share no unit. Time held and buys are the two things every slot
              has in common, so they sum honestly. A slot you are holding right
              now counts live, so current occupants are never missing.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function Row({ entry }: { entry: LeaderboardEntry }) {
  const medal =
    entry.rank === 1
      ? "text-amber-500"
      : entry.rank === 2
        ? "text-zinc-400"
        : entry.rank === 3
          ? "text-amber-700"
          : "text-muted-foreground";

  return (
    <div className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 px-3 py-2 md:grid-cols-[2rem_1fr_6rem_5rem_5rem]">
      <span className={`text-xs font-bold tabular-nums ${medal}`}>
        {entry.rank}
      </span>
      <div className="min-w-0">
        <CopyAddress address={entry.account} ens />
        <span className="mt-0.5 block text-[10px] text-muted-foreground md:hidden">
          {formatDuration(entry.holdSeconds)} · {entry.buys} buys
        </span>
      </div>
      <span className="hidden text-right text-[11px] tabular-nums text-muted-foreground md:block">
        {formatDuration(entry.holdSeconds)}
      </span>
      <span className="hidden text-right text-[11px] tabular-nums text-muted-foreground md:block">
        {entry.buys}
      </span>
      <span className="text-right text-sm font-semibold tabular-nums">
        {entry.points.toLocaleString()}
      </span>
    </div>
  );
}

function Rule({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Clock;
  title: string;
  body: string;
}) {
  return (
    <div className="border p-2">
      <div className="flex items-center gap-1.5">
        <Icon className="size-3.5 text-muted-foreground" />
        <span className="text-[11px] font-semibold">{title}</span>
      </div>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
        {body}
      </p>
    </div>
  );
}
