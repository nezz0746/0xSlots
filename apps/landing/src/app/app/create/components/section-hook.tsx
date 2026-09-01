"use client";

import { findKnownHook, knownHooks } from "@0xslots/contracts/slots";
import { AlertCircle, Check, Loader2, Plug, ShieldCheck } from "lucide-react";
import { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import type { Address } from "viem";
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
import { useChain } from "@/context/chain";
import { AddressInput } from "../address-input";
import { useHookCheck } from "../hooks/use-hook-check";
import { useHasTenureFactory, useTenureHook } from "../hooks/use-tenure-hook";
import type { CreateSlotFormValues } from "../schema";
import { timeUnits, toSeconds } from "../sections";

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

  const available = knownHooks[chainId] ?? [];
  const chosenKnown = findKnownHook(chainId, hook as Address);
  const check = useHookCheck(hookMode === "custom" ? hook : "", chainId);

  // ── Minimum tenure, by duration ─────────────────────────────────────────
  const hasTenureFactory = useHasTenureFactory();
  const tenureValue = form.watch("tenureValue");
  const tenureUnit = form.watch("tenureUnit");
  const tenureSeconds = toSeconds(tenureValue, tenureUnit);
  const tenure = useTenureHook(tenureSeconds, hookMode === "tenure");

  /**
   * Keep `hook` in step with the predicted address.
   *
   * The address is DERIVED from the duration, so the field the form submits is
   * not something the user types — it is the answer to what they picked.
   * Writing it back here rather than at submit time means the summary card and
   * the validation both see the address the button will actually use.
   *
   * In an effect rather than during render: `setValue` triggers a re-render,
   * and doing that from the render pass is the "update a component while
   * rendering another" warning at best and a loop at worst.
   */
  const predicted = tenure.data?.hook;
  useEffect(() => {
    if (hookMode === "tenure" && predicted && hook !== predicted)
      form.setValue("hook", predicted, { shouldValidate: true });
  }, [hookMode, predicted, hook, form]);

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
                {/* By duration, not by address. One hook per tenure lives at a
                    CREATE2 address the factory derives, so this is a choice of
                    NUMBER — the successor to the old occupancy-policy picker,
                    which deployed a policy contract the same way. */}
                {hasTenureFactory && (
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

            {/* A known hook is offered by name, so it owes the reader one line
                on what attaching it will do to them. */}
            {chosenKnown && (
              <p className="flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
                <Plug className="mt-0.5 size-3 shrink-0" />
                {chosenKnown.description}
              </p>
            )}

            {hookMode === "none" && (
              <FormDescription>
                Anyone may take this slot at any moment by outbidding its
                declared price. That is the plain Harberger behaviour, and the
                one whose rules a reader can hold in their head.
              </FormDescription>
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

                <p className="text-[11px] leading-snug text-muted-foreground">
                  Nobody may buy this slot out from under its occupant for that
                  long, and the occupant funds the whole window up front.
                  Liquidation is untouched — an occupant who runs dry can still
                  be evicted at any moment.
                </p>

                {/* The derived address, and whether it exists yet. The second
                    half is the one worth saying: one hook per duration means a
                    common tenure is already deployed and creating costs one
                    transaction, while an unusual one needs a deploy first —
                    which is a second wallet prompt, and a surprise if unsaid. */}
                {tenure.isLoading && (
                  <p className="flex items-center gap-1.5 text-[10px] text-blue-500">
                    <Loader2 className="size-3 animate-spin" />
                    Deriving the hook address…
                  </p>
                )}
                {tenure.data && (
                  <div className="space-y-1 border bg-muted/40 p-2">
                    <p className="font-mono text-[10px] break-all text-muted-foreground">
                      {tenure.data.hook}
                    </p>
                    {tenure.data.deployed ? (
                      <p className="flex items-center gap-1.5 text-[10px] text-green-600">
                        <Check className="size-3" />
                        Already deployed — creating this slot is one
                        transaction.
                      </p>
                    ) : (
                      <p className="flex items-start gap-1.5 text-[10px] text-amber-600">
                        <AlertCircle className="mt-0.5 size-3 shrink-0" />
                        No hook exists for this duration yet. It will be
                        deployed first, so expect two transactions — the deploy
                        is permissionless and anyone reusing this duration later
                        gets the same address for free.
                      </p>
                    )}
                  </div>
                )}
                {tenure.isError && (
                  <p className="flex items-start gap-1.5 text-[10px] text-destructive">
                    <AlertCircle className="mt-0.5 size-3 shrink-0" />
                    Could not reach the tenure factory on this chain.
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

                {check.data?.status === "ok" && (
                  <>
                    <p className="flex items-center gap-1.5 text-[10px] text-green-600">
                      <Check className="size-3" />
                      Subscribes to {check.data.subscriptions.join(", ")}
                    </p>
                    {check.data.attested ? (
                      <p className="flex items-center gap-1.5 text-[10px] text-green-600">
                        <ShieldCheck className="size-3" />
                        Attested by the factory operator
                      </p>
                    ) : (
                      <p className="flex items-start gap-1.5 text-[10px] text-amber-600">
                        <AlertCircle className="mt-0.5 size-3 shrink-0" />
                        Not attested. The factory accepts it anyway —
                        attestation records what someone vouched for, not what
                        is permitted — so read the code before you attach it.
                      </p>
                    )}
                  </>
                )}

                {check.data?.status === "inert" && (
                  <p className="flex items-start gap-1.5 text-[10px] text-destructive">
                    <AlertCircle className="mt-0.5 size-3 shrink-0" />
                    Subscribes to nothing, so the slot will refuse it. A hook
                    that wants no callbacks can never run.
                  </p>
                )}

                {check.data?.status === "not-a-hook" && (
                  <p className="flex items-start gap-1.5 text-[10px] text-destructive">
                    <AlertCircle className="mt-0.5 size-3 shrink-0" />
                    There is a contract here, but it does not answer{" "}
                    <code>hooks()</code> — so it is not a hook.
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

            {/* The guarantee, stated wherever a hook is being chosen. Ported
                verbatim in spirit from the occupancy section: a hook can delay
                who may take the slot, but never blocks liquidation and never
                stops the occupant leaving — the core forbids both. */}
            <FormDescription>
              A hook declares which callbacks it wants, and the slot snapshots
              that list once at attach time — it cannot widen its own reach
              later. It may refuse a buy, a sell or a reprice; it may never
              block liquidation or stop the occupant leaving.
            </FormDescription>

            {hookMode !== "none" && (
              <FormDescription className="text-amber-600 dark:text-amber-500">
                A tenure hook softens Harberger — forced sale is delayed, not
                removed. Insolvency still ends an occupancy at any moment.
              </FormDescription>
            )}

            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
