import { Plus, Trash2, Users, Wallet } from "lucide-react";
import { useState } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import {
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { normalizeDecimal, truncateAddress } from "@/utils";
import { AddressInput } from "../address-input";
import type { CreateSlotFormValues } from "../schema";

export function SectionRecipient() {
  const { address } = useAccount();
  const form = useFormContext<CreateSlotFormValues>();
  const recipientMode = form.watch("recipientMode");
  const [useCustomRecipient, setUseCustomRecipient] = useState(false);

  const {
    fields: splitFields,
    append: appendSplitRecipient,
    remove: removeSplitRecipient,
  } = useFieldArray({
    control: form.control,
    name: "splitRecipients",
  });

  return (
    <>
      <FormField
        control={form.control}
        name="recipientMode"
        render={({ field }) => (
          <FormItem>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  field.onChange("single");
                  setUseCustomRecipient(false);
                  form.setValue("recipient", "");
                }}
                className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors ${
                  field.value === "single"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/40"
                }`}
              >
                <Wallet className="size-5" />
                <span className="text-sm font-medium">Account</span>
              </button>
              <button
                type="button"
                onClick={() => field.onChange("group")}
                className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors ${
                  field.value === "group"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/40"
                }`}
              >
                <Users className="size-5" />
                <span className="text-sm font-medium">Group</span>
              </button>
            </div>
          </FormItem>
        )}
      />

      {recipientMode === "single" && (
        <div className="mt-3">
          {!useCustomRecipient ? (
            <div className="rounded-lg border bg-muted/30 p-2 md:p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">My Account</p>
                {address && (
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    {truncateAddress(address)}
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setUseCustomRecipient(true)}
              >
                Use custom
              </Button>
            </div>
          ) : (
            <FormField
              control={form.control}
              name="recipient"
              render={({ field, fieldState }) => (
                <FormItem>
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <AddressInput
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        placeholder="0x… or vitalik.eth"
                        error={fieldState.error?.message}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 text-xs h-9"
                      onClick={() => {
                        field.onChange("");
                        setUseCustomRecipient(false);
                      }}
                    >
                      Use my account
                    </Button>
                  </div>
                </FormItem>
              )}
            />
          )}
        </div>
      )}

      {recipientMode === "group" && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            Create a recipient group. Tax revenue will be distributed to all
            members below via a Pull Split.{" "}
            <a
              href="https://splits.org"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Powered by 0xSplits
            </a>
          </p>

          {splitFields.map((field, index) => (
            <div key={field.id} className="flex items-start gap-2">
              <div className="flex-1">
                <FormField
                  control={form.control}
                  name={`splitRecipients.${index}.address`}
                  render={({ field: addrField, fieldState }) => (
                    <AddressInput
                      value={addrField.value}
                      onChange={addrField.onChange}
                      onBlur={addrField.onBlur}
                      placeholder="0x… or ENS"
                      error={fieldState.error?.message}
                    />
                  )}
                />
              </div>
              <div className="w-24">
                <FormField
                  control={form.control}
                  name={`splitRecipients.${index}.percentAllocation`}
                  render={({ field: pctField }) => (
                    <div className="relative">
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={pctField.value}
                        onChange={(e) => {
                          const v = parseFloat(
                            normalizeDecimal(e.target.value),
                          );
                          pctField.onChange(Number.isNaN(v) ? 0 : v);
                        }}
                        className="pr-6 text-xs"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        %
                      </span>
                    </div>
                  )}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 shrink-0"
                disabled={splitFields.length <= 2}
                onClick={() => removeSplitRecipient(index)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}

          <SplitTotal />

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              appendSplitRecipient({
                address: "",
                percentAllocation: 0,
              })
            }
          >
            <Plus className="size-3.5 mr-1" />
            Add Recipient
          </Button>

          <Separator />

          <FormField
            control={form.control}
            name="distributorFeePercent"
            render={({ field: feeField }) => (
              <FormItem>
                <FormLabel>Distributor Fee</FormLabel>
                <div className="relative">
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={feeField.value}
                    onChange={(e) => {
                      const v = parseFloat(normalizeDecimal(e.target.value));
                      feeField.onChange(Number.isNaN(v) ? 0 : v);
                    }}
                    className="pr-6"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    %
                  </span>
                </div>
                <FormDescription>
                  Incentive for anyone who triggers distribution (0–10%)
                </FormDescription>
              </FormItem>
            )}
          />
        </div>
      )}
    </>
  );
}

function SplitTotal() {
  const form = useFormContext<CreateSlotFormValues>();
  const recipients = form.watch("splitRecipients");
  const total = recipients.reduce(
    (sum, r) => sum + (r.percentAllocation || 0),
    0,
  );

  return (
    <div className="flex items-center justify-between text-xs">
      <span
        className={
          Math.abs(total - 100) < 0.01 ? "text-green-600" : "text-destructive"
        }
      >
        Total: {total.toFixed(2)}%
        {Math.abs(total - 100) >= 0.01 && " (must be 100%)"}
      </span>
    </div>
  );
}
