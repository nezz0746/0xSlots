import { ponder } from "ponder:registry";
import {
  collectiveActionEvent,
  collectiveDistributionEvent,
  collectiveRole,
  collectiveSplitRecipient,
  collectiveSplitUpdatedEvent,
  slotCollective,
} from "ponder:schema";
import { type Hex, keccak256, toHex } from "viem";
import { evtId, getOrCreateAccount, lower } from "./helpers";

/**
 * SlotCollective indexing.
 *
 * A collective fills BOTH of a slot's named addresses: `recipient` (tax flows to
 * it) and `manager` (it may propose tax / utility / policy changes). Indexing it
 * turns those two columns on `slot` from opaque addresses into a join.
 *
 * Two things here exist nowhere else and are the reason this file earns its
 * keep:
 *
 *   1. ROLE MEMBERSHIP. OpenZeppelin's AccessControl keeps no enumerable member
 *      list — `hasRole` answers one address at a time. "Who governs this
 *      collective" is only answerable by replaying RoleGranted/RoleRevoked.
 *
 *   2. SPLIT MEMBERSHIP. On-chain the collective stores only `splitHash`. The
 *      recipients and allocations behind it live solely in the `SplitUpdated`
 *      log.
 *
 * Every write below touches a primary key only — no table scans — which is why
 * the split is modelled as a current-state table plus a separate event log
 * rather than as versioned rows needing a query to retire.
 */

/**
 * Role hash → readable label.
 *
 * Derived with keccak at module load rather than hardcoded hex, so renaming a
 * role in Solidity cannot silently drift from its label here: both sides read
 * from the same strings. Unknown hashes stay null rather than guessing.
 */
const ROLE_LABELS: Record<string, string> = {
  // AccessControl's implicit admin, which is not a named constant anywhere.
  [`0x${"0".repeat(64)}`]: "DEFAULT_ADMIN",
};
for (const name of [
  "TAX_MANAGER_ROLE",
  "POLICY_MANAGER_ROLE",
  "UTILITY_MANAGER_ROLE",
  "SPLIT_MANAGER_ROLE",
]) {
  ROLE_LABELS[keccak256(toHex(name)).toLowerCase()] = name.replace("_ROLE", "");
}

const labelFor = (roleHash: Hex): string | null =>
  ROLE_LABELS[roleHash.toLowerCase()] ?? null;

/** `UpdateKind` in `ISlot.sol`. Positional — order must match the enum. */
const KIND_NAMES = ["Tax", "Utility", "Policy"] as const;
const kindName = (kind: number): string | null => KIND_NAMES[kind] ?? null;

// ── Factory ─────────────────────────────────────────────────

ponder.on(
  "SlotCollectiveFactory:SlotCollectiveDeployed",
  async ({ event, context }) => {
    await getOrCreateAccount(context, event.args.admin);
    await getOrCreateAccount(context, event.args.deployer);

    await context.db.insert(slotCollective).values({
      id: lower(event.args.manager),
      chainId: context.chain.id,
      admin: lower(event.args.admin),
      deployer: lower(event.args.deployer),
      // Filled by the `SplitUpdated` that `initializeManager` emits in this same
      // transaction. Deliberately not read back with an eth_call: the log is
      // authoritative and a call would race the handler ordering.
      splitHash: null,
      totalAllocation: 0n,
      distributionIncentive: 0,
      paused: false,
      splitRecipientCount: 0,
      createdAt: event.block.timestamp,
      createdTx: event.transaction.hash,
      updatedAt: event.block.timestamp,
    });
  },
);

// ── Roles ───────────────────────────────────────────────────
//
// Rows are kept on revoke with `granted` flipped, never deleted. A former role
// holder is a fact worth showing, and deleting would make "who used to govern
// this" unanswerable.

ponder.on("SlotCollective:RoleGranted", async ({ event, context }) => {
  const role = event.args.role as Hex;
  await getOrCreateAccount(context, event.args.account);

  await context.db
    .insert(collectiveRole)
    .values({
      collective: lower(event.log.address),
      role,
      account: lower(event.args.account),
      chainId: context.chain.id,
      granted: true,
      label: labelFor(role),
      grantedAt: event.block.timestamp,
      revokedAt: null,
      updatedAt: event.block.timestamp,
    })
    .onConflictDoUpdate(() => ({
      granted: true,
      grantedAt: event.block.timestamp,
      revokedAt: null,
      updatedAt: event.block.timestamp,
    }));
});

ponder.on("SlotCollective:RoleRevoked", async ({ event, context }) => {
  const role = event.args.role as Hex;

  // Inserts rather than assuming a row: AccessControl does not require prior
  // membership for a revoke to be emitted.
  await context.db
    .insert(collectiveRole)
    .values({
      collective: lower(event.log.address),
      role,
      account: lower(event.args.account),
      chainId: context.chain.id,
      granted: false,
      label: labelFor(role),
      grantedAt: null,
      revokedAt: event.block.timestamp,
      updatedAt: event.block.timestamp,
    })
    .onConflictDoUpdate(() => ({
      granted: false,
      revokedAt: event.block.timestamp,
      updatedAt: event.block.timestamp,
    }));
});

// ── Split membership ────────────────────────────────────────

