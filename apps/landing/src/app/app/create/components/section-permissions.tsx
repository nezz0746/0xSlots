import { useFormContext } from "react-hook-form";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField, FormItem, FormLabel } from "@/components/ui/form";
import { AddressInput } from "../address-input";
import type { CreateSlotFormValues } from "../schema";

const FLAGS = [
  { name: "mutableTax", label: "Tax rate and minimum runway" },
  { name: "mutableRecipient", label: "Recipient" },
  { name: "mutableHook", label: "Hook" },
] as const;

/**
 * What stays fixed after creation, and who holds the rest.
 *
 * Each ticked term can be changed later by the manager, landing when the slot
 * next changes hands. With nothing ticked the slot is immutable forever and
 * the protocol refuses a manager on it.
 */
export function SectionPermissions() {
  const { address } = useAccount();
  const form = useFormContext<CreateSlotFormValues>();
  const needsManager =
    form.watch("mutableTax") ||
    form.watch("mutableRecipient") ||
    form.watch("mutableHook");

  return (
    <div>
      <p className="text-sm font-medium mb-4">Mutability</p>

      <div className="space-y-3">
        {FLAGS.map((flag) => (
          <FormField
            key={flag.name}
            control={form.control}
            name={flag.name}
            render={({ field }) => (
              <FormItem className="flex items-start gap-2">
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  className="mt-0.5"
                />
                <FormLabel className="cursor-pointer mt-0!">
                  {flag.label}
                </FormLabel>
              </FormItem>
            )}
          />
        ))}
      </div>

      {needsManager ? (
        <div className="mt-4 border-t pt-3">
          <FormField
            control={form.control}
            name="manager"
            render={({ field, fieldState }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>Manager (required)</FormLabel>
                  {address && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() =>
                        form.setValue("manager", address, {
                          shouldValidate: true,
                        })
                      }
                    >
                      Use my account
                    </Button>
                  )}
                </div>
                <AddressInput
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  placeholder="0x… or a collective"
                  hint="Proposes changes to the ticked terms, each applied when the slot next changes hands, and can hand the slot to another manager."
                  error={fieldState.error?.message}
                />
              </FormItem>
            )}
          />
        </div>
      ) : (
        <p className="mt-4 border-t pt-3 text-[11px] leading-snug text-muted-foreground">
          <strong className="font-medium text-foreground">No manager.</strong>{" "}
          With nothing mutable this slot is fixed forever, and the protocol
          refuses a manager on it.
        </p>
      )}
    </div>
  );
}
