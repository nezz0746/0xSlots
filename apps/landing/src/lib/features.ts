/**
 * Feature flags.
 *
 * Read from the environment so they are inlined at build time and cost nothing
 * at runtime — a disabled feature's nav link and route simply are not there.
 */

/**
 * The reward program — the Slot Points leaderboard, its `/app/rewards` page, and
 * the public `/leaderboard`. Local-only for now.
 *
 * `NODE_ENV` is "development" under `next dev` and "production" under a built
 * deploy, so this is on while working locally and off in production. Force it on
 * for a staging preview (or when it is ready to ship) with
 * `NEXT_PUBLIC_ENABLE_REWARDS=1`.
 */
export const REWARDS_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_REWARDS === "1" ||
  process.env.NODE_ENV !== "production";
