"use client";

import { findKnownHook } from "@0xslots/contracts/slots";
import { ArrowDown, ArrowUp, Check, Filter, X } from "lucide-react";
import { useEffect, useState } from "react";
import { isAddress } from "viem";
import { SlotRow } from "@/components/explorer/slot-row";
import { TablePagination } from "@/components/table-pagination";
import { TableEmpty, TableSkeleton } from "@/components/table-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useChain } from "@/context/chain";
import { useNavigation } from "@/context/navigation";
import type { SlotFilters, SlotSort } from "@/hooks/use-explorer";
import {
  useChainClock,
  useExplorerSlots,
  useHooks,
} from "@/hooks/use-explorer";
import { loadStorage, saveStorage } from "@/lib/storage";
import { truncateAddress } from "@/utils";

/**
 * A NEW key, not the old `0xslots:slot-filters`.
 *
 * The stored shape changed — `moduleIds` became `hooks` — and a browser that
 * used the previous app still holds the old value. Reusing the key would
 * silently restore a filter naming contracts that no longer exist, and the
 * table would come up empty for reasons nothing on screen explains.
 */
const STORAGE_KEY = "0xslots:slot-filters:hooks";

/**
 * The explorer's slots table: filtered, sorted and paged by the indexer.
 *
 * ── One table, not two ──────────────────────────────────────────────────────
 *
 * There was a second one — `components/slots/slots-table.tsx` — that read
 * `SlotCreated` logs off the chain and asked each slot for its own state, and
 * this table fell back to it whenever the indexer errored. Both are gone.
 *
 * The reasoning that kept it was sound about the symptom and wrong about the
 * cure. A live chain with a cold indexer IS normal right after a deploy, and
 * "no slots found" would be a lie — but the fallback told a different lie: it
 * could not filter, sort or page, so it rendered a table that quietly ignored
 * the controls sitting above it. And it paid for the privilege, scanning from
 * the factory's deployment block on a timer in every open tab at once, during
 * precisely the fleet-wide outage that had put every tab on that path.
 *
 * So the listing is indexer-only and the error state says what is actually
 * wrong. Live figures still come from the chain where they must — but on the
 * SINGLE slot page, where it is one slot and one reader, rather than per row
 * of a paginated list.
 */
