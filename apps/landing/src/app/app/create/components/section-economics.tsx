import { useFormContext } from "react-hook-form";
import {
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { normalizeDecimal } from "@/utils";
import type { CreateSlotFormValues } from "../schema";
import { timeUnits } from "../sections";

/** "1" → "1", "0.01" → "0.01", "2.50" → "2.5". Never rounds the floor away. */
function displayRate(raw: string): string {
  const n = Number(normalizeDecimal(raw));
  if (!Number.isFinite(n)) return "0";
  return String(Math.round(n * 100) / 100);
}

export function SectionEconomics() {
  const form = useFormContext<CreateSlotFormValues>();

  return (
    <>
      <FormField
        control={form.control}
        name="taxBps"
        render={({ field }) => (
          <FormItem>
            <div className="flex items-center justify-between">
              <FormLabel>Tax Rate</FormLabel>
              <span className="text-sm font-semibold tabular-nums">
                {displayRate(field.value)}% / 30 days
              </span>
            </div>
            {/* The slider's floor is the protocol's floor, not zero. A
                zero-tax slot accrues nothing and so can never be liquidated —
                `assertSlotInit` rejects it, and a slider that could reach it
                would be offering a slot the chain refuses to make. 0.01% is
                the smallest rate basis points can express. */}
            <input
              type="range"
              min="0.01"
              max="100"
              step="0.01"
              value={Number(normalizeDecimal(field.value)) || 0.01}
              onChange={(e) => field.onChange(e.target.value)}
              className="w-full h-2 appearance-none bg-secondary rounded-full cursor-pointer accent-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0"
            />
            <div className="flex justify-between text-[9px] text-muted-foreground">
              <span>0.01%</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>
            <Input
              {...field}
              type="text"
              inputMode="decimal"
              className="mt-1"
            />
            <TaxRateHint value={Number(normalizeDecimal(field.value)) || 0} />
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="minDepositValue"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Minimum funded runway</FormLabel>
            <div className="flex gap-0">
              <Input
                {...field}
                type="text"
                inputMode="decimal"
                className="rounded-r-none"
              />
              <FormField
                control={form.control}
                name="minDepositUnit"
                render={({ field: selectField }) => (
                  <Select
                    value={selectField.value}
                    onValueChange={selectField.onChange}
                  >
                    <SelectTrigger className="w-28 rounded-l-none border-l-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timeUnits.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {unit.charAt(0).toUpperCase() + unit.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <FormDescription>
              How far ahead a buyer must fund, and the floor a withdrawal may
              not go below. Zero means no minimum.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}

/**
 * What the rate you just dragged to actually buys you.
 *
 * Two ends of one trade-off rather than a recommended number, because there
 * isn't one: a low rate is cheap to hold and therefore easy to squat, a high
 * rate reallocates quickly and is therefore volatile. The end you are nearer
 * is bolded so the slider reads as a position, not a score.
 */
function TaxRateHint({ value }: { value: number }) {
  const isLow = value <= 20;
  const isHigh = value >= 30;

  return (
    <div className="flex justify-between mt-1.5 text-[9px] leading-tight gap-4">
      <span
        className={
          isLow ? "font-bold text-foreground" : "text-muted-foreground"
        }
      >
        Predictability · low churn · squat risk
      </span>
      <span
        className={`text-right ${isHigh ? "font-bold text-foreground" : "text-muted-foreground"}`}
      >
        Allocative efficiency · anti-squat · volatility
      </span>
    </div>
  );
}
