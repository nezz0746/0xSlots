"use client";

import { findKnownModule, knownModules } from "@0xslots/contracts/slots";
import { unpackScopes, NO_SETTINGS } from "@0xslots/sdk/slots";
import { AlertCircle, Loader2, Plug } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import { type Address, type Hex, isAddress } from "viem";
import { useReadContract } from "wagmi";
import { ModuleScopeRow } from "@/components/module-scopes";
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
import { useModuleCheck } from "@/hooks/use-module-check";
import { useModuleDefinition } from "@/hooks/use-module-schema";
import { moduleAbi } from "@/lib/module-abi";
import { AddressInput } from "../address-input";
import type { CreateSlotFormValues } from "../schema";
import { ModuleSettings } from "./module-settings";

/**
 * The slot's one extension point — and, with it, its occupancy terms.
 *
 * This section is the successor to two that the old form kept apart: the
 * module picker (what the slot DOES) and the occupancy policy picker (when it
 * can be taken from you, and on what terms). The protocol merged them, so the
 * form does too — a minimum-tenure rule is now a module like any other, and
 * splitting one address across two questions would only invent a distinction
 * the chain no longer makes.
 *
 * What survives from the occupancy section is its copy, because the guarantee
 * it was written to state is unchanged and is the thing people most need told:
 * a module may refuse a buy, a sell or a reprice, and may NEVER block
 * liquidation or trap an occupant who wants out.
 */
