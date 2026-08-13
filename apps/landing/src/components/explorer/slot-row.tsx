"use client";

import type { SlotFieldsFragment } from "@0xslots/sdk";
import { formatDistanceToNow } from "date-fns";
import { AccountTypeIcon } from "@/components/account-type-icon";
import { EnsAddress } from "@/components/ens-address";
import { OccupancyPolicyBadge } from "@/components/occupancy-policy-badge";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import { formatPrice, truncateAddress } from "@/utils";

/**
 * One row of the slots table.
 *
 * Its own component because hooks cannot be called inside the parent's `.map()`.
 *
 * Indexed values are read directly. This used to reconcile them against a
 * scheduled transfer whose boundary had passed, so that the occupant and the
 * price could not disagree with each other; epoch scheduling was removed in v4
 * and a buy is indexed the moment it lands.
 */
export function SlotRow({
  slot,
  onSelect,
}: {
  slot: SlotFieldsFragment;
  onSelect: (id: string) => void;
}) {
  const occupant = slot.occupant ?? null;
  const account = slot.occupantAccountRef;

  return (
    <TableRow className="cursor-pointer" onClick={() => onSelect(slot.id)}>
      <TableCell>
        <span className="inline-flex items-center gap-1.5">
          <AccountTypeIcon
            type={slot.recipientAccountRef?.type ?? "EOA"}
            className="h-3 w-3"
          />
          <EnsAddress address={slot.recipient} />
        </span>
      </TableCell>

      <TableCell className="text-xs">
        <div className="flex items-center gap-1.5">
          {occupant ? (
            <span className="inline-flex items-center gap-1.5">
              {account && (
                <AccountTypeIcon type={account.type} className="h-3 w-3" />
              )}
              {truncateAddress(occupant)}
            </span>
          ) : (
            <Badge variant="secondary" className="text-[10px]">
              VACANT
            </Badge>
          )}
        </div>
      </TableCell>

      <TableCell className="text-right text-xs whitespace-nowrap">
        <span className="font-bold">
          {occupant
            ? formatPrice(slot.price, slot.currencyRef?.decimals ?? 18)
            : "0"}
        </span>
        <span className="text-muted-foreground text-[10px] ml-1">
          {slot.currencyRef?.symbol}
        </span>
        <span className="text-muted-foreground text-[10px] ml-1">
          ({Number(slot.taxPercentage) / 100}%/mo)
        </span>
      </TableCell>

      <TableCell className="text-xs text-muted-foreground">
        {slot.module
          ? `${slot.moduleRef?.name || truncateAddress(slot.moduleRef?.id ?? slot.module ?? "")}${slot.moduleRef?.verified ? " ✓" : ""}`
          : "—"}
      </TableCell>

      <TableCell>
        <div className="flex flex-wrap items-center gap-1">
          {/* How easily this slot can actually be bought out — more
              consequential to a holder than the mutability flags beside it. */}
          <OccupancyPolicyBadge
            occupancyPolicy={slot.occupancyPolicy}
            className="[&_*]:text-[9px]"
          />
          {slot.mutableTax && (
            <Badge variant="outline" className="text-[9px]">
              TAX
            </Badge>
          )}
          {/* Its own badge, not folded into MOD. MOD says the utility module
              may be swapped — what the slot does. This says the occupancy
              policy may be, which decides whether the holder can be forced to
              sell and on what terms. A reader must not have to infer the
              second from the first. */}
          {slot.mutablePolicy && (
            <Badge variant="outline" className="text-[9px]">
              POLICY
            </Badge>
          )}
          {slot.mutableModule && (
            <Badge variant="outline" className="text-[9px]">
              MOD
            </Badge>
          )}
        </div>
      </TableCell>

      <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
        {formatDistanceToNow(new Date(Number(slot.createdAt) * 1000), {
          addSuffix: true,
        })}
      </TableCell>
    </TableRow>
  );
}
