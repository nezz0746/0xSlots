"use client";

import {
  findKnownApp,
  knownApps,
  minimumTenureAppAbi,
} from "@0xslots/contracts/slots";
import { unpackScopes, ZERO_SETTINGS } from "@0xslots/sdk/slots";
import { AlertCircle, Loader2, Plug } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import { type Address, type Hex, isAddress } from "viem";
import { useReadContract } from "wagmi";
import { AppScopeRow } from "@/components/app-scopes";
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
import { useAppCheck } from "@/hooks/use-app-check";
import { useAppDefinition } from "@/hooks/use-app-schema";
import { AddressInput } from "../address-input";
import type { CreateSlotFormValues } from "../schema";
import { HookConfig } from "./app-config";

/**
 * The slot's one extension point — and, with it, its occupancy terms.
 *
 * This section is the successor to two that the old form kept apart: the
 * module picker (what the slot DOES) and the occupancy policy picker (when it
 * can be taken from you, and on what terms). The protocol merged them, so the
 * form does too — a minimum-tenure rule is now an app like any other, and
 * splitting one address across two questions would only invent a distinction
 * the chain no longer makes.
 *
 * What survives from the occupancy section is its copy, because the guarantee
 * it was written to state is unchanged and is the thing people most need told:
 * an app may refuse a buy, a sell or a reprice, and may NEVER block
 * liquidation or trap an occupant who wants out.
 */
export function SectionApp() {
  const form = useFormContext<CreateSlotFormValues>();
  const { chainId } = useChain();
  const hookMode = form.watch("hookMode");
  const app = form.watch("app");

  const available = knownApps[chainId] ?? [];
  const chosenKnown = findKnownApp(chainId, app as Address);
  // Every mode, not just `custom`. The scopes below are read from the
  // app itself, so an app picked by name deserves the same scrutiny as one
  // pasted in — arguably more, since nobody typed its address.
  const check = useAppCheck(app, chainId);
  const offer = useDeclaredHookOffer(app);

  return (
    <FormField
      control={form.control}
      name="app"
      render={({ field, fieldState }) => {
        const selectValue =
          hookMode === "custom"
            ? "custom"
            : hookMode === "none" || !field.value
              ? "none"
              : field.value;

        return (
          <FormItem>
            <FormLabel>App</FormLabel>
            <Select
              value={selectValue}
              onValueChange={(v) => {
                // Open the configuration gate on every switch. The form that
                // closed it belongs to the app being left, and it unmounts
                // without a word — so a refused value on one app would
                // otherwise keep the submit button disabled after moving to a
                // app, or to no app at all, with nothing on screen to say
                // why. Whatever comes next reports its own verdict.
                form.setValue("settingsOk", true, { shouldValidate: true });
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
                <SelectValue placeholder="Select an app" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No app — instant buy</SelectItem>
                {available.map((h) => (
                  <SelectItem key={h.address} value={h.address}>
                    {h.name}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Custom address</SelectItem>
              </SelectContent>
            </Select>

            {/* Every mode, not just `custom`: an app picked by name gets the
                same row as one pasted in, and it is the same row the slot page
                draws once it is attached. */}
            {check.data?.status === "ok" && (
              <AppScopeRow
                scopes={
                  offer
                    ? unpackScopes(offer.scopes)
                    : check.data.scopes
                }
                fee={offer}
                className="mt-2"
              />
            )}

            {chosenKnown && (
              <p className="flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
                {/* The same mark the apps page shows, so an app is
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
                  placeholder="0x… app address"
                  error={fieldState.error?.message}
                />

                {check.isLoading && (
                  <p className="flex items-center gap-1.5 text-[10px] text-blue-500">
                    <Loader2 className="size-3 animate-spin" />
                    Checking app…
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
                    Not an app — no <code>manifest()</code>.
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

            {/* Whatever this app says it needs, as a form it described
                itself — for an app picked BY NAME as much as for one pasted
                in. It only rendered under "Custom address" before, so choosing
                AdLand from the list offered no window at all, and an app that
                REQUIRES a word would have been created with an empty one and
                reverted at attach. Keyed on the address so a switch between
                apps resets the control rather than carrying a half-typed
                value across. */}
            {(hookMode === "known" || hookMode === "custom") && (
              <HookDeclaredConfig key={field.value} app={field.value} />
            )}

            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}

/**
 * An app's own configuration form, from its own declaration.
 *
 * Read from `definition()`: the type comes from the schema's `x-abi`, the
 * label, unit and bounds from the app's published constants, and the verdict
 * from simulating `checkSettings` — the same function the slot will run.
 *
 * An app that publishes nothing renders nothing, which is most of them and is
 * why this is silent rather than empty. There is no second, hand-written form
 * beside it: minimum tenure had one, and a rule with two forms is a rule with
 * two answers.
 */
function HookDeclaredConfig({ app }: { app: string }) {
  const { setValue } = useFormContext<CreateSlotFormValues>();
  const { definition } = useAppDefinition(app);
  const [values, setValues] = useState<Record<string, string>>({});

  // One word, so one configuration: an app that takes none renders nothing.
  const config = definition?.config?.fields.length ? definition.config : undefined;

  /**
   * Clear the word when the ADDRESS changes, so one meant for one app is
   * never submitted for another.
   *
   * Guarded by a ref rather than by the dependency array. `useFormContext`
   * returns whatever was spread into the provider, which is a fresh object on
   * every render — so an effect that depends on it runs on every render, and
   * `setValues([])` is a new array every time, which re-renders, which runs it
   * again. That is an infinite loop, and it took the page down the moment this
   * mode was selected.
   */
  const lastHook = useRef(app);
  useEffect(() => {
    if (lastHook.current === app) return;
    lastHook.current = app;
    setValues({});
    setValue("customSettings", "");
  }, [app, setValue]);

  // An app that asks for nothing cannot be misconfigured, so the gate opens —
  // and it must open again when the form moves from an app that asked to one
  // that does not, or the button stays disabled with nothing on screen to say
  // why.
  useEffect(() => {
    if (!config) setValue("settingsOk", true, { shouldValidate: true });
  }, [config, setValue]);

  if (!config) return null;

  return (
    <div className="mt-2 border-l-2 border-muted pl-3">
      <HookConfig
        hookAddress={app}
        config={config}
        values={values}
        onChange={(next, word) => {
          setValues(next);
          setValue("customSettings", word ?? "", { shouldValidate: true });
        }}
        onVerdict={(ok) => setValue("settingsOk", ok, { shouldValidate: true })}
      />
    </div>
  );
}

/**
 * What the app asks of a slot configured with the form's current word: its
 * scopes and its fee, as the app itself declares them. The slot copies
 * this when the app attaches; nobody creating a slot chooses it.
 */
function useDeclaredHookOffer(app: string) {
  const { chainId } = useChain();
  const data = useFormContext<CreateSlotFormValues>().watch("customSettings");
  const valid = isAddress(app);
  return useReadContract({
    address: valid ? (app as Address) : undefined,
    abi: minimumTenureAppAbi,
    functionName: "manifest",
    args: [(data || ZERO_SETTINGS) as Hex],
    chainId,
    query: { enabled: valid },
  }).data;
}
