import { ponder } from "ponder:registry";
import {
  account,
  collectiveActionEvent,
  collectiveDistributionEvent,
  collectiveRole,
  collectiveSplitRecipient,
  collectiveSplitUpdatedEvent,
  slotCollective,
} from "ponder:schema";
import { getAddress, type Hex, keccak256, toHex } from "viem";
import { SlotCollectiveAbi } from "../abis";
import { evtId, getOrCreateAccount, lower, ZERO_ADDR } from "./helpers";

/**
 * SlotCollective indexing.
 *
 * A collective fills BOTH of a slot's named addresses: `recipient` (tax flows
 * to it) and `manager` (it may propose tax and hook changes). Indexing it turns
 * those two columns on `slot` from opaque addresses into a join.
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
 *
 * ── What the port to the hook-based Slot changed, and what it did not ───────
 *
 * The payout half — roles, split membership, distributions — is untouched: a
 * `PushSplit` did not change when the slot underneath it did.
 *
 * The governance half narrowed. `UTILITY_MANAGER_ROLE` is gone; the relays are
 * `proposeTax` / `proposeHook` and their per-dimension cancels; `Dimension` has
 * two members where `UpdateKind` had three; and `LiquidationBountyRelayed` went
 * with the bounty. `POLICY_MANAGER_ROLE` is deliberately still called that even
 * though it now governs the hook — the identifier is a `keccak256` of that
 * exact string and live collectives already have holders of it.
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
  // The HOOK role. It kept the old identifier on purpose — see the file note.
  "POLICY_MANAGER_ROLE",
  // RETIRED by the port and kept here anyway. A collective deployed before it
  // and upgraded through the beacon still has the grants in its log, and
  // labelling them "UTILITY_MANAGER" is the honest reading of that history —
  // whereas a null label would suggest an unknown role rather than a dead one.
  // Nothing can be granted under this hash any more: no relay reads it.
  "UTILITY_MANAGER_ROLE",
  "SPLIT_MANAGER_ROLE",
]) {
  ROLE_LABELS[keccak256(toHex(name)).toLowerCase()] = name.replace("_ROLE", "");
}

const labelFor = (roleHash: Hex): string | null =>
  ROLE_LABELS[roleHash.toLowerCase()] ?? null;

/**
 * `Dimension` in `SlotGovernance.sol`. POSITIONAL — order must match the enum.
 *
 * Two members now, where the old `UpdateKind` had three. An out-of-range
 * ordinal maps to null rather than to a name: a third value arriving here means
 * either a legacy `Policy` proposal from a pre-port collective or an enum this
 * file has not caught up with, and both deserve a visible hole rather than a
 * guess.
 */
const KIND_NAMES = ["Tax", "Hook"] as const;
const kindName = (kind: number): string | null => KIND_NAMES[kind] ?? null;

// ── Factory ─────────────────────────────────────────────────

ponder.on(
  "SlotCollectiveFactory:SlotCollectiveDeployed",
  async ({ event, context }) => {
    await getOrCreateAccount(context, event.args.admin);
    await getOrCreateAccount(context, event.args.deployer);

    // The collective's OWN account row, typed from provenance rather than from
    // the bytecode sniff in `detectAccountType`.
    //
    // That sniff looks for the `splitHash()` selector in the deployed code, and
    // a collective is a BeaconProxy — its runtime bytecode is the proxy's, the
    // selector is in the implementation, and the scan finds nothing. Every
    // collective would otherwise be typed CONTRACT, which is the one case
    // `SPLIT` exists to name. This event is proof: an address the collective
    // factory minted IS a split, and no read is needed to know it.
    //
    // Set before the slot handlers ever see the address — a collective is
    // deployed before it can be named a slot's recipient — and `SPLIT` is not
    // one of the transitions `getOrCreateAccount` overwrites, so it holds.
    const collective = lower(event.args.collective);
    await getOrCreateAccount(context, collective);
    await context.db.update(account, { id: collective }).set({ type: "SPLIT" });

    // UPSERT, and touching only this event's own fields on conflict.
    //
    // `initializeManager` emits `SplitUpdated` from the proxy BEFORE the factory
    // emits this, in the same transaction — so the split handler usually gets
    // here first and has already created the row. A plain insert would throw on
    // that conflict, and overwriting would wipe the split it just wrote.
    //
    // Neither handler knows the other's fields, so each writes only what its own
    // event carries and leaves the rest alone. That makes the pair
    // order-independent, which is the only safe assumption: ordering across two
    // sources within one transaction is not guaranteed.
    await context.db
      .insert(slotCollective)
      .values({
        id: lower(event.args.collective),
        chainId: context.chain.id,
        admin: lower(event.args.admin),
        deployer: lower(event.args.deployer),
        splitHash: null,
        totalAllocation: 0n,
        distributionIncentive: 0,
        paused: false,
        splitRecipientCount: 0,
        createdAt: event.block.timestamp,
        createdTx: event.transaction.hash,
        updatedAt: event.block.timestamp,
      })
      .onConflictDoUpdate(() => ({
        admin: lower(event.args.admin),
        deployer: lower(event.args.deployer),
        createdAt: event.block.timestamp,
        createdTx: event.transaction.hash,
        updatedAt: event.block.timestamp,
      }));
  },
);

// ── Roles ───────────────────────────────────────────────────
//
// Rows are kept on revoke with `granted` flipped, never deleted. A former role
// holder is a fact worth showing, and deleting would make "who used to govern
// this" unanswerable.

