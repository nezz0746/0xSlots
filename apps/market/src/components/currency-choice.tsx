"use client";

import { getChainTokens, NATIVE_CURRENCY_ADDRESS } from "@0xslots/sdk";
import { type Address, erc20Abi, isAddress } from "viem";
import { useReadContracts } from "wagmi";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { truncate } from "@/lib/format";

/**
 * What the collection prices in, chosen rather than typed.
 *
 * The field used to be a bare address box with "blank for native ETH" under
 * it, which asks a creator to know a contract address by heart and offers no
 * way to notice a wrong one. The chains' own token lists live in the SDK and
 * the explorer already reads them; this reads the same list, so the two apps
 * cannot drift about what USDC means on a given chain.
 *
 * Custom stays available and is checked against the chain — a collection's
 * currency is fixed for ever at deployment, so an address that turns out not
 * to be an ERC-20 is a collection nobody can ever mint from.
 */
export function CurrencyChoice({
  chainId,
  value,
  onChange,
  custom,
  onCustom,
}: {
  chainId: number;
  /** The chosen address, or `"custom"` while a bespoke one is being typed. */
  value: string;
  onChange: (next: string) => void;
  custom: string;
  onCustom: (next: string) => void;
}) {
  const tokens = getChainTokens(chainId);
  const probing = value === "custom" && isAddress(custom);

  // Ask the chain what it is, rather than trusting the shape of the string.
  const { data, isLoading } = useReadContracts({
    query: { enabled: probing, retry: false },
    contracts: probing
      ? [
          {
            address: custom as Address,
            abi: erc20Abi,
            functionName: "symbol",
            chainId,
          },
          {
            address: custom as Address,
            abi: erc20Abi,
            functionName: "decimals",
            chainId,
          },
        ]
      : [],
  });
  const symbol = data?.[0]?.result;
  const decimals = data?.[1]?.result;
  const known = typeof symbol === "string" && typeof decimals === "number";
  const selected = tokens.find((t) => t.address === value);

  return (
    <div className="grid gap-1.5">
      <Label htmlFor="currency">Currency</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id="currency" className="w-full">
          {/* Explicit children rather than Radix's auto-fill: its items live
              in a portal that stays unmounted until first opened, so the
              trigger renders the placeholder on load even with a value set. */}
          <SelectValue placeholder="Pick a currency">
            {value === "custom"
              ? "Another ERC-20"
              : selected
                ? `${selected.name} (${selected.symbol})`
                : null}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {tokens.map((token) => (
            <SelectItem key={token.address} value={token.address}>
              <span>
                {token.name} ({token.symbol})
              </span>
              <span className="ml-auto pl-3 text-[11px] tabular text-muted-foreground">
                {token.address === NATIVE_CURRENCY_ADDRESS
                  ? "native"
                  : truncate(token.address)}
              </span>
            </SelectItem>
          ))}
          <SelectItem value="custom">
            <span>Another ERC-20</span>
            <span className="ml-auto pl-3 text-[11px] text-muted-foreground">
              by address
            </span>
          </SelectItem>
        </SelectContent>
      </Select>

      {value === "custom" && (
        <div className="mt-1">
          <Input
            value={custom}
            onChange={(e) => onCustom(e.target.value)}
            placeholder="0x… token address"
            spellCheck={false}
          />
          {/* Three states, because "nothing yet" and "not a token" are
              different answers and only one of them is a mistake. */}
          {custom.length > 0 && !isAddress(custom) ? (
            <p className="mt-1 text-[11px] text-waning">Not an address yet.</p>
          ) : isLoading ? (
            <p className="mt-1 text-[11px] text-dim">Checking the chain…</p>
          ) : probing && known ? (
            <p className="mt-1 text-[11px] text-live">
              {symbol}, {decimals} decimals.
            </p>
          ) : probing ? (
            <p className="mt-1 text-[11px] text-ebbing">
              Nothing answering as an ERC-20 here. The currency is fixed for
              ever at deployment, so this would be a collection nobody could
              mint from.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
