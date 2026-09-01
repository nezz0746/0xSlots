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

/**
 * The `/app/contracts` page — every deployed address, its version, and who can
 * upgrade it.
 *
 * Local-only, and the reason is not secrecy: the addresses are public and the
 * page reads nothing a block explorer would not tell you. It is that the page
 * answers an operator's question ("which code is behind this proxy on this
 * chain, and who holds the key") and a visitor asking it means something has
 * already gone wrong. Keeping it out of a production build keeps the app's
 * surface honest about who it is for.
 *
 * Force it on for a staging preview with `NEXT_PUBLIC_ENABLE_CONTRACTS=1`.
 */
export const CONTRACTS_PAGE_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_CONTRACTS === "1" ||
  process.env.NODE_ENV !== "production";
