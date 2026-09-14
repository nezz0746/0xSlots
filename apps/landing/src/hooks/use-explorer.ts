"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { Address } from "viem";
import { MONTH_SECONDS } from "@/constants";
import { useChain } from "@/context/chain";
import type { AccountType } from "@/lib/indexer";
import { indexerUrlFor } from "@/lib/indexer";

/**
 * Everything the explorer reads out of the indexer.
 *
 * This is the successor to `use-v3.ts`, which spoke to the subgraph through the
 * SDK's generated client. Two things forced a rewrite rather than a rename:
 *
 *   * The SDK's types are produced by graphql-codegen against a RUNNING ponder
 *     instance (packages/sdk/codegen.yml), and the checked-in `generated/` still
 *     describes the PREVIOUS protocol — modules, policies, liquidation bounties.
 *     Importing `SlotFieldsFragment` from it would typecheck and then ask the
 *     indexer for columns that no longer exist.
 *   * Ponder paginates by CURSOR (`limit`/`after`/`before`), not by offset. The
 *     old `{ first, skip }` shape has no equivalent, so the callers page with a
 *     cursor stack instead. See `useExplorerSlots`.
 *
 * The raw-fetch style is deliberate and matches `hooks/use-collectives.ts`: one
 * endpoint per chain from `indexerUrlFor`, hand-written documents, row types
 * declared here. Move this into the SDK once codegen has run against the
 * hook-based indexer.
 */

/**
 * A query this indexer will never answer, however many times it is asked.
 *
 * GraphQL separates VALIDATION failures from execution ones, and the difference
 * matters here: a field the schema does not have is not a blip, it is the wrong
 * database. Retrying it three times behind a spinner turned "this instance runs
 * the old schema" into "the network is slow" — and it was not hypothetical.
 * With `NEXT_PUBLIC_SLOTS_ENV` unset, the app read the production instance,
 * which still serves the retired protocol: no `hook`, no `hookRef`, no
 * `tenureId`. Every explorer query failed validation and took about seven
 * seconds of exponential backoff to say so.
 */
export class IndexerSchemaError extends Error {
  readonly fatal = true;
  constructor(message: string) {
    super(message);
    this.name = "IndexerSchemaError";
  }
}

async function indexerFetch<T>(
  chainId: number,
  query: string,
  variables: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const res = await fetch(indexerUrlFor(chainId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    signal,
  });
  if (!res.ok) throw new Error(`Indexer ${res.status}`);

  const json = await res.json();
  if (json.errors?.length) {
    const first = json.errors[0];
    const message: string = first?.message ?? "Query failed";

    if (first?.extensions?.code === "GRAPHQL_VALIDATION_FAILED") {
      const fields = json.errors
        .map(
          (e: { message?: string }) =>
            /Cannot query field "([^"]+)"/.exec(e.message ?? "")?.[1],
        )
        .filter(Boolean)
        .slice(0, 4);
      throw new IndexerSchemaError(
        `This indexer is running a different schema${
          fields.length ? ` — it has no ${fields.join(", ")}` : ""
        }. Check NEXT_PUBLIC_SLOTS_ENV.`,
      );
    }
    throw new Error(message);
  }
  return json.data as T;
}

// ──────────────────────────────────────────
// Row types
// ──────────────────────────────────────────

interface AccountRef {
  type: AccountType;
}

interface CurrencyRef {
  symbol: string | null;
  decimals: number;
}

/**
 * The hook a slot points at, as the indexer sees it TODAY.
 *
 * `declared*` here and `hook*` on the slot are two different facts and the
 * schema stores both on purpose: the slot obeys the snapshot it took when the
 * hook was attached, and a hook behind a proxy can change its declaration
 * afterwards. A row where they disagree is the interesting one.
 */
export interface HookRow {
  id: Address;
  declaredKnown: boolean;
  slotCount: number;
  failedCallCount: number;
}