ponder.on("SlotCollective:SplitUpdated", async ({ event, context }) => {
  const collective = lower(event.log.address);
  const chainId = context.chain.id;
  const split = event.args._split;

  const recipients = split.recipients as readonly Hex[];
  const allocations = split.allocations as readonly bigint[];
  const total = split.totalAllocation as bigint;
  const incentive = Number(split.distributionIncentive ?? 0);

  const prev = await context.db.find(slotCollective, { id: collective });
  const prevCount = prev?.splitRecipientCount ?? 0;

  // Overwrite positions 0..n-1.
  for (let i = 0; i < recipients.length; i++) {
    const account = recipients[i]!;
    const allocation = allocations[i] ?? 0n;
    await getOrCreateAccount(context, account);

    const row = {
      chainId,
      account: lower(account),
      allocation,
      // Guarded: a zero total is rejected at construction but not by the type,
      // and dividing by it here would take down the whole indexer.
      shareBps: total > 0n ? Number((allocation * 10_000n) / total) : 0,
      updatedAt: event.block.timestamp,
    };

    await context.db
      .insert(collectiveSplitRecipient)
      .values({ collective, index: i, ...row })
      .onConflictDoUpdate(() => row);
  }

  // Drop the tail when the new split is shorter than the old one. This is why
  // `splitRecipientCount` is stored — without it, finding the stale rows would
  // need a scan.
  for (let i = recipients.length; i < prevCount; i++) {
    await context.db.delete(collectiveSplitRecipient, { collective, index: i });
  }

  const version = evtId(event.transaction.hash, event.log.logIndex);

  await context.db.insert(collectiveSplitUpdatedEvent).values({
    id: version,
    collective,
    chainId,
    recipients: JSON.stringify(recipients.map((r) => lower(r))),
    // Decimal strings: JSON cannot carry a bigint, and these are snapshot data
    // nothing queries inside.
    allocations: JSON.stringify(allocations.map((a) => a.toString())),
    totalAllocation: total,
    distributionIncentive: incentive,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });

  // `initializeManager` emits SplitUpdated in the deploy transaction, and
  // handler order within a transaction is not guaranteed across sources — so
  // this tolerates the collective row not existing yet.
  if (prev) {
    await context.db.update(slotCollective, { id: collective }).set({
      splitHash: `0x${version.replace(/^0x/, "").slice(0, 64)}` as Hex,
      totalAllocation: total,
      distributionIncentive: incentive,
      splitRecipientCount: recipients.length,
      updatedAt: event.block.timestamp,
    });
  }
});

ponder.on("SlotCollective:SetPaused", async ({ event, context }) => {
  const collective = lower(event.log.address);
  const row = await context.db.find(slotCollective, { id: collective });
  if (!row) return;
  await context.db
    .update(slotCollective, { id: collective })
    .set({ paused: event.args.paused, updatedAt: event.block.timestamp });
});

// ── Governance relays ───────────────────────────────────────
//
// Why these are worth indexing at all: the SLOT's own propose events carry no
// proposer, and `transaction.from` is wrong exactly where it matters — a Safe
// holding a role reports whichever owner executed, a bundled call reports the
// bundler. `by` below is the actual role holder, recoverable from nowhere else.

ponder.on("SlotCollective:UpdateRelayed", async ({ event, context }) => {
  await getOrCreateAccount(context, event.args.by);
  await context.db.insert(collectiveActionEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    collective: lower(event.log.address),
    chainId: context.chain.id,
    slot: lower(event.args.slot),
    by: lower(event.args.by),
    action: "propose",
    kind: kindName(event.args.kind),
    value: event.args.value as Hex,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

ponder.on("SlotCollective:UpdateCancelRelayed", async ({ event, context }) => {
  await getOrCreateAccount(context, event.args.by);
  await context.db.insert(collectiveActionEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    collective: lower(event.log.address),
    chainId: context.chain.id,
    slot: lower(event.args.slot),
    by: lower(event.args.by),
    action: "cancel",
    kind: kindName(event.args.kind),
    value: null,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

ponder.on(
  "SlotCollective:PendingUpdatesCancelled",
  async ({ event, context }) => {
    await getOrCreateAccount(context, event.args.by);
    await context.db.insert(collectiveActionEvent).values({
      id: evtId(event.transaction.hash, event.log.logIndex),
      collective: lower(event.log.address),
      chainId: context.chain.id,
      slot: lower(event.args.slot),
      by: lower(event.args.by),
      action: "cancelAll",
      kind: null,
      value: null,
      timestamp: event.block.timestamp,
      blockNumber: event.block.number,
      tx: event.transaction.hash,
    });
  },
);

ponder.on(
  "SlotCollective:LiquidationBountyRelayed",
  async ({ event, context }) => {
    await getOrCreateAccount(context, event.args.by);
    await context.db.insert(collectiveActionEvent).values({
      id: evtId(event.transaction.hash, event.log.logIndex),
      collective: lower(event.log.address),
      chainId: context.chain.id,
      slot: lower(event.args.slot),
      by: lower(event.args.by),
      action: "bounty",
      kind: null,
      value: `0x${event.args.newBps.toString(16).padStart(64, "0")}` as Hex,
      timestamp: event.block.timestamp,
      blockNumber: event.block.number,
      tx: event.transaction.hash,
    });
  },
);

// ── Distributions ───────────────────────────────────────────

ponder.on("SlotCollective:SplitDistributed", async ({ event, context }) => {
  await context.db.insert(collectiveDistributionEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    collective: lower(event.log.address),
    chainId: context.chain.id,
    // splits-v2 uses a sentinel address for native; kept raw so the currency
    // table can resolve it the same way the slot side does.
    token: lower(event.args.token),
    distributor: lower(event.args.distributor),
    amount: event.args.amount,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});