export function SlotsTable() {
  const { push } = useNavigation();
  const { chainId } = useChain();
  const [filters, setFilters] = useState<SlotFilters>({});
  const [sort, setSort] = useState<SlotSort | undefined>(undefined);
  const [addressInput, setAddressInput] = useState("");
  const [addressField, setAddressField] = useState<
    "recipient" | "occupant" | null
  >(null);
  const { data: hooks } = useHooks();
  // One clock for every row — see `SlotRow`.
  const now = useChainClock();

  useEffect(() => {
    setFilters(loadStorage<SlotFilters>(STORAGE_KEY, {}));
  }, []);

  const updateFilters = (next: SlotFilters) => {
    // Clean empty values
    const clean: SlotFilters = {};
    if (next.hooks && next.hooks.length > 0) clean.hooks = next.hooks;
    if (next.recipient) clean.recipient = next.recipient;
    if (next.occupant) clean.occupant = next.occupant;
    setFilters(clean);
    saveStorage(STORAGE_KEY, clean);
  };

  const hasFilters =
    (filters.hooks && filters.hooks.length > 0) ||
    !!filters.recipient ||
    !!filters.occupant;

  const [pageSize, setPageSize] = useState(25);
  /**
   * One cursor per page visited, `null` for the first.
   *
   * Ponder pages by cursor and has no offset, so a page number alone cannot
   * address a page — going back means remembering where each one started. The
   * stack is reset, not rewound, whenever the filters or the sort change,
   * because the cursors of the previous ordering address nothing in the new
   * one.
   */
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [page, setPage] = useState(0);

  useEffect(() => {
    setCursors([null]);
    setPage(0);
  }, [filters, sort]);

  const { data, isLoading, isError } = useExplorerSlots(
    hasFilters ? filters : undefined,
    sort,
    { limit: pageSize, after: cursors[page] ?? null },
  );

  const slots = data?.items ?? [];
  const hasMore = data?.pageInfo?.hasNextPage ?? false;

  const goToPage = (next: number) => {
    if (next < 0) return;
    if (next < cursors.length) {
      setPage(next);
      return;
    }
    // Forward past the end of what we have seen: remember this page's end as
    // the next one's start.
    const endCursor = data?.pageInfo?.endCursor;
    if (!endCursor) return;
    setCursors((prev) => [...prev, endCursor]);
    setPage(next);
  };

  const changePageSize = (size: number) => {
    setPageSize(size);
    // Cursors are sized to the page they were taken from, so they do not
    // survive a resize.
    setCursors([null]);
    setPage(0);
  };

  const cycleSort = (field: string) => {
    if (!sort || sort.orderBy !== field) {
      setSort({ orderBy: field, orderDirection: "desc" });
    } else if (sort.orderDirection === "desc") {
      setSort({ orderBy: field, orderDirection: "asc" });
    } else {
      setSort(undefined);
    }
  };

  const toggleHook = (hookId: string) => {
    const current = filters.hooks ?? [];
    const next = current.includes(hookId)
      ? current.filter((id) => id !== hookId)
      : [...current, hookId];
    updateFilters({ ...filters, hooks: next });
  };

  const applyAddress = () => {
    if (!addressField || !addressInput.trim()) return;
    const addr = addressInput.trim();
    if (!isAddress(addr)) return;
    updateFilters({ ...filters, [addressField]: addr });
    setAddressInput("");
    setAddressField(null);
  };

  const removeFilter = (key: keyof SlotFilters, value?: string) => {
    if (key === "hooks" && value) {
      toggleHook(value);
    } else {
      const next = { ...filters };
      delete next[key];
      updateFilters(next);
    }
  };

  const clearFilters = () => {
    updateFilters({});
    setAddressInput("");
    setAddressField(null);
  };

  const hookLabel = (id: string) =>
    findKnownHook(chainId, id as `0x${string}`)?.name ?? truncateAddress(id);

  if (isLoading && !data) return <TableSkeleton />;

  /*
   * An unreachable indexer says so, and shows nothing.
   *
   * This used to fall back to a table that read `SlotCreated` logs off the
   * chain. That path is gone: it could not filter, sort or page — so the
   * controls above it lied — and it scanned from the factory's deployment
   * block on a timer, in every open tab at once, at the exact moment a
   * fleet-wide outage meant every tab was on it.
   *
   * Saying "the indexer is down" is more honest than a degraded table that
   * silently ignores the filters someone just set. A live chain with a cold
   * indexer is still normal right after a deploy — this is what that looks
   * like now, and `useIndexerMeta` on the page above reports how far behind
   * it is.
   */
  if (isError) {
    return (
      <div className="border p-8 text-center">
        <p className="text-sm text-muted-foreground">
          The indexer is unreachable, so slots cannot be listed right now.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          This is usually brief, and normal just after a deploy while it catches
          up.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-2 justify-end flex-wrap">
        {/* Active filter pills */}
        {hasFilters && (
          <>
            {filters.hooks?.map((id) => (
              <Badge
                key={`hook-${id}`}
                variant="secondary"
                className="gap-1 text-xs cursor-pointer"
                onClick={() => removeFilter("hooks", id)}
              >
                {hookLabel(id)}
                <X className="size-3" />
              </Badge>
            ))}
            {filters.recipient && (
              <Badge
                variant="secondary"
                className="gap-1 text-xs cursor-pointer"
                onClick={() => removeFilter("recipient")}
              >
                Recipient: {truncateAddress(filters.recipient)}
                <X className="size-3" />
              </Badge>
            )}
            {filters.occupant && (
              <Badge
                variant="secondary"
                className="gap-1 text-xs cursor-pointer"
                onClick={() => removeFilter("occupant")}
              >
                Occupant: {truncateAddress(filters.occupant)}
                <X className="size-3" />
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground h-6 px-2"
              onClick={clearFilters}
            >
              Clear all
            </Button>
          </>
        )}

        {/* Address input (shown when a field is selected) */}
        {addressField && (
          <div className="flex items-center gap-1">
            <Input
              placeholder={`${addressField === "recipient" ? "Recipient" : "Occupant"} address (0x...)`}
              value={addressInput}
              onChange={(e) => setAddressInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyAddress()}
              className="h-7 w-56 text-xs "
            />
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2"
              onClick={applyAddress}
              disabled={!isAddress(addressInput.trim())}
            >
              <Check className="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-1.5"
              onClick={() => {
                setAddressField(null);
                setAddressInput("");
              }}
            >
              <X className="size-3" />
            </Button>
          </div>
        )}

        {/* Filter dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Filter className="size-3" />
              Filters
              {hasFilters && (
                <Badge variant="secondary" className="text-[9px] px-1 py-0">
                  {(filters.hooks?.length ?? 0) +
                    (filters.recipient ? 1 : 0) +
                    (filters.occupant ? 1 : 0)}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {/* Address filters */}
            <DropdownMenuLabel className="text-xs">Address</DropdownMenuLabel>
            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={() => {
                  setAddressField("recipient");
                  setAddressInput(filters.recipient ?? "");
                }}
              >
                Recipient
                {filters.recipient && (
                  <span className="ml-auto text-[10px] text-muted-foreground ">
                    {truncateAddress(filters.recipient)}
                  </span>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setAddressField("occupant");
                  setAddressInput(filters.occupant ?? "");
                }}
              >
                Occupant
                {filters.occupant && (
                  <span className="ml-auto text-[10px] text-muted-foreground ">
                    {truncateAddress(filters.occupant)}
                  </span>
                )}
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            {/* Hook filters. Was "Utility", and listed modules — a slot has one
                hook now, so this is a one-of dimension rather than a gallery. */}
            <DropdownMenuLabel className="text-xs">Hook</DropdownMenuLabel>
            {hooks?.map((h) => (
              <DropdownMenuCheckboxItem
                key={h.id}
                checked={filters.hooks?.includes(h.id) ?? false}
                onCheckedChange={() => toggleHook(h.id)}
              >
                <span className="truncate">{hookLabel(h.id)}</span>
              </DropdownMenuCheckboxItem>
            ))}
            {(!hooks || hooks.length === 0) && (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">
                No hooks in use
              </p>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {slots.length === 0 ? (
        <TableEmpty
          message={hasFilters ? "No slots match filters" : "No slots found"}
        />
      ) : (
        <div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recipient</TableHead>
                <TableHead
                  className={`cursor-pointer select-none hover:text-foreground ${
                    sort?.orderBy === "isOccupied"
                      ? "text-foreground font-semibold"
                      : ""
                  }`}
                  onClick={() => cycleSort("isOccupied")}
                  title={
                    sort?.orderBy === "isOccupied" &&
                    sort.orderDirection === "desc"
                      ? "Occupied first — click to flip"
                      : sort?.orderBy === "isOccupied" &&
                          sort.orderDirection === "asc"
                        ? "Vacant first — click to clear"
                        : "Click to sort occupied first"
                  }
                >
                  <span className="inline-flex items-center gap-1">
                    Occupant
                    {sort?.orderBy === "isOccupied" ? (
                      sort.orderDirection === "desc" ? (
                        <ArrowDown className="size-3.5" />
                      ) : (
                        <ArrowUp className="size-3.5" />
                      )
                    ) : (
                      <ArrowDown className="size-3 opacity-30" />
                    )}
                  </span>
                </TableHead>
                <TableHead
                  className={`text-right cursor-pointer select-none hover:text-foreground ${
                    sort?.orderBy === "price"
                      ? "text-foreground font-semibold"
                      : ""
                  }`}
                  onClick={() => cycleSort("price")}
                >
                  <span className="inline-flex items-center gap-1">
                    Price / Tax
                    {sort?.orderBy === "price" &&
                      (sort.orderDirection === "desc" ? (
                        <ArrowDown className="size-3.5" />
                      ) : (
                        <ArrowUp className="size-3.5" />
                      ))}
                  </span>
                </TableHead>
                <TableHead>Hook</TableHead>
                {/* Was "Flags", which named the mechanism rather than the fact.
    These are the slot's TERMS and whether they are still open. */}
                <TableHead>Config</TableHead>
                <TableHead
                  className={`text-right cursor-pointer select-none hover:text-foreground ${
                    sort?.orderBy === "createdAt"
                      ? "text-foreground font-semibold"
                      : ""
                  }`}
                  onClick={() => cycleSort("createdAt")}
                >
                  <span className="inline-flex items-center gap-1">
                    Created
                    {sort?.orderBy === "createdAt" &&
                      (sort.orderDirection === "desc" ? (
                        <ArrowDown className="size-3.5" />
                      ) : (
                        <ArrowUp className="size-3.5" />
                      ))}
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slots.map((slot) => (
                <SlotRow
                  key={slot.id}
                  slot={slot}
                  now={now}
                  onSelect={(id) => push(`/app/slots/${id}`)}
                />
              ))}
            </TableBody>
          </Table>
          <TablePagination
            page={page}
            pageSize={pageSize}
            hasMore={hasMore}
            onPageChange={goToPage}
            onPageSizeChange={changePageSize}
          />
        </div>
      )}
    </div>
  );
}