export interface ExplorerSlot {
  id: Address;
  chainId: number;
  recipient: Address;
  recipientAccountRef: AccountRef | null;
  occupant: Address | null;
  occupantAccountRef: AccountRef | null;
  isOccupied: boolean;
  currency: Address;
  currencyRef: CurrencyRef | null;
  price: string;
  deposit: string;
  taxBps: string;
  minDepositSeconds: string;
  /** Null is an ordinary configuration — the plain Harberger slot. */
  hook: Address | null;
  hookRef: HookRow | null;
  mutableTax: boolean;
  mutableHook: boolean;
  /**
   * A queued term change. Two independent dimensions sharing one deferral, so
   * both booleans are read: a queued hook change TO the zero address means
   * "detach the hook", which `pendingHook` alone cannot express.
   */
  pendingHasTax: boolean;
  pendingHasHook: boolean;
  createdAt: string;
  /**
   * When tax was last realised out of `deposit`. Null on rows written before
   * the column existed — see {@link isInsolventAt}, which reports "cannot say"
   * rather than guessing.
   */
  lastSettled: string | null;
}

export interface AccountChainRow {
  account: Address;
  slotCount: number;
  occupiedCount: number;
  occupiedAsRecipient: number;
  accountRef: AccountRef | null;
}

const SLOT_FIELDS = /* GraphQL */ `
  id
  chainId
  recipient
  recipientAccountRef {
    type
  }
  occupant
  occupantAccountRef {
    type
  }
  isOccupied
  currency
  currencyRef {
    symbol
    decimals
  }
  price
  deposit
  taxBps
  minDepositSeconds
  hook
  hookRef {
    id
    declaredKnown
    slotCount
    failedCallCount
  }
  mutableTax
  mutableHook
  pendingHasTax
  pendingHasHook
  createdAt
  lastSettled
`;

// ──────────────────────────────────────────
// Counts
// ──────────────────────────────────────────

const COUNTS_QUERY = /* GraphQL */ `
  query SlotCounts($chainId: Int!) {
    total: slots(where: { chainId: $chainId }, limit: 1) {
      totalCount
    }
    occupied: slots(
      where: { chainId: $chainId, isOccupied: true }
      limit: 1
    ) {
      totalCount
    }
  }
`;

/**
 * Protocol totals for the active chain.
 *
 * All three numbers come from the SAME source, as server-side `totalCount`s.
 * They used to have two — a global count from the factory beside occupancy
 * counted from a 100-row page — so the strip read "239 slots, 13 occupied,
 * 87 vacant" and the last two summed to the page size rather than to the first.
 * Vacant is derived here rather than asked for, which is what keeps the three
 * consistent by construction.
 */
export function useSlotCounts() {
  const { chainId } = useChain();

  return useQuery({
    queryKey: ["explorer", "slot-counts", chainId],
    refetchInterval: 15_000,
    queryFn: async ({ signal }) => {
      const data = await indexerFetch<{
        total: { totalCount: number };
        occupied: { totalCount: number };
      }>(chainId, COUNTS_QUERY, { chainId }, signal);

      const total = data.total?.totalCount ?? 0;
      const occupied = data.occupied?.totalCount ?? 0;
      return { total, occupied, vacant: Math.max(0, total - occupied) };
    },
  });
}

// ──────────────────────────────────────────
// Recipients
// ──────────────────────────────────────────

const ACCOUNTS_QUERY = /* GraphQL */ `
  query Recipients($chainId: Int!) {
    accountChains(
      where: { chainId: $chainId, slotCount_gt: 0 }
      orderBy: "slotCount"
      orderDirection: "desc"
      limit: 500
    ) {
      items {
        account
        slotCount
        occupiedCount
        occupiedAsRecipient
        accountRef {
          type
        }
      }
    }
  }
`;

/**
 * Every account that RECEIVES tax on this chain.
 *
 * `accountChain`, never `account`: the identity table has no `chainId` and its
 * counters are totals across every chain, so a single-chain screen reading it
 * would list base-sepolia's recipients on base with their base-sepolia counts.
 *
 * `slotCount_gt: 0` is what makes this a recipients list rather than an
 * everybody list — an account with a row here and no slots of its own is a pure
 * occupant, and belongs to a different question.
 */
export function useAccounts() {
  const { chainId } = useChain();

  return useQuery({
    queryKey: ["explorer", "recipients", chainId],
    queryFn: async ({ signal }) => {
      const data = await indexerFetch<{
        accountChains: { items: AccountChainRow[] };
      }>(chainId, ACCOUNTS_QUERY, { chainId }, signal);
      return data.accountChains?.items ?? [];
    },
  });
}

// ──────────────────────────────────────────
// Hooks (the protocol's one extension point)
// ──────────────────────────────────────────

const HOOKS_QUERY = /* GraphQL */ `
  query Hooks($chainId: Int!) {
    hooks(
      where: { chainId: $chainId }
      orderBy: "slotCount"
      orderDirection: "desc"
      limit: 100
    ) {
      items {
        id
            declaredKnown
        slotCount
        failedCallCount
      }
    }
  }
`;

