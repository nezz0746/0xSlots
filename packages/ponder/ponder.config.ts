import { buildLocalConfig } from "./config/local";
import { buildRemoteConfig } from "./config/remote";

// ═══════════════════════════════════════════════════════════════════════════
// THE V1 SLOTS PROTOCOL
//
//   config/remote.ts       base, base-sepolia, sepolia
//   config/local.ts        anvil, with PONDER_LOCAL=1
//   config/deployments.ts  addresses and start blocks, from the deploy records
//   config/rpc.ts          which endpoints each chain syncs from
//   config/events.ts       the factory events child contracts are found by
//
// ── One creation function, one source ──────────────────────────────────────
//
// `SlotFactory` has exactly ONE creation function taking one `SlotInit`
// struct, and one `SlotCreated` event, so there is a single `Slot` source and
// src/slot.ts registers each handler once. A new slot parameter goes into
// `SlotInit`; it must never become a suffixed second creator, because that
// splits every source in two again.
//
// ── Discovering slots: factory() on SlotCreated ────────────────────────────
//
// Slots are BeaconProxies, so their addresses are only knowable from the
// factory's own log. `factory()` on `SlotCreated` watches every slot address
// directly, which keeps viem's typed decoding and keeps `event.log.address`
// meaning the slot. Collectives, collections and wrappers are found the same
// way from their own factories.
// ═══════════════════════════════════════════════════════════════════════════

type RemoteConfig = ReturnType<typeof buildRemoteConfig>;

/**
 * The remote config is the type witness even when running locally.
 *
 * Ponder derives `context.chain` from `config.contracts[source].chain`, so
 * exporting a union of the two configs collapses every handler's
 * `context.chain` to `unknown`. Pinning the type to one of them keeps all of
 * src/ inferring correctly; the two differ only in chain identity, and
 * handlers read nothing from `context.chain` but `.id`, which is a number in
 * both.
 */
export default process.env.PONDER_LOCAL === "1"
  ? (buildLocalConfig() as unknown as RemoteConfig)
  : buildRemoteConfig();
