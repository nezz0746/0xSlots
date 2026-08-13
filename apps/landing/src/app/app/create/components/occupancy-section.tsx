"use client";

import { getChainTokens } from "@0xslots/sdk";
import { useFormContext } from "react-hook-form";
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
import { getVouchedPolicy, vouchedPoliciesForChain } from "@/config/policies";
import { useChain } from "@/context/chain";
import { AddressInput } from "../address-input";
import { useErc20Check } from "../hooks/use-erc20-check";
import {
  type CreateSlotFormValues,
  formatValueUnit,
  timeDenominations,
} from "../schema";

/**
 * Occupancy terms — when a slot can change hands, and under what rule.
 *
 * Both default to off, so an untouched form still produces a plain instant-buy
 * slot. The copy leads with the consequence rather than the mechanism, because
 * both dials change what it *feels* like to hold the slot far more than the
 * mutability flags next to them do.
 */
export function OccupancySection() {
  const form = useFormContext<CreateSlotFormValues>();
  const { chainId } = useChain();
  const policyMode = form.watch("occupancyPolicyMode");

  // A policy address is chain-specific — offering one from another chain would
  // produce a slot whose policy has no code.
  const vouchedForChain = vouchedPoliciesForChain(chainId);

  const tenureUnit = form.watch("tenureUnit");

  // A price floor is a bare number until you say what it is denominated in, so
  // the input has to name the slot's own currency. The policy enforces the same
  // pairing on-chain and reverts `WrongCurrency` on a mismatch.
  const currencyMode = form.watch("currencyMode");
  const presetCurrency = form.watch("presetCurrency");
  const customCurrency = form.watch("customCurrency");
  const presetToken = getChainTokens(chainId).find(
    (t) => t.address === presetCurrency,
  );
  const custom = useErc20Check(currencyMode === "custom" ? customCurrency : "");
  const currencySymbol =
    currencyMode === "preset" ? presetToken?.symbol : custom.data?.symbol;

  return (
    <>
      {/* ── Policy ── */}
      <FormField
        control={form.control}
        name="occupancyPolicyMode"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Occupancy policy</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="tenure">Minimum tenure</SelectItem>
                <SelectItem value="price">Minimum price</SelectItem>
                <SelectItem
                  value="known"
                  disabled={vouchedForChain.length === 0}
                >
                  Verified policy
                  {vouchedForChain.length === 0 && " — none on this chain"}
                </SelectItem>
                <SelectItem value="custom">Custom address</SelectItem>
              </SelectContent>
            </Select>
            <FormDescription>
              A policy can delay who may take the slot, but never blocks
              liquidation or stops the occupant leaving — the core forbids both.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {policyMode === "tenure" && (
        <FormField
          control={form.control}
          name="tenureValue"
          render={({ field }) => (
            <FormItem>
              <div className="flex gap-2">
                <Input
                  {...field}
                  type="text"
                  inputMode="decimal"
                  className="flex-1"
                />
                <FormField
                  control={form.control}
                  name="tenureUnit"
                  render={({ field: unitField }) => (
                    <Select
                      onValueChange={unitField.onChange}
                      value={unitField.value}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {timeDenominations.map((u) => (
                          <SelectItem key={u} value={u}>
                            {u}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <FormDescription>
                Nobody can buy the occupant out for{" "}
                {formatValueUnit(field.value, tenureUnit)}. They pay for it up
                front — the whole window's tax must be escrowed — and cannot cut
                their price while protected, so the tax stays honest even with
                forced sale suspended. Liquidation still works throughout:
                insolvency always ends the tenure.
              </FormDescription>
              <FormDescription className="text-amber-600 dark:text-amber-500">
                Softens Harberger — forced sale is delayed, not removed.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {policyMode === "price" && (
        <FormField
          control={form.control}
          name="minPriceValue"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center gap-2">
                <Input
                  {...field}
                  type="text"
                  inputMode="decimal"
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground w-28">
                  {currencySymbol ?? "—"}
                </span>
              </div>
              <FormDescription>
                Nobody may declare below {field.value} {currencySymbol ?? ""} on
                this slot — not the first occupant, not anyone who takes it
                later. It guarantees you a minimum tax base rather than the slot
                being parked on at a token valuation.{" "}
                <strong>Buying is never delayed</strong>: anyone can take the
                slot at any moment, as long as they declare at least this much.
              </FormDescription>
              <FormDescription className="text-amber-600 dark:text-amber-500">
                Set it above what the slot is really worth and nobody can take
                it at all — it sits empty and earns you nothing instead of a
                little. Treat it like a reserve price, not a target.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {policyMode === "known" && vouchedForChain.length === 0 && (
        <p className="text-sm text-muted-foreground rounded-md border border-dashed p-3">
          No verified policies are deployed on this chain yet. Switch to a chain
          that has them, or use{" "}
          <button
            type="button"
            className="underline underline-offset-2"
            onClick={() => form.setValue("occupancyPolicyMode", "custom")}
          >
            a custom address
          </button>
          .
        </p>
      )}

      {policyMode === "known" && vouchedForChain.length > 0 && (
        <FormField
          control={form.control}
          name="occupancyPolicy"
          render={({ field }) => (
            <FormItem>
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a policy" />
                </SelectTrigger>
                <SelectContent>
                  {vouchedForChain.map((p) => (
                    <SelectItem key={p.address} value={p.address}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {getVouchedPolicy(field.value, chainId) && (
                <FormDescription>
                  {getVouchedPolicy(field.value, chainId)?.description}
                </FormDescription>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {policyMode === "custom" && (
        <FormField
          control={form.control}
          name="occupancyPolicy"
          render={({ field }) => (
            <FormItem>
              <AddressInput
                value={field.value}
                onChange={field.onChange}
                placeholder="0x… policy address"
              />
              <FormDescription>
                Must implement IOccupancyPolicy. The factory rejects addresses
                with no code, but does not verify behaviour — an unrecognised
                policy is shown as such in the explorer.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </>
  );
}