/**
 * Every hook any slot on this chain points at.
 *
 * The successor to `useModules`, and not a rename: a slot had a gallery of
 * modules and now has exactly ONE hook, so this is a filter dimension with one
 * value per slot rather than many.
 */
export function useHooks() {
  const { chainId } = useChain();

  return useQuery({
    queryKey: ["explorer", "hooks", chainId],
    queryFn: async ({ signal }) => {
      const data = await indexerFetch<{ hooks: { items: HookRow[] } }>(
        chainId,
        HOOKS_QUERY,
        { chainId },
        signal,
      );
      return data.hooks?.items ?? [];
    },
  });
}

// ──────────────────────────────────────────
// Slots
// ──────────────────────────────────────────

export interface SlotFilters {
  /** Hook addresses to include. Empty or absent means every hook. */
  hooks?: string[];
  recipient?: string;
  occupant?: string;
  /**
   * Who deployed the slot, which is not who is paid by it.
   *
   * Here for the profile page's "created" list. The column has always been
   * indexed; it simply had no filter, which is why that page read
   * `SlotCreated` logs off the chain instead.
   */
  creator?: string;
}

export interface SlotSort {
  orderBy: string;
  orderDirection: "asc" | "desc";
}

export interface SlotPage {
  items: ExplorerSlot[];
  totalCount: number;
  pageInfo: PageInfo;
}

export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
}

/**
 * The `where` clause, as a GraphQL literal rather than a variable.
 *
 * Ponder names its filter input types after the table (`slotFilter`), and that
 * name is generated — it is not part of any contract this app can rely on, and
 * declaring `$where: slotFilter` breaks the whole document the day it changes.
 * Only a validated address or the numeric chain id is ever interpolated: every
 * caller passes addresses through viem's `isAddress` first.
 */
function buildSlotWhere(chainId: number, filters?: SlotFilters): string {
  const parts = [`chainId: ${chainId}`];
  if (filters?.hooks && filters.hooks.length > 0) {
    const list = filters.hooks.map((h) => `"${h.toLowerCase()}"`).join(", ");
    parts.push(`hook_in: [${list}]`);
  }
  if (filters?.recipient)
    parts.push(`recipient: "${filters.recipient.toLowerCase()}"`);
  if (filters?.occupant)
    parts.push(`occupant: "${filters.occupant.toLowerCase()}"`);
  if (filters?.creator)
    parts.push(`creator: "${filters.creator.toLowerCase()}"`);
  return `{ ${parts.join(", ")} }`;
}

/** Sort fields the indexer actually has a column for. */
const SORTABLE = new Set([
  "createdAt",
  "isOccupied",
  "price",
  "taxBps",
  "updatedAt",
]);

function slotsQuery(
  chainId: number,
  filters: SlotFilters | undefined,
  sort: SlotSort | undefined,
): string {
  // Newest first is the useful default for a protocol explorer, and it also
  // gives the cursor a stable total order to page along.
  const orderBy =
    sort && SORTABLE.has(sort.orderBy) ? sort.orderBy : "createdAt";
  const orderDirection = sort?.orderDirection === "asc" ? "asc" : "desc";

  return /* GraphQL */ `
    query Slots($limit: Int!, $after: String) {
      slots(
        where: ${buildSlotWhere(chainId, filters)}
        orderBy: "${orderBy}"
        orderDirection: "${orderDirection}"
        limit: $limit
        after: $after
      ) {
        items {
          ${SLOT_FIELDS}
        }
        totalCount
        pageInfo {
          hasNextPage
          hasPreviousPage
          startCursor
          endCursor
        }
      }
    }
  `;
}

/**
 * One page of slots, filtered and sorted server-side.
 *
 * Cursor-paged, because ponder has no offset: `after` is the previous page's
 * `endCursor`. The caller keeps the cursor for each page it has visited so
 * Prev still works — see `SlotsTable`.
 *
 * `hooks` filters with `hook_in`. A slot with no hook has `hook: null` and is
 * excluded by that filter, which is correct: "show me slots running the minimum
 * tenure hook" should not return the plain Harberger ones.
 */
