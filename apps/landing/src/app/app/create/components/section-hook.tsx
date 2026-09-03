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
  ShieldCheck,
} from "lucide-react";
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

  const available = knownHooks[chainId] ?? [];
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

            {/* A known hook is offered by name, so it owes the reader one line
                on what attaching it will do to them. */}
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

                <p className="text-[11px] leading-snug text-muted-foreground">
                  Nobody may buy this slot out from under its occupant for that
                  long, and the occupant funds the whole window up front.
                  Liquidation is untouched — an occupant who runs dry can still
                  be evicted at any moment.
                </p>

                {/* The address, stated rather than derived. Worth showing even
                    though the creator did not choose it: it is what the slot
                    will point at, and it is the same one for every duration —
                    which is the fact that replaced "expect two transactions". */}
                {tenureHook && (
                  <div className="space-y-1 border bg-muted/40 p-2">
                    <p className="font-mono text-[10px] break-all text-muted-foreground">
                      {tenureHook}
                    </p>
                    <p className="flex items-center gap-1.5 text-[10px] text-green-600">
                      <Check className="size-3" />
                      One hook serves every duration — creating this slot is one
                      transaction.
                    </p>
                  </div>
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

            {/* What this hook can actually do, read from the hook. Replaces
                three paragraphs that said the same thing about every hook —
                including a tenure warning shown for hooks that were not tenure
                hooks at all. */}
            {hookMode !== "none" && check.data?.status === "ok" ? (
              <HookPermissions
                mayRefuse={check.data.mayRefuse}
                notifiedOn={check.data.notifiedOn}
              />
            ) : null}

            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}

/**
 * What a hook may do to you, and what it merely watches.
 *
 * The split is the whole point. A `before` callback is a VETO — it can refuse
 * your buy, your sale or your reprice, and it runs uncapped because it is
 * `view` and cannot reenter. An `after` callback is a notification: gas-capped,
 * its revert swallowed, structurally unable to change the outcome.
 *
 * Two guarantees hold whatever a hook declares, and they are worth stating
 * once, here, rather than in a paragraph above every option: it can never block
 * a liquidation, and it can never stop an occupant leaving. The core forbids
 * both.
 */
function HookPermissions({
  mayRefuse,
  notifiedOn,
}: {
  mayRefuse: string[];
  notifiedOn: string[];
}) {
  return (
    <div className="mt-2 space-y-1.5 rounded-md border bg-muted/30 px-3 py-2">
      <Row
        icon={
          <ShieldAlert className="size-3 shrink-0 text-amber-600 dark:text-amber-500" />
        }
        label="May refuse"
        items={mayRefuse}
        empty="nothing — it cannot veto any action"
      />
      <Row
        icon={<Eye className="size-3 shrink-0 text-muted-foreground" />}
        label="Notified on"
        items={notifiedOn}
        empty="nothing"
      />
      <p className="text-[10px] leading-snug text-muted-foreground/70 pt-0.5">
        It can never block a liquidation, and never stop you leaving.
      </p>
    </div>
  );
}

function Row({
  icon,
  label,
  items,
  empty,
}: {
  icon: React.ReactNode;
  label: string;
  items: string[];
  empty: string;
}) {
  return (
    <div className="flex items-start gap-1.5 text-[11px] leading-snug">
      {icon}
      <span className="text-muted-foreground w-20 shrink-0">{label}</span>
      {items.length ? (
        <span className="flex flex-wrap gap-1">
          {items.map((v) => (
            <code
              key={v}
              className="rounded bg-background border px-1 py-px text-[10px]"
            >
              {v}
            </code>
          ))}
        </span>
      ) : (
        <span className="text-muted-foreground/60">{empty}</span>
      )}
    </div>
  );
}
