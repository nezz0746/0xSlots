import { Badge } from "@/components/ui/badge";

/**
 * The compact form of {@link OccupancyBadge}, for table cells.
 *
 * Same three states and the same precedence — insolvency outranks occupancy,
 * because an insolvent slot is still occupied and that is not the fact a reader
 * needs first.
 */
export function SlotStatusBadge({
  occupant,
  insolvent,
}: {
  occupant: string | null | undefined;
  insolvent: boolean;
}) {
  const variant = insolvent
    ? "destructive"
    : occupant
      ? "default"
      : "secondary";
  const label = insolvent ? "INSOLVENT" : occupant ? "OCCUPIED" : "VACANT";

  return (
    <Badge variant={variant} className="text-[10px]">
      {label}
    </Badge>
  );
}