export function useExplorerSlots(
  filters: SlotFilters | undefined,
  sort: SlotSort | undefined,
  page: { limit: number; after?: string | null },
) {
  const { chainId } = useChain();

  return useQuery<SlotPage>({
    queryKey: [
      "explorer",
      "slots",
      chainId,
      filters?.hooks?.join(",") ?? "",
      filters?.recipient ?? "",
      filters?.occupant ?? "",
      filters?.creator ?? "",
      sort?.orderBy ?? "",
      sort?.orderDirection ?? "",
      page.limit,
      page.after ?? null,
    ],
    refetchInterval: 15_000,
    // A page keeps showing its rows while the next one loads, instead of
    // collapsing to a skeleton on every Next click.
    placeholderData: (prev) => prev,
    queryFn: async ({ signal }): Promise<SlotPage> => {
      const data = await indexerFetch<{ slots: SlotPage }>(
        chainId,
        slotsQuery(chainId, filters, sort),
        { limit: page.limit, after: page.after ?? null },
        signal,
      );
      return data.slots;
    },
  });
}

// ──────────────────────────────────────────
// Events
// ──────────────────────────────────────────

/**
 * Every event table, one page each, newest first.
 *
 * `slotRef { currencyRef }` on each is how an amount learns its decimals: the
 * event tables carry a bare `currency` address and no currency relation of
 * their own, and rendering a deposit at the wrong scale is off by orders of
 * magnitude while looking perfectly plausible.
 *
 * `hookAttestedEvent`, `adminTransferredEvent` and `beaconUpgradedEvent` are
 * deliberately absent: they are FACTORY events with no slot, and every row in
 * this feed links to a slot. They belong on a factory/admin screen.
 */
const RECENT_EVENTS_QUERY = /* GraphQL */ `
  query RecentEvents($chainId: Int!, $limit: Int!) {
    slotCreatedEvents(
      where: { chainId: $chainId }
      orderBy: "timestamp"
      orderDirection: "desc"
      limit: $limit
    ) {
      items {
        id
        slot
        recipient
        creator
        deployer
        hook
        timestamp
        tx
      }
    }
    boughtEvents(
      where: { chainId: $chainId }
      orderBy: "timestamp"
      orderDirection: "desc"
      limit: $limit
    ) {
      items {
        id
        slot
        buyer
        from
        price
        paid
        deposit
        timestamp
        tx
        slotRef {
          currencyRef {
            symbol
            decimals
          }
        }
      }
    }
    releasedEvents(
      where: { chainId: $chainId }
      orderBy: "timestamp"
      orderDirection: "desc"
      limit: $limit
    ) {
      items {
        id
        slot
        occupant
        refund
        timestamp
        tx
        slotRef {
          currencyRef {
            symbol
            decimals
          }
        }
      }
    }
    liquidatedEvents(
      where: { chainId: $chainId }
      orderBy: "timestamp"
      orderDirection: "desc"
      limit: $limit
    ) {
      items {
        id
        slot
        by
        occupant
        heldFor
        timestamp
        tx
      }
    }
    priceSetEvents(
      where: { chainId: $chainId }
      orderBy: "timestamp"
      orderDirection: "desc"
      limit: $limit
    ) {
      items {
        id
        slot
        by
        occupant
        oldPrice
        newPrice
        timestamp
        tx
        slotRef {
          currencyRef {
            symbol
            decimals
          }
        }
      }
    }
    depositedEvents(
      where: { chainId: $chainId }
      orderBy: "timestamp"
      orderDirection: "desc"
      limit: $limit
    ) {
      items {
        id
        slot
        by
        amount
        total
        timestamp
        tx
        slotRef {
          currencyRef {
            symbol
            decimals
          }
        }
      }
    }
    withdrawnEvents(
      where: { chainId: $chainId }
      orderBy: "timestamp"
      orderDirection: "desc"
      limit: $limit
    ) {
      items {
        id
        slot
        occupant
        amount
        left
        timestamp
        tx
        slotRef {
          currencyRef {
            symbol
            decimals
          }
        }
      }
    }
    settledEvents(
      where: { chainId: $chainId }
      orderBy: "timestamp"
      orderDirection: "desc"
      limit: $limit
    ) {
      items {
        id
        slot
        owed
        paid
        depositLeft
        insolvent
        timestamp
        tx
        slotRef {
          currencyRef {
            symbol
            decimals
          }
        }
      }
    }
    taxCollectedEvents(
      where: { chainId: $chainId }
      orderBy: "timestamp"
      orderDirection: "desc"
      limit: $limit
    ) {
      items {
        id
        slot
        recipient
        amount
        timestamp
        tx
        slotRef {
          currencyRef {
            symbol
            decimals
          }
        }
      }
    }
    creditedEvents(
      where: { chainId: $chainId }
      orderBy: "timestamp"
      orderDirection: "desc"
      limit: $limit
    ) {
      items {
        id
        slot
        account
        amount
        timestamp
        tx
        slotRef {
          currencyRef {
            symbol
            decimals
          }
        }
      }
    }
    claimedEvents(
      where: { chainId: $chainId }
      orderBy: "timestamp"
      orderDirection: "desc"
      limit: $limit
    ) {
      items {
        id
        slot
        account
        amount
        timestamp
        tx
        slotRef {
          currencyRef {
            symbol
            decimals
          }
        }
      }
    }
    operatorSetEvents(
      where: { chainId: $chainId }
      orderBy: "timestamp"
      orderDirection: "desc"
      limit: $limit
    ) {
      items {
        id
        slot
        occupant
        operator
        allowed
        timestamp
        tx
      }
    }
    termsProposedEvents(
      where: { chainId: $chainId }
      orderBy: "timestamp"
      orderDirection: "desc"
      limit: $limit
    ) {
      items {
        id
        slot
        manager
        changeTax
        changeHook
        taxBps
        hook
        timestamp
        tx
      }
    }
    termsAppliedEvents(
      where: { chainId: $chainId }
      orderBy: "timestamp"
      orderDirection: "desc"
      limit: $limit
    ) {
      items {
        id
        slot
        taxBps
        hook
        previousTaxPercentage
        previousHook
        taxChanged
        hookChanged
        timestamp
        tx
      }
    }
    termsCancelledEvents(
      where: { chainId: $chainId }
      orderBy: "timestamp"
      orderDirection: "desc"
      limit: $limit
    ) {
      items {
        id
        slot
        manager
        cancelTax
        cancelHook
        timestamp
        tx
      }
    }
    hookCallFailedEvents(
      where: { chainId: $chainId }
      orderBy: "timestamp"
      orderDirection: "desc"
      limit: $limit
    ) {
      items {
        id
        slot
        hook
        selector
        timestamp
        tx
      }
    }
  }
`;

