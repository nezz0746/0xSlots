"use client";

import { useWalletModal } from "@0xslots/wallet";
import Link from "next/link";
import { useAccount } from "wagmi";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActiveChain } from "@/hooks/use-active-chain";
import { CHAINS, chainName } from "@/lib/chains";
import { truncate } from "@/lib/format";

export function Header() {
  const { address, chain } = useAccount();
  const { openConnect, openAccount } = useWalletModal();
  // The chain the PAGES are reading, which is the browsing choice until a
  // wallet connects and takes over. Never wagmi's directly: disconnected, that
  // is undefined, and the header would name a different chain from the one
  // being queried.
  const { chainId: active, setChain } = useActiveChain();

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
            onValueChange={(v) => setChain(Number(v))}
          >
            <SelectTrigger
              size="sm"
              aria-label="Network"
              className="hidden w-auto min-w-[8.5rem] sm:flex"
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
