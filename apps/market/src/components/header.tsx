"use client";

import { useWalletModal } from "@0xslots/wallet";
import Link from "next/link";
import { useAccount, useSwitchChain } from "wagmi";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CHAINS, chainName, DEFAULT_CHAIN_ID } from "@/lib/chains";
import { truncate } from "@/lib/format";

export function Header() {
  const { address, chain, chainId } = useAccount();
  const { openConnect, openAccount } = useWalletModal();
  // Disconnected, wagmi reports no chain — but the pages still read one, so the
  // header must name the same one they are querying.
  const active = chainId ?? DEFAULT_CHAIN_ID;
  const { switchChain } = useSwitchChain();

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-6 px-5 py-4 sm:px-8">
        <Link
          href="/"
          className="expanded text-[15px] font-extrabold uppercase tracking-[0.08em]"
        >
          Slotmarket
        </Link>

        <nav className="hidden gap-5 text-[13px] sm:flex">
          <Link
            href="/"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Collections
          </Link>
          <Link
            href="/create"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Open a collection
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/* Hidden on a phone, where it pushed the wallet off the edge. The
              same switch is in the account panel, which is where somebody on a
              phone reaches everything else about their wallet. */}
          <Select
            value={String(active)}
            disabled={!address}
            onValueChange={(v) => switchChain({ chainId: Number(v) as never })}
          >
            <SelectTrigger
              size="sm"
              aria-label="Network"
              className="hidden w-auto min-w-[8.5rem] sm:flex"
              title={address ? undefined : "Connect a wallet to switch network"}
            >
              <SelectValue>{chainName(active)}</SelectValue>
            </SelectTrigger>
            <SelectContent align="end">
              {CHAINS.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            size="sm"
            variant={address ? (chain ? "outline" : "destructive") : "default"}
            onClick={address ? openAccount : openConnect}
          >
            {address
              ? chain
                ? truncate(address)
                : "Wrong network"
              : "Connect"}
          </Button>
        </div>
      </div>
    </header>
  );
}