/** The protocol's recent activity, every table at once. */
export function useRecentEvents(limit = 100) {
  const { chainId } = useChain();

  return useQuery({
    queryKey: ["explorer", "events", chainId, limit],
    refetchInterval: 15_000,
    queryFn: ({ signal }) =>
      indexerFetch<Record<string, { items: unknown[] }>>(
        chainId,
        RECENT_EVENTS_QUERY,
        { chainId, limit },
        signal,
      ),
  });
}

/**
 * One slot's activity — the same eighteen tables, narrowed to it.
 *
 * The narrowing happens on the SERVER, by rewriting the shared query's where
 * clauses, rather than by fetching the protocol's recent events and filtering
 * in the browser. The difference matters as soon as there is real history: a
 * client-side filter shows a slot's last transition only while it is still
 * among the protocol's last `limit` events overall, so a quiet slot's page goes
 * blank precisely because OTHER slots were busy — an empty state that says
 * "nothing ever happened here" when the truth is "it scrolled off".
 *
 * Every table in that query carries a `slot` column, which is what makes the
 * rewrite safe; the three factory-level tables that do not are deliberately
 * absent from it.
 */
export function useSlotEvents(slot: Address | undefined, limit = 50) {
  const { chainId } = useChain();

  const query = useMemo(
    () =>
      slot
        ? RECENT_EVENTS_QUERY.replaceAll(
            "where: { chainId: $chainId }",
            `where: { chainId: $chainId, slot: "${slot.toLowerCase()}" }`,
          )
        : RECENT_EVENTS_QUERY,
    [slot],
  );

  return useQuery({
    queryKey: ["explorer", "events", chainId, "slot", slot, limit],
    enabled: !!slot,
    refetchInterval: 15_000,
    queryFn: ({ signal }) =>
      indexerFetch<Record<string, { items: unknown[] }>>(
        chainId,
        query,
        { chainId, limit },
        signal,
      ),
  });
}

// ──────────────────────────────────────────
// Indexer health
// ──────────────────────────────────────────

const META_QUERY = /* GraphQL */ `
  query GetMeta {
    _meta {
      status
    }
  }
`;

export interface ChainStatus {
  id: number;
  block: { number: number; timestamp: number } | null;
}

