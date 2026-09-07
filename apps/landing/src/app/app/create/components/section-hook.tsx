"use client";

import { findKnownHook, knownHooks } from "@0xslots/contracts/slots";
import { AlertCircle, Loader2, Plug } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import type { Address } from "viem";
import { HookFlagRow } from "@/components/hook-flags";
import {
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useChain } from "@/context/chain";
import { useHookCheck } from "@/hooks/use-hook-check";
import { useHookSchema } from "@/hooks/use-hook-schema";
import { AddressInput } from "../address-input";
import type { CreateSlotFormValues } from "../schema";
import { HookConfig } from "./hook-config";

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
  // Every mode, not just `custom`. The permissions below are read from the
  // hook itself, so a hook picked by name deserves the same scrutiny as one
  // pasted in — arguably more, since nobody typed its address.
  const check = useHookCheck(hook, chainId);

  return (
    <FormField
      control={form.control}
      name="hook"
      render={({ field, fieldState }) => {
        const selectValue =
          hookMode === "custom"
            ? "custom"
            : hookMode === "none" || !field.value
              ? "none"
              : field.value;

        return (
          <FormItem>
            <FormLabel>Hook</FormLabel>
            <Select
              value={selectValue}
              onValueChange={(v) => {
                // Open the configuration gate on every switch. The form that
                // closed it belongs to the hook being left, and it unmounts
                // without a word — so a refused value on one hook would
                // otherwise keep the submit button disabled after moving to a
                // hook, or to no hook at all, with nothing on screen to say
                // why. Whatever comes next reports its own verdict.
                form.setValue("hookDataOk", true, { shouldValidate: true });
                if (v === "none") {
                  form.setValue("hookMode", "none", { shouldValidate: true });
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
                {/* The same mark the hooks page shows, so a hook is
                    recognisable in the place it is chosen as well as in the
                    place it is listed. */}
                {chosenKnown.logo ? (
                  <Image
                    src={chosenKnown.logo}
                    alt=""
                    width={12}
                    height={12}
                    className="mt-0.5 size-3 shrink-0 object-contain"
                    unoptimized
                  />
                ) : (
                  <Plug className="mt-0.5 size-3 shrink-0" />
                )}
                <span>
                  {chosenKnown.description}{" "}
                  {chosenKnown.url && (
                    <a
                      href={chosenKnown.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2 hover:text-foreground"
                    >
                      {chosenKnown.by}
                    </a>
                  )}
                </span>
              </p>
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

            {/* Whatever this hook says it needs, as a form it described
                itself — for a hook picked BY NAME as much as for one pasted
                in. It only rendered under "Custom address" before, so choosing
                AdLand from the list offered no window at all, and a hook that
                REQUIRES a word would have been created with an empty one and
                reverted at attach. Keyed on the address so a switch between
                hooks resets the control rather than carrying a half-typed
                value across. */}
            {(hookMode === "known" || hookMode === "custom") && (
              <HookDeclaredConfig key={field.value} hook={field.value} />
            )}

            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}

/**
 * A hook's own configuration form, from its own declaration.
 *
 * Read from `descriptors()`: the type comes from a plain ABI signature, the
 * label, unit and bounds from the hook's published constants, and the verdict
 * from simulating `validateHookData` — the same function the slot will run.
 *
 * A hook that publishes nothing renders nothing, which is most of them and is
 * why this is silent rather than empty. There is no second, hand-written form
 * beside it: minimum tenure had one, and a rule with two forms is a rule with
 * two answers.
 */
function HookDeclaredConfig({ hook }: { hook: string }) {
  const { setValue } = useFormContext<CreateSlotFormValues>();
  const { families } = useHookSchema(hook);
  const [values, setValues] = useState<string[]>([]);

  // A hook may answer for several families — AdLand does creatives AND
  // tenure. Only the ones that take configuration are rendered, and they share
  // the slot's one word, so the first is the one this writes.
  const configurable = families.filter((f) => f.fields.length > 0);
  const family = configurable[0];

  /**
   * Clear the word when the ADDRESS changes, so one meant for one hook is
   * never submitted for another.
   *
   * Guarded by a ref rather than by the dependency array. `useFormContext`
   * returns whatever was spread into the provider, which is a fresh object on
   * every render — so an effect that depends on it runs on every render, and
   * `setValues([])` is a new array every time, which re-renders, which runs it
   * again. That is an infinite loop, and it took the page down the moment this
   * mode was selected.
   */
  const lastHook = useRef(hook);
  useEffect(() => {
    if (lastHook.current === hook) return;
    lastHook.current = hook;
    setValues([]);
    setValue("customHookData", "");
  }, [hook, setValue]);

  // A hook that asks for nothing cannot be misconfigured, so the gate opens —
  // and it must open again when the form moves from a hook that asked to one
  // that does not, or the button stays disabled with nothing on screen to say
  // why.
  useEffect(() => {
    if (!family) setValue("hookDataOk", true, { shouldValidate: true });
  }, [family, setValue]);

  if (!family) return null;

  return (
    <div className="mt-2 border-l-2 border-muted pl-3">
      <HookConfig
        hookAddress={hook}
        family={family}
        value={values}
        onChange={(next, encoded) => {
          setValues(next);
          setValue("customHookData", encoded ?? "", {
            shouldValidate: true,
          });
        }}
        onVerdict={(ok) => setValue("hookDataOk", ok, { shouldValidate: true })}
      />
      {configurable.length > 1 && (
        <p className="mt-1 text-[10px] text-muted-foreground">
          This hook also describes {configurable.length - 1} other configurable
          {configurable.length === 2 ? " family" : " families"}, which share the
          same word.
        </p>
      )}
    </div>
  );
}
