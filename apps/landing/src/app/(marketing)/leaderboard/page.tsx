import { SlotsChain } from "@0xslots/sdk";
import { Clock, ShoppingCart } from "lucide-react";
import type { Metadata } from "next";
import { LeaderboardAvatar } from "@/components/leaderboard-avatar";
import { type Profile, resolveProfiles } from "@/lib/profiles";
import {
  computeLeaderboard,
  type LeaderboardEntry,
  POINTS_PER_BUY,
  POINTS_PER_HOUR,
} from "@/lib/rewards";
import { formatDuration, truncateAddress } from "@/utils";

export const metadata: Metadata = {
  title: "Leaderboard",
  description:
    "Slot Points — every occupant of every 0xSlots slot earns, ranked by how long they hold and how much they use their slots.",
  alternates: { canonical: "/leaderboard" },
};

// Server-rendered and cached: the marketing side carries no wallet or query
// provider, so this fetches on the server and revalidates. `computeLeaderboard`
// caches its own indexer fetch on the same interval.
export const revalidate = 120;

// The public board is Base. Testnets are for the in-app, chain-switched view.
const CHAIN = SlotsChain.BASE;

export default async function LeaderboardPage() {
  let entries: LeaderboardEntry[] = [];
  let failed = false;
  try {
    entries = await computeLeaderboard(CHAIN, Math.floor(Date.now() / 1000));
  } catch {
    failed = true;
  }

  // ENS names + avatars, resolved server-side. A failure here degrades to a
  // truncated address rather than failing the page, so the board renders even
  // if L1 is unreachable.
  const profiles = await resolveProfiles(entries.map((e) => e.account)).catch(
    () => new Map<string, Profile>(),
  );

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10 md:px-6 md:py-16">
      <p className="eyebrow">Slot Points</p>
      <h1 className="display mt-3 text-[clamp(1.8rem,5vw,2.8rem)]">
        The <span className="text-destructive">leaderboard</span>
      </h1>
      <p className="mt-4 max-w-xl text-base leading-relaxed text-foreground/80">
        Every occupant of every slot earns points — no eligibility list, no
        curation. You climb by holding slots and using them, and anyone can
        recompute a rank from public indexer data.
      </p>

      {/* ── Board ─────────────────────────────────────────── */}
      <div className="mt-10">
        {failed ? (
          <p className="border p-6 text-sm text-muted-foreground">
            The leaderboard is temporarily unavailable.
          </p>
        ) : entries.length === 0 ? (
          <p className="border p-6 text-sm text-muted-foreground">
            No occupants have earned points yet. Hold a slot to get on the
            board.
          </p>
        ) : (
          <div className="border">
            <div className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-4 border-b bg-muted/40 px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground md:grid-cols-[2.5rem_1fr_7rem_5rem_6rem]">
              <span>#</span>
              <span>Occupant</span>
              <span className="hidden text-right md:block">Held</span>
              <span className="hidden text-right md:block">Buys</span>
              <span className="text-right">Points</span>
            </div>
            <div className="divide-y">
              {entries.map((e) => (
                <Row
                  key={e.account}
                  entry={e}
                  profile={profiles.get(e.account.toLowerCase())}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Rules ─────────────────────────────────────────── */}
      <div className="mt-12">
        <h2 className="text-sm font-semibold uppercase tracking-wider">
          How points work
        </h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Rule
            icon={Clock}
            title={`${POINTS_PER_HOUR} point / hour held`}
            body="For every hour you occupy a slot. Squatting an idle slot still costs its tax, so points and cost move together — you earn by being a real, paying occupant, not by parking cheaply. Time you are holding right now counts live."
          />
          <Rule
            icon={ShoppingCart}
            title={`${POINTS_PER_BUY} points / buy`}
            body="For each slot you buy. A buy is not free to farm — it costs the price plus a deposit — and it is what puts you in a slot to begin with. Hold time then rewards keeping it."
          />
        </div>
        <p className="mt-3 max-w-2xl text-xs leading-relaxed text-muted-foreground">
          Only the two things every slot has in common count: time held and
          purchases. Posting, modules and tax are left out — tax is priced in
          each slot's own currency and would not sum, and posting only happens
          on some slots, so it would reward the module a slot runs rather than
          its occupant. A green dot marks occupants holding a slot right now.
          This board is Base; switch chains inside the app.
        </p>
      </div>
    </section>
  );
}

function Row({
  entry,
  profile,
}: {
  entry: LeaderboardEntry;
  profile?: Profile;
}) {
  const medal =
    entry.rank === 1
      ? "text-amber-500"
      : entry.rank === 2
        ? "text-zinc-400"
        : entry.rank === 3
          ? "text-amber-700"
          : "text-muted-foreground";

  const displayName = profile?.name ?? truncateAddress(entry.account);
  // Only show the address as a second line when the first line is a NAME —
  // otherwise it would just repeat the address.
  const subAddress = profile?.name ? truncateAddress(entry.account) : null;

  return (
    <div className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-4 px-4 py-3 md:grid-cols-[2.5rem_1fr_7rem_5rem_6rem]">
      <span className={`text-sm font-bold tabular-nums ${medal}`}>
        {entry.rank}
      </span>

      <div className="flex min-w-0 items-center gap-2.5">
        <LeaderboardAvatar
          address={entry.account}
          avatar={profile?.avatar ?? null}
        />
        <div className="min-w-0">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-xs font-medium md:text-sm">
              {displayName}
            </span>
            {entry.activeSlots > 0 && (
              <span
                title={`Holding ${entry.activeSlots} slot${entry.activeSlots > 1 ? "s" : ""} now`}
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400"
              >
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                holding{entry.activeSlots > 1 ? ` ${entry.activeSlots}` : ""}
              </span>
            )}
          </span>
          {/* The address under a name, desktop only — on mobile it shares the
              metrics line below to save a row. */}
          {subAddress && (
            <span className="mt-0.5 hidden truncate text-[11px] text-muted-foreground md:block">
              {subAddress}
            </span>
          )}
          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground md:hidden">
            {subAddress ? `${subAddress} · ` : ""}
            {formatDuration(entry.holdSeconds)} · {entry.buys} buys
          </span>
        </div>
      </div>

      <span className="hidden text-right text-xs tabular-nums text-muted-foreground md:block">
        {formatDuration(entry.holdSeconds)}
      </span>
      <span className="hidden text-right text-xs tabular-nums text-muted-foreground md:block">
        {entry.buys}
      </span>
      <span className="text-right text-base font-semibold tabular-nums">
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
    <div className="border p-3">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-muted-foreground" />
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
        {body}
      </p>
    </div>
  );
}
