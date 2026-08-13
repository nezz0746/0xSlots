import { getChainTokens } from "@0xslots/sdk";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { TokenLogo } from "@/components/token-logo";
import { FormField, FormItem, FormLabel } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useChain } from "@/context/chain";
import { truncateAddress } from "@/utils";
import { AddressInput } from "../address-input";
import { useErc20Check } from "../hooks/use-erc20-check";
import type { CreateSlotFormValues } from "../schema";

export function SectionCurrency() {
  const form = useFormContext<CreateSlotFormValues>();
  const { chainId } = useChain();
  const currencyMode = form.watch("currencyMode");
  const customCurrency = form.watch("customCurrency");
  const chainTokens = getChainTokens(chainId);
  const erc20 = useErc20Check(currencyMode === "custom" ? customCurrency : "");

  // Seed the chain's default currency, and re-seed when the chain changes so a
  // token from the previous chain never survives the switch.
  //
  // This lives beside the select rather than in the page for a reason: the
  // schema's default is "", and react-hook-form only keeps a `setValue` on a
  // field some control has registered. `presetCurrency` is registered by the
  // FormField below, so the write sticks — a write from a parent, before this
  // section mounts, gets re-synced back to "" during RHF's mount cycle.
  useEffect(() => {
    const fallback = chainTokens[0]?.address;
    if (!fallback) return;
    const current = form.getValues("presetCurrency");
    if (!chainTokens.some((t) => t.address === current)) {
      form.setValue("presetCurrency", fallback, { shouldValidate: true });
    }
  }, [chainTokens, form]);

  return (
    <>
      <FormField
        control={form.control}
        name="currencyMode"
        render={({ field: modeField }) => (
          <FormField
            control={form.control}
            name="presetCurrency"
            render={({ field }) => {
              const selectValue =
                modeField.value === "custom" ? "custom" : field.value || "";
              const selected = chainTokens.find(
                (t) => t.address === selectValue,
              );

              return (
                <FormItem>
                  <FormLabel>Currency</FormLabel>
                  <Select
                    value={selectValue}
                    onValueChange={(v) => {
                      if (v === "custom") {
                        modeField.onChange("custom");
                      } else {
                        modeField.onChange("preset");
                        field.onChange(v as `0x${string}`);
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      {/* Explicit children, not Radix's auto-fill. Radix portals
                      the selected item's text into the trigger, and the items
                      live in a portal that stays unmounted until the dropdown
                      is first opened — so the trigger showed "Select a
                      currency" on load even with USDC already selected.
                      Passing children sets valueNodeHasChildren, which is the
                      documented way to take over; Radix then skips its portal
                      rather than rendering both. */}
                      <SelectValue placeholder="Select a currency">
                        {currencyMode === "custom" ? (
                          <>
                            <TokenLogo />
                            <span>Custom address</span>
                          </>
                        ) : selected ? (
                          <>
                            <TokenLogo
                              slug={selected.logo}
                              symbol={selected.symbol}
                            />
                            <span>
                              {selected.name} ({selected.symbol})
                            </span>
                          </>
                        ) : null}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {/* One flat row of three children on purpose. SelectItem
                      already flexes its last <span>, and Radix clones the
                      chosen item into the closed trigger — a nested stacked
                      layout would fight both. */}
                      {chainTokens.map((token) => (
                        <SelectItem key={token.address} value={token.address}>
                          <TokenLogo slug={token.logo} symbol={token.symbol} />
                          <span>
                            {token.name} ({token.symbol})
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {truncateAddress(token.address)}
                          </span>
                        </SelectItem>
                      ))}
                      <SelectItem value="custom">
                        <TokenLogo />
                        <span>Custom address</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              );
            }}
          />
        )}
      />

      {currencyMode === "custom" && (
        <FormField
          control={form.control}
          name="customCurrency"
          render={({ field, fieldState }) => (
            <FormItem>
              <AddressInput
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                placeholder="0x… ERC-20 address or ENS"
                error={fieldState.error?.message}
              />
              {erc20.isLoading && (
                <p className="flex items-center gap-1.5 text-[10px] text-blue-500">
                  <Loader2 className="size-3 animate-spin" />
                  Checking ERC-20 token...
                </p>
              )}
              {erc20.data && (
                <p className="flex items-center gap-1.5 text-[10px] text-green-600">
                  <Check className="size-3" />
                  {erc20.data.name} ({erc20.data.symbol}) ·{" "}
                  {erc20.data.decimals} decimals
                </p>
              )}
              {erc20.isError && erc20.isValidAddress && (
                <p className="flex items-center gap-1.5 text-[10px] text-destructive">
                  <AlertCircle className="size-3" />
                  Not a valid ERC-20 token on this chain
                </p>
              )}
            </FormItem>
          )}
        />
      )}
    </>
  );
}
