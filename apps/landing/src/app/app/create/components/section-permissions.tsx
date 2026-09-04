import { useFormContext } from "react-hook-form";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { AddressInput } from "../address-input";
import type { CreateSlotFormValues } from "../schema";

/**
 * What stays fixed after creation, and who holds the rest.
 *
 * The old form had three flags — tax, module, occupancy — kept deliberately
 * apart, because a holder who accepted a swappable ad module had not thereby
 * accepted swappable occupancy terms. The protocol has since merged module and
 * policy into one `hook`, so that separation no longer exists to be preserved:
 * `mutableHook` now governs BOTH what the slot does and on what terms it can
 * be taken. That is a real widening of what the flag means, and it is called
 * out in the field's own description rather than left for someone to discover.
 */
export function SectionPermissions() {
  const { address } = useAccount();
  const form = useFormContext<CreateSlotFormValues>();
  const mutableTax = form.watch("mutableTax");
  const mutableHook = form.watch("mutableHook");
  const needsManager = mutableTax || mutableHook;

  return (
    <div>
      <p className="text-sm font-medium mb-4">Mutability</p>

      <div className="space-y-3">
        <FormField
          control={form.control}
          name="mutableTax"
          render={({ field }) => (
            <FormItem className="flex items-start gap-2">
              <Checkbox
                checked={field.value}
                onCheckedChange={field.onChange}
                className="mt-0.5"
              />
              <div className="min-w-0">
                <FormLabel className="cursor-pointer mt-0!">Tax rate</FormLabel>
              </div>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="mutableHook"
          render={({ field }) => (
            <FormItem className="flex items-start gap-2">
              <Checkbox
                checked={field.value}
                onCheckedChange={field.onChange}
                className="mt-0.5"
              />
              <div className="min-w-0">
                <FormLabel className="cursor-pointer mt-0!">Hook</FormLabel>
              </div>
            </FormItem>
          )}
        />
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
                  hint="Required, because something above is mutable. Somebody has to be able to exercise it."
                  error={fieldState.error?.message}
                />
              </FormItem>
            )}
          />
        </div>
      ) : (
        /* Not "no manager needed" — no manager ALLOWED. `initialize` reverts
           if one is given on a slot with nothing mutable, and that refusal is
           the entire point: the absence of a manager is what makes the promise
           real rather than a matter of somebody's restraint. */
        <p className="mt-4 border-t pt-3 text-[11px] leading-snug text-muted-foreground">
          <strong className="font-medium text-foreground">No manager.</strong>{" "}
          With nothing mutable this slot is immutable forever, and the protocol
          refuses a manager on it — the absence of one is what makes the promise
          real rather than a matter of somebody&apos;s restraint.
        </p>
      )}
    </div>
  );
}
