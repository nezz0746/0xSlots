import { Button } from "@/components/ui/button";

/**
 * How many identical slots to make.
 *
 * The factory used to take a `count` and deploy them in one transaction. It no
 * longer does — there is exactly one `createSlot(SlotInit)` entry point — so
 * `n > 1` is now n sequential transactions and n wallet confirmations. The
 * control survives because making a strip of identical slots is a real thing
 * people do here; what changed is the cost, and the submit button says so
 * ("Creating 2 of 5…") rather than letting the count look free.
 */
interface SlotCounterProps {
  value: number;
  onChange: (count: number) => void;
  variant?: "separated" | "connected";
}

export function SlotCounter({
  value,
  onChange,
  variant = "separated",
}: SlotCounterProps) {
  const isSeparated = variant === "separated";
  const buttonSize = isSeparated ? "icon-xs" : "icon-sm";
  const counterClass = isSeparated
    ? "w-10 h-6 border rounded-md flex items-center justify-center text-sm font-semibold"
    : "w-10 h-8 border-y flex items-center justify-center text-sm font-semibold";

  return (
    <div
      className={`flex items-center ${isSeparated ? "gap-2" : "gap-0"} shrink-0`}
    >
      <Button
        type="button"
        variant="outline"
        size={buttonSize}
        onClick={() => onChange(Math.max(1, value - 1))}
      >
        −
      </Button>
      <span className={counterClass}>{value}</span>
      <Button
        type="button"
        variant="outline"
        size={buttonSize}
        onClick={() => onChange(Math.min(50, value + 1))}
      >
        +
      </Button>
    </div>
  );
}
