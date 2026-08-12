"use client";

import { formatDistanceToNow } from "date-fns";
import { ArrowDown, ArrowUp, Check, Filter, X } from "lucide-react";
import { useEffect, useState } from "react";
import { isAddress, stringify } from "viem";
import { AccountTypeIcon } from "@/components/account-type-icon";
import { EnsAddress } from "@/components/ens-address";
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
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useNavigation } from "@/context/navigation";
import type { SlotFilters, SlotSort } from "@/hooks/use-v3";
import { useModules, useSlots } from "@/hooks/use-v3";
import { loadStorage, saveStorage } from "@/lib/storage";
import { formatPrice, truncateAddress } from "@/utils";

const STORAGE_KEY = "0xslots:slot-filters";

export function SlotsTable() {
  const { push } = useNavigation();
  const [filters, setFilters] = useState<SlotFilters>({});
  const [sort, setSort] = useState<SlotSort | undefined>(undefined);
  const [addressInput, setAddressInput] = useState("");
  const [addressField, setAddressField] = useState<
    "recipient" | "occupant" | null
  >(null);
  const { data: modules } = useModules();

  useEffect(() => {
    setFilters(loadStorage<SlotFilters>(STORAGE_KEY, {}));
  }, []);

  const updateFilters = (next: SlotFilters) => {
    // Clean empty values
    const clean: SlotFilters = {};
    if (next.moduleIds && next.moduleIds.length > 0)
      clean.moduleIds = next.moduleIds;
    if (next.recipient) clean.recipient = next.recipient;
    if (next.occupant) clean.occupant = next.occupant;
    setFilters(clean);
    saveStorage(STORAGE_KEY, clean);
  };

  const hasFilters =
    (filters.moduleIds && filters.moduleIds.length > 0) ||
    !!filters.recipient ||
    !!filters.occupant;

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  // Reset to page 0 whenever filters or sort change
  useEffect(() => {
    setPage(0);
  }, [filters, sort]);

  const { data: slots, isLoading } = useSlots(
    hasFilters ? filters : undefined,
    sort,
    { first: pageSize + 1, skip: page * pageSize },
  );

  const hasMore = (slots?.length ?? 0) > pageSize;
  const paged = (slots ?? []).slice(0, pageSize);

  const changePageSize = (size: number) => {
    setPageSize(size);
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

  const toggleModule = (moduleId: string) => {
    const current = filters.moduleIds ?? [];
    const next = current.includes(moduleId)
      ? current.filter((id) => id !== moduleId)
      : [...current, moduleId];
    updateFilters({ ...filters, moduleIds: next });
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
    if (key === "moduleIds" && value) {
      toggleModule(value);
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

  if (isLoading) return <TableSkeleton />;

  return (
    <div>
      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-2 justify-end flex-wrap">
        {/* Active filter pills */}
        {hasFilters && (
          <>
            {filters.moduleIds?.map((id) => {
              const mod = modules?.find((m) => m.id === id);
              return (
                <Badge
                  key={`mod-${id}`}
                  variant="secondary"
                  className="gap-1 text-xs cursor-pointer"
                  onClick={() => removeFilter("moduleIds", id)}
                >
                  {mod?.name || truncateAddress(id)}
                  <X className="size-3" />
                </Badge>
              );
            })}
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
                  {(filters.moduleIds?.length ?? 0) +
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

            {/* Module filters */}
            <DropdownMenuLabel className="text-xs">Utility</DropdownMenuLabel>
            {modules?.map((m) => (
              <DropdownMenuCheckboxItem
                key={m.id}
                checked={filters.moduleIds?.includes(m.id) ?? false}
                onCheckedChange={() => toggleModule(m.id)}
              >
                <span className="truncate">
                  {m.name || truncateAddress(m.id)}
                </span>
                {m.verified && (
                  <span className="ml-auto text-[10px] text-green-600">✓</span>
                )}
              </DropdownMenuCheckboxItem>
            ))}
            {(!modules || modules.length === 0) && (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">
                No utilities found
              </p>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {!slots || slots.length === 0 ? (
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
                <TableHead className="text-right">Price / Tax</TableHead>
                <TableHead>Utility</TableHead>
                <TableHead>Flags</TableHead>
                <TableHead className="text-right">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((slot) => (
                <SlotRow
                  key={slot.id}
                  slot={slot}
                  onSelect={(id) => push(`/slots/${id}`)}
                />
              ))}
            </TableBody>
          </Table>
          <TablePagination
            page={page}
            pageSize={pageSize}
            hasMore={hasMore}
            onPageChange={setPage}
            onPageSizeChange={changePageSize}
          />
        </div>
      )}
    </div>
  );
}
