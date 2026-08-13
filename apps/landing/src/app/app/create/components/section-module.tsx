import { AlertCircle, Check, Loader2 } from "lucide-react";
import { useFormContext } from "react-hook-form";
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
import { useModules } from "@/hooks/use-v3";
import { truncateAddress } from "@/utils";
import { AddressInput } from "../address-input";
import { useModuleCheck } from "../hooks/use-module-check";
import type { CreateSlotFormValues } from "../schema";

export function SectionModule() {
  const form = useFormContext<CreateSlotFormValues>();
  const { chainId } = useChain();
  const moduleMode = form.watch("moduleMode");
  const customModule = form.watch("module");
  const { data: verifiedModules } = useModules();
  const moduleCheck = useModuleCheck(
    moduleMode === "custom" ? customModule : "",
    chainId,
  );

  return (
    <FormField
      control={form.control}
      name="module"
      render={({ field, fieldState }) => {
        const selectValue =
          moduleMode === "custom"
            ? "custom"
            : field.value === ""
              ? "none"
              : field.value;

        return (
          <FormItem>
            <FormLabel>Module</FormLabel>
            <Select
              value={selectValue}
              onValueChange={(v) => {
                if (v === "none") {
                  form.setValue("moduleMode", "none");
                  field.onChange("");
                } else if (v === "custom") {
                  form.setValue("moduleMode", "custom");
                  field.onChange("");
                } else {
                  form.setValue("moduleMode", "verified");
                  field.onChange(v);
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a module" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {verifiedModules
                  ?.filter((m) => m.verified)
                  .map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name || m.id.slice(0, 10)}{" "}
                      <span className="text-muted-foreground">
                        {truncateAddress(m.id)}
                      </span>
                    </SelectItem>
                  ))}
                <SelectItem value="custom">Custom address</SelectItem>
              </SelectContent>
            </Select>
            {moduleMode === "custom" && (
              <div className="mt-2">
                <AddressInput
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  placeholder="0x… or ENS"
                  error={fieldState.error?.message}
                />
                {moduleCheck.isLoading && (
                  <p className="flex items-center gap-1.5 text-[10px] text-blue-500 mt-1">
                    <Loader2 className="size-3 animate-spin" />
                    Checking module...
                  </p>
                )}
                {moduleCheck.data?.status === "verified" && (
                  <p className="flex items-center gap-1.5 text-[10px] text-green-600 mt-1">
                    <Check className="size-3" />
                    {moduleCheck.data.name ?? "Module"}
                    {moduleCheck.data.version &&
                      ` v${moduleCheck.data.version}`}
                    {" · ISlotsModule (ERC-165)"}
                  </p>
                )}
                {moduleCheck.data?.status === "probable" && (
                  <p className="flex items-center gap-1.5 text-[10px] text-amber-600 mt-1">
                    <AlertCircle className="size-3" />
                    Looks like a module ({moduleCheck.data.name}
                    {moduleCheck.data.version &&
                      ` v${moduleCheck.data.version}`}
                    ) but does not advertise ERC-165 support
                  </p>
                )}
                {moduleCheck.data?.status === "invalid" && (
                  <p className="flex items-center gap-1.5 text-[10px] text-destructive mt-1">
                    <AlertCircle className="size-3" />
                    Not a slots module — contract is missing the required
                    interface
                  </p>
                )}
                {moduleCheck.data?.status === "no-code" && (
                  <p className="flex items-center gap-1.5 text-[10px] text-destructive mt-1">
                    <AlertCircle className="size-3" />
                    No contract code at this address on the selected chain
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