export function SectionModule() {
  const form = useFormContext<CreateSlotFormValues>();
  const { chainId } = useChain();
  const moduleMode = form.watch("moduleMode");
  const module = form.watch("module");

  const available = knownModules[chainId] ?? [];
  const chosenKnown = findKnownModule(chainId, module as Address);
  // Every mode, not just `custom`. The scopes below are read from the
  // module itself, so a module picked by name deserves the same scrutiny as one
  // pasted in — arguably more, since nobody typed its address.
  const check = useModuleCheck(module, chainId);
  const declared = useDeclared(module);

  return (
    <FormField
      control={form.control}
      name="module"
      render={({ field, fieldState }) => {
        const selectValue =
          moduleMode === "custom"
            ? "custom"
            : moduleMode === "none" || !field.value
              ? "none"
              : field.value;

        return (
          <FormItem>
            <FormLabel>Module</FormLabel>
            <Select
              value={selectValue}
              onValueChange={(v) => {
                // Open the configuration gate on every switch. The form that
                // closed it belongs to the module being left, and it unmounts
                // without a word — so a refused value on one module would
                // otherwise keep the submit button disabled after moving to a
                // module, or to no module at all, with nothing on screen to say
                // why. Whatever comes next reports its own verdict.
                form.setValue("settingsOk", true, { shouldValidate: true });
                if (v === "none") {
                  form.setValue("moduleMode", "none", { shouldValidate: true });
                  field.onChange("");
                } else if (v === "custom") {
                  form.setValue("moduleMode", "custom", {
                    shouldValidate: true,
                  });
                  field.onChange("");
                } else {
                  form.setValue("moduleMode", "known", {
                    shouldValidate: true,
                  });
                  field.onChange(v);
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a module" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No module — instant buy</SelectItem>
                {available.map((h) => (
                  <SelectItem key={h.address} value={h.address}>
                    {h.name}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Custom address</SelectItem>
              </SelectContent>
            </Select>

            {/* Every mode, not just `custom`: a module picked by name gets the
                same row as one pasted in, and it is the same row the slot page
                draws once it is attached. */}
            {check.data?.status === "ok" && (
              <ModuleScopeRow
                scopes={
                  declared ? unpackScopes(declared.scopes) : check.data.scopes
                }
                fee={declared?.fee}
                className="mt-2"
              />
            )}

            {chosenKnown && (
              <p className="flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
                {/* The same mark the modules page shows, so a module is
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

            {moduleMode === "custom" && (
              <div className="mt-2 space-y-1">
                <AddressInput
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  placeholder="0x… module address"
                  error={fieldState.error?.message}
                />

                {check.isLoading && (
                  <p className="flex items-center gap-1.5 text-[10px] text-blue-500">
                    <Loader2 className="size-3 animate-spin" />
                    Checking module…
                  </p>
                )}

                {check.data?.status === "inert" && (
                  <p className="flex items-start gap-1.5 text-[10px] text-destructive">
                    <AlertCircle className="mt-0.5 size-3 shrink-0" />
                    Subscribes to nothing — the slot will refuse it.
                  </p>
                )}

                {check.data?.status === "not-a-app" && (
                  <p className="flex items-start gap-1.5 text-[10px] text-destructive">
                    <AlertCircle className="mt-0.5 size-3 shrink-0" />
                    Not a module — no <code>scopes()</code>.
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

            {/* Whatever this module says it needs, as a form it described
                itself — for a module picked BY NAME as much as for one pasted
                in. It only rendered under "Custom address" before, so choosing
                AdLand from the list offered no window at all, and a module that
                REQUIRES settings would have been created with empty ones and
                reverted at attach. Keyed on the address so a switch between
                modules resets the control rather than carrying a half-typed
                value across. */}
            {(moduleMode === "known" || moduleMode === "custom") && (
              <ModuleDeclaredSettings key={field.value} module={field.value} />
            )}

            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}

/**
 * A module's own configuration form, from its own declaration.
 *
 * Read from `metadata()`: the type comes from the schema's `x-abi`, the
 * label, unit and bounds from the same document, and the verdict from
 * `validateSettings` — the same function the slot will run.
 *
 * A module that publishes nothing renders nothing, which is most of them and is
 * why this is silent rather than empty. There is no second, hand-written form
 * beside it: minimum tenure had one, and a rule with two forms is a rule with
 * two answers.
 */
function ModuleDeclaredSettings({ module }: { module: string }) {
  const { setValue } = useFormContext<CreateSlotFormValues>();
  const { definition } = useModuleDefinition(module);
  const [values, setValues] = useState<Record<string, string>>({});

  // One configuration per slot: a module that takes none renders nothing.
  const config = definition?.settings?.fields.length
    ? definition.settings
    : undefined;

  /**
   * Clear the settings when the ADDRESS changes, so ones meant for one module are
   * never submitted for another.
   *
   * Guarded by a ref rather than by the dependency array. `useFormContext`
   * returns whatever was spread into the provider, which is a fresh object on
   * every render — so an effect that depends on it runs on every render, and
   * `setValues([])` is a new array every time, which re-renders, which runs it
   * again. That is an infinite loop, and it took the page down the moment this
   * mode was selected.
   */
  const lastModule = useRef(module);
  useEffect(() => {
    if (lastModule.current === module) return;
    lastModule.current = module;
    setValues({});
    // A module with a form reports its own defaults as it mounts, and child
    // effects run first — clearing here would overwrite them.
    if (!config) setValue("customSettings", "");
  }, [module, config, setValue]);

  // A module that asks for nothing cannot be misconfigured, so the gate opens —
  // and it must open again when the form moves from a module that asked to one
  // that does not, or the button stays disabled with nothing on screen to say
  // why.
  useEffect(() => {
    if (!config) setValue("settingsOk", true, { shouldValidate: true });
  }, [config, setValue]);

  if (!config) return null;

  return (
    <div className="mt-2 border-l-2 border-muted pl-3">
      <ModuleSettings
        moduleAddress={module}
        config={config}
        values={values}
        onChange={(next, settings) => {
          setValues(next);
          setValue("customSettings", settings ?? "", { shouldValidate: true });
        }}
        onVerdict={(ok) => setValue("settingsOk", ok, { shouldValidate: true })}
      />
    </div>
  );
}

/**
 * What the module asks of a slot configured with the form's current settings: its
 * scopes and its fee, as the module itself declares them. The slot copies
 * this when the module attaches; nobody creating a slot chooses it.
 */
function useDeclared(module: string) {
  const { chainId } = useChain();
  const data = useFormContext<CreateSlotFormValues>().watch("customSettings");
  const valid = isAddress(module);
  const settings = (data || NO_SETTINGS) as Hex;
  const scopes = useReadContract({
    address: valid ? (module as Address) : undefined,
    abi: moduleAbi,
    functionName: "scopes",
    args: [settings],
    chainId,
    query: { enabled: valid },
  }).data;
  const fee = useReadContract({
    address: valid ? (module as Address) : undefined,
    abi: moduleAbi,
    functionName: "fee",
    args: [settings],
    chainId,
    query: { enabled: valid },
  }).data;
  return scopes === undefined || fee === undefined
    ? undefined
    : { scopes, fee };
}
