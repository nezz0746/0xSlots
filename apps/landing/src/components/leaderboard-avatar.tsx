"use client";

import { useState } from "react";

/**
 * A leaderboard occupant's picture.
 *
 * Renders the resolved Farcaster / ENS avatar, and falls back to a
 * deterministic gradient derived from the address whenever there is no avatar
 * OR the image fails to load. That `onError` path is the reason this is a
 * client component: some ENS avatars resolve to content that no gateway can
 * actually serve, and a broken-image icon is worse than a clean coloured disc.
 */
export function LeaderboardAvatar({
  address,
  avatar,
}: {
  address: string;
  avatar: string | null;
}) {
  const [failed, setFailed] = useState(false);

  if (avatar && !failed) {
    return (
      // biome-ignore lint/performance/noImgElement: arbitrary remote avatar hosts
      <img
        src={avatar}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className="size-8 shrink-0 rounded-full bg-muted object-cover"
      />
    );
  }

  const hue = Number.parseInt(address.slice(2, 8), 16) % 360;
  return (
    <span
      aria-hidden
      className="size-8 shrink-0 rounded-full"
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 70% 60%), hsl(${(hue + 45) % 360} 70% 48%))`,
      }}
    />
  );
}
