"use client";

import {
  findKnownHook,
  knownHooks,
  minimumTenureHookAddress,
} from "@0xslots/contracts/slots";
import {
  AlertCircle,
  Check,
  Eye,
  Loader2,
  Plug,
  ShieldAlert,
} from "lucide-react";
import { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import type { Address } from "viem";
import { HookFlagRow } from "@/components/hook-flags";
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
import { useChain } from "@/context/chain";
import { AddressInput } from "../address-input";
import { useHookCheck } from "../hooks/use-hook-check";
import type { CreateSlotFormValues } from "../schema";
import { timeUnits } from "../sections";

/**
 * The slot's one extension point — and, with it, its occupancy terms.
 *
 * This section is the successor to two that the old form kept apart: the
 * module picker (what the slot DOES) and the occupancy policy picker (when it
 * can be taken from you, and on what terms). The protocol merged them, so the
 * form does too — a minimum-tenure rule is now a hook like any other, and
 * splitting one address across two questions would only invent a distinction
 * the chain no longer makes.
 *
 * What survives from the occupancy section is its copy, because the guarantee
 * it was written to state is unchanged and is the thing people most need told:
 * a hook may refuse a buy, a sell or a reprice, and may NEVER block
 * liquidation or trap an occupant who wants out.
 */
export function SectionHook() {
  const form = useFormContext<CreateSlotFormValues>();
  const { chainId } = useChain();
  const hookMode = form.watch("hookMode");
  const hook = form.watch("hook");

  // Minus the tenure hook: it gets its own entry below, because picking it is
  // picking a NUMBER, and listing it here as well showed it twice.
  const available = (knownHooks[chainId] ?? []).filter(
    (h) =>
      h.address.toLowerCase() !==
      minimumTenureHookAddress[chainId]?.toLowerCase(),
  );
  const chosenKnown = findKnownHook(chainId, hook as Address);
  // Every mode, not just `custom`. The permissions below are read from the
  // hook itself, so a hook picked by name deserves the same scrutiny as one
  // pasted in — arguably more, since nobody typed its address.
  const check = useHookCheck(hook, chainId);

  // ── Minimum tenure ──────────────────────────────────────────────────────
  //
  // A duration, and nothing else. The address no longer moves with it: one hook
  // per chain serves every window, and the number the creator picks becomes the
  // slot's `hookData` rather than a second contract.
  const tenureHook = minimumTenureHookAddress[chainId];
  const tenureValue = form.watch("tenureValue");
  const tenureUnit = form.watch("tenureUnit");

  /**
   * Keep `hook` pointed at this chain's tenure hook while that mode is chosen.
   *
   * The field the form submits is not something the user types — it is the
   * answer to what they picked. Writing it back here rather than at submit time
   * means the summary card and the validation both see the address the button
   * will actually use.
   *
   * In an effect rather than during render: `setValue` triggers a re-render,
   * and doing that from the render pass is the "update a component while
   * rendering another" warning at best and a loop at worst.
   */
  useEffect(() => {
    if (hookMode === "tenure" && tenureHook && hook !== tenureHook)
      form.setValue("hook", tenureHook, { shouldValidate: true });
  }, [hookMode, tenureHook, hook, form]);

  return (
    <FormField
      control={form.control}
      name="hook"
      render={({ field, fieldState }) => {
        const selectValue =
          hookMode === "custom"
            ? "custom"
            : hookMode === "tenure"
              ? "tenure"
              : hookMode === "none" || !field.value
                ? "none"
                : field.value;

        return (
          <FormItem>
            <FormLabel>Hook</FormLabel>
            <Select
              value={selectValue}
              onValueChange={(v) => {
                if (v === "none") {
                  form.setValue("hookMode", "none", { shouldValidate: true });
                  field.onChange("");
                } else if (v === "tenure") {
                  form.setValue("hookMode", "tenure", { shouldValidate: true });
                  field.onChange("");
                } else if (v === "custom") {
                  form.setValue("hookMode", "custom", { shouldValidate: true });
                  field.onChange("");
                } else {
                  form.setValue("hookMode", "known", { shouldValidate: true });
                  field.onChange(v);
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a hook" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No hook — instant buy</SelectItem>
                {/* A choice of NUMBER, not of address — the successor to the
                    old occupancy-policy picker. The duration is stored on the
                    slot and handed to the hook on every callback, so this one
                    address serves every window. */}
                {tenureHook && (
                  <SelectItem value="tenure">
                    Minimum tenure — choose a duration
                  </SelectItem>
                )}
                {available.map((h) => (
                  <SelectItem key={h.address} value={h.address}>
                    {h.name}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Custom address</SelectItem>
              </SelectContent>
            </Select>

            {/* Every mode, not just `custom`: a hook picked by name gets the
                same row as one pasted in, and it is the same row the slot page
                draws once it is attached. */}
            {check.data?.status === "ok" && (
              <HookFlagRow flags={check.data.flags} className="mt-2" />
            )}

            {chosenKnown && (
              <p className="flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
                <Plug className="mt-0.5 size-3 shrink-0" />
                {chosenKnown.description}
              </p>
            )}

            {hookMode === "tenure" && (
              <div className="mt-2 space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={tenureValue}
                    inputMode="decimal"
                    onChange={(e) =>
                      form.setValue("tenureValue", e.target.value, {
                        shouldValidate: true,
                      })
                    }
                    className="w-24"
                    aria-label="Minimum tenure"
                  />
                  <select
                    value={tenureUnit}
                    onChange={(e) =>
                      form.setValue(
                        "tenureUnit",
                        e.target.value as (typeof timeUnits)[number],
                        { shouldValidate: true },
                      )
                    }
                    className="border bg-background px-2 text-sm"
                    aria-label="Tenure unit"
                  >
                    {timeUnits.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                {/* The address, stated rather than derived. Worth showing even
                    though the creator did not choose it: it is what the slot
                    will point at, and it is the same one for every duration —
                    which is the fact that replaced "expect two transactions". */}
                {tenureHook && (
                  <p className="text-[10px] break-all text-muted-foreground">
                    {tenureHook}
                  </p>
                )}
              </div>
            )}

            {hookMode === "custom" && (
              <div className="mt-2 space-y-1">
                <AddressInput
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  placeholder="0x… hook address"
                  error={fieldState.error?.message}
                />

                {check.isLoading && (
                  <p className="flex items-center gap-1.5 text-[10px] text-blue-500">
                    <Loader2 className="size-3 animate-spin" />
                    Checking hook…
                  </p>
                )}

                {check.data?.status === "inert" && (
                  <p className="flex items-start gap-1.5 text-[10px] text-destructive">
                    <AlertCircle className="mt-0.5 size-3 shrink-0" />
                    Subscribes to nothing — the slot will refuse it.
                  </p>
                )}

                {check.data?.status === "not-a-hook" && (
                  <p className="flex items-start gap-1.5 text-[10px] text-destructive">
                    <AlertCircle className="mt-0.5 size-3 shrink-0" />
                    Not a hook — no <code>subscriptions()</code>.
                  </p>
                )}

                {check.data?.status === "no-code" && (
                  <p className="flex items-start gap-1.5 text-[10px] text-destructive">
                    <AlertCircle className="mt-0.5 size-3 shrink-0" />
                    No contract code at this address on the selected chain —
                    usually an address copied from another network.
                  </p>
                )}
              </div>
            )}

            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
