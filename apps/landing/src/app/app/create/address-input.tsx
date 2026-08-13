"use client";

import { forwardRef } from "react";
import { getAddress, isAddress } from "viem";
import { normalize } from "viem/ens";
import { Input } from "@/components/ui/input";
import { useEnsAddress } from "@/lib/ens";
import { cn } from "@/lib/utils";

export function useResolveAddress(input: string) {
  const isEns =
    input.endsWith(".eth") || input.endsWith(".xyz") || input.endsWith(".id");
  let ensName: string | undefined;
  try {
    ensName = isEns ? normalize(input) : undefined;
  } catch {
    ensName = undefined;
  }
  const { data: ensAddress, isLoading } = useEnsAddress(ensName);
  let resolved = isEns && ensAddress ? ensAddress : input;
  try {
    if (isAddress(resolved, { strict: false })) {
      resolved = getAddress(resolved);
    }
  } catch {
    // not a valid address, leave as-is
  }
  return {
    resolved,
    isEns,
    isResolving: isEns && isLoading,
    ensName: isEns && ensAddress ? input : null,
  };
}

interface AddressInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  name?: string;
}

export const AddressInput = forwardRef<HTMLInputElement, AddressInputProps>(
  ({ value, onChange, onBlur, placeholder, hint, error, name }, ref) => {
    const { resolved, isResolving, ensName } = useResolveAddress(value);
    const isValid = !value || isAddress(resolved);

    return (
      <div className="space-y-1">
        <Input
          ref={ref}
          name={name}
          type="text"
          placeholder={placeholder ?? "0x… or vitalik.eth"}
          value={value}
          onChange={(e) =>
            onChange(e.target.value.replace(/[^\x20-\x7E]/g, ""))
          }
          onBlur={onBlur}
          className={cn(
            "text-xs",
            value && !isValid && !isResolving && "border-destructive",
            error && "border-destructive",
          )}
        />
        {isResolving && (
          <p className="text-[10px] text-blue-500">Resolving {value}…</p>
        )}
        {ensName && isAddress(resolved) && (
          <p className="text-[10px] text-green-600">
            {ensName} → {resolved.slice(0, 6)}…{resolved.slice(-4)}
          </p>
        )}
        {error && <p className="text-[10px] text-destructive">{error}</p>}
        {hint && !isResolving && !ensName && !error && (
          <p className="text-[10px] text-muted-foreground">{hint}</p>
        )}
      </div>
    );
  },
);
AddressInput.displayName = "AddressInput";