ponder.on("SlotCollective:RoleGranted", async ({ event, context }) => {
  const role = event.args.role as Hex;
  // An address that only ever governed a collective — never bought, never was
  // paid — has no `account` row from anywhere else. This is the one thing that
  // creates it.
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

  const prev = await context.db.find(slotCollective, {
    id: collective,
    chainId,
  });
  const prevCount = prev?.splitRecipientCount ?? 0;

  // Overwrite positions 0..n-1.
  for (let i = 0; i < recipients.length; i++) {
    const account = recipients[i]!;
    const allocation = allocations[i] ?? 0n;
    // A payee who has done nothing else on this chain gets its `account` row
    // from here and nowhere else.
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
    await context.db.delete(collectiveSplitRecipient, {
      collective,
      index: i,
      chainId,
    });
  }

  await context.db.insert(collectiveSplitUpdatedEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
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

  // ── splitHash is READ, not derived ────────────────────────────────────────
  //
  // This column used to be filled from `evtId(tx, logIndex)` sliced to 64 hex
  // characters — which is the TRANSACTION HASH, spelled in a way that made it
  // look computed. Every row was wrong and every row looked plausible.
  //
  // The event carries the Split struct but not its hash, and the hash is what
  // `distribute` checks its calldata against, so the only honest sources are a
  // read or a re-implementation of `SplitV2Lib.getHash`. Read: one `eth_call`
  // per split rewrite, cached by ponder like any other, and it cannot drift
  // from the library. Null when it does not answer, rather than a placeholder.
  let splitHash: Hex | null = null;
  try {
    splitHash = (await context.client.readContract({
      address: getAddress(collective),
      abi: SlotCollectiveAbi,
      functionName: "splitHash",
    })) as Hex;
  } catch {
    splitHash = null;
  }

  // UPSERT rather than update-if-present.
  //
  // This used to be `if (prev) { update }`, which looked like tolerance for
  // out-of-order handlers and was actually silent data loss: `initializeManager`
  // emits this from the proxy BEFORE the factory emits `SlotCollectiveDeployed`,
  // so on a fresh collective `prev` is always null and the whole split — hash,
  // total, incentive, recipient count — was dropped. Every collective indexed
  // as having zero payees while its recipient rows sat there correctly.
  //
  // It compounded: `splitRecipientCount` is what a later `setSplit` uses to
  // delete the tail when a split shrinks, so a stuck 0 would have left stale
  // recipients behind forever.
  //
  // Deploy-time values are honest here — this fires in the deploy transaction,
  // so its block and tx ARE the creation ones. `SlotCollectiveDeployed` fills in
  // admin and deployer whenever it lands.
  const splitFields = {
    splitHash,
    totalAllocation: total,
    distributionIncentive: incentive,
    splitRecipientCount: recipients.length,
    updatedAt: event.block.timestamp,
  };

  await context.db
    .insert(slotCollective)
    .values({
      id: collective,
      chainId,
      admin: ZERO_ADDR,
      deployer: ZERO_ADDR,
      paused: false,
      createdAt: event.block.timestamp,
      createdTx: event.transaction.hash,
      ...splitFields,
    })
    .onConflictDoUpdate(() => splitFields);
});

ponder.on("SlotCollective:SetPaused", async ({ event, context }) => {
  const collective = lower(event.log.address);
  const chainId = context.chain.id;
  const row = await context.db.find(slotCollective, {
    id: collective,
    chainId,
  });
  if (!row) return;
  await context.db
    .update(slotCollective, { id: collective, chainId })
    .set({ paused: event.args.paused, updatedAt: event.block.timestamp });
});

// ── Governance relays ───────────────────────────────────────
//
// Why these are worth indexing at all: the SLOT's own `TermsProposed` and
// `TermsCancelled` carry no actor, and `transaction.from` is wrong exactly
// where it matters — a Safe holding a role reports whichever owner executed, a
// bundled call reports the bundler. `by` below is the actual role holder,
// recoverable from nowhere else.
//
// One relay, one slot-side event, one transaction: join on `tx` to put the WHO
// next to the WHAT.

ponder.on("SlotCollective:TermsRelayed", async ({ event, context }) => {
  await getOrCreateAccount(context, event.args.by);
  await context.db.insert(collectiveActionEvent).values({
    id: evtId(event.transaction.hash, event.log.logIndex),
    collective: lower(event.log.address),
    chainId: context.chain.id,
    slot: lower(event.args.slot),
    by: lower(event.args.by),
    action: "propose",
    kind: kindName(event.args.kind),
    // Raw bps for Tax, the widened address for Hook. The collective emits both
    // through one `bytes32`, so the column keeps that shape and `kind` says how
    // to read it.
    value: event.args.value as Hex,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    tx: event.transaction.hash,
  });
});

ponder.on("SlotCollective:TermsCancelRelayed", async ({ event, context }) => {
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

/**
 * The admin's reach across both dimensions at once.
 *
 * `kind` is null because the event names none — and unlike a per-dimension
 * cancel, this one does not say what it actually dropped. `cancelAllProposals`
 * try/catches each leg, so a collective with only a tax proposal queued emits
 * exactly the same log as one with both. The slot's own `TermsCancelled`
 * rows in the same transaction are what say which legs succeeded.
 */
ponder.on("SlotCollective:AllTermsCancelled", async ({ event, context }) => {
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
});

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
