import { useFormContext } from "react-hook-form";
import {
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
import { type CreateSlotFormValues, timeDenominations } from "../schema";

export function SectionEconomics() {
  const form = useFormContext<CreateSlotFormValues>();

  return (
    <>
      <FormField
        control={form.control}
        name="taxPercentage"
        render={({ field }) => (
          <FormItem>
            <div className="flex items-center justify-between">
              <FormLabel>Tax Rate</FormLabel>
              <span className="text-sm font-semibold">
                {parseFloat(normalizeDecimal(field.value)).toFixed(1) || "0"}
                %/mo
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="0.5"
              value={Number(field.value) || 0}
              onChange={(e) => field.onChange(e.target.value)}
              className="w-full h-2 appearance-none bg-secondary rounded-full cursor-pointer accent-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0"
            />
            <div className="flex justify-between text-[9px] text-muted-foreground">
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>
            <TaxRateHint value={Number(field.value) || 0} />
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="minDepositValue"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Min Deposit Time</FormLabel>
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
                    <SelectTrigger className="w-25 rounded-l-none border-l-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timeDenominations.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {unit.charAt(0).toUpperCase() + unit.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}

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