/**
 * How far the indexer has got on THIS chain.
 *
 * `_meta.status` is a blob keyed by ponder's own chain NAME, each entry
 * carrying `{ id, block }`. The name is a config label this app has no business
 * knowing, so the entry is found by matching `id` to the chain.
 */
export function useIndexerMeta() {
  const { chainId } = useChain();

  return useQuery({
    queryKey: ["explorer", "indexer-meta", chainId],
    refetchInterval: 10_000,
    queryFn: async ({ signal }) => {
      const data = await indexerFetch<{
        _meta: { status: Record<string, ChainStatus> | null } | null;
      }>(chainId, META_QUERY, {}, signal);
      const status = data._meta?.status ?? {};
      return Object.values(status).find((c) => c && c.id === chainId) ?? null;
    },
  });
}

// ──────────────────────────────────────────
// Solvency, without asking the chain
// ──────────────────────────────────────────

/** The contract's denominator. `taxBps` is basis points per 30 days. */
const BASIS_POINTS = 10_000n;

/**
 * Tax accrued since the last settlement, as of `nowSeconds`.
 *
 * `null` means the row cannot answer — see the last paragraph.
 *
 * ── Why this is computed rather than read ───────────────────────────────────
 *
 * `isInsolvent` is a function of `block.timestamp`, so no indexed column can
 * hold it — nothing is emitted when a slot crosses into insolvency, it simply
 * becomes true while nothing happens on chain. The listing used to get it by
 * asking the chain per row on a timer, which is one `eth_call` per slot per
 * poll per open tab, for a figure that is pure arithmetic over values the
 * indexer already has.
 *
 * The arithmetic is the contract's own, from `SlotMath.taxFor`:
 *
 *   owed = price * taxBps * elapsed / (30 days * 10_000)
 *
 * evaluated against `lastSettled`, which is what `SlotAccounting.taxOwed()`
 * measures from. BigInt throughout and the division last, mirroring the
 * contract's `mulDiv` — doing it in floats rounds a wei-precise comparison
 * into a wrong badge on a slot sitting near the boundary.
 *
 * ── The three ways this answers "no" ────────────────────────────────────────
 *
 * A vacant slot cannot be insolvent — the contract returns zero owed when
 * there is no occupant. Neither can one whose `lastSettled` we do not know:
 * that is a row written before the column existed, and treating a null as zero
 * would date the accrual to 1970 and mark every such slot insolvent. Absence
 * of evidence is reported as solvent, because the badge's job is to point at a
 * liquidation opportunity and a wrong one sends somebody to spend gas on a
 * slot that is fine.
 */
export function taxOwedAt(
  slot: ExplorerSlot,
  nowSeconds: bigint,
): bigint | null {
  // The contract returns zero owed when nobody is seated, rather than
  // accruing against an empty slot.
  if (!slot.isOccupied) return 0n;
  // A row from before the column existed. `null` is "cannot say", and every
  // caller renders that as nothing rather than as a number.
  if (slot.lastSettled === null) return null;

  const settled = BigInt(slot.lastSettled);
  // The indexer's head can sit a block behind the row it just wrote, which
  // would otherwise make `elapsed` negative and the division underflow.
  if (nowSeconds <= settled) return 0n;

  return (
    (BigInt(slot.price) * BigInt(slot.taxBps) * (nowSeconds - settled)) /
    (MONTH_SECONDS * BASIS_POINTS)
  );
}

/** Whether the occupant's debt has caught up with their escrow. */
export function isInsolventAt(slot: ExplorerSlot, nowSeconds: bigint): boolean {
  const owed = taxOwedAt(slot, nowSeconds);
  if (owed === null) return false;
  return owed >= BigInt(slot.deposit);
}

/**
 * The chain's clock, as the indexer last saw it.
 *
 * Deliberately not `eth_blockNumber`: the whole point of computing solvency
 * locally is that a listing costs no RPC, and reaching for the chain to find
 * out what time it is would put the per-row call back one level up. The
 * indexer reports the head it has processed, which is the right clock anyway —
 * a row's `lastSettled` and this timestamp then come from the same source, so
 * the badge can never be computed against a clock ahead of the data.
 *
 * Null while the first read is in flight, which callers render as "no badge"
 * rather than guessing with the browser's own clock.
 */
export function useChainClock(): bigint | null {
  const { data } = useIndexerMeta();
  const ts = data?.block?.timestamp;
  return ts === undefined || ts === null ? null : BigInt(ts);
}
