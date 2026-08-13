"use client";

import { SlotsChain } from "@0xslots/sdk";
import { useQueryClient } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { anvil } from "viem/chains";
import { useAccount, useConfig, useConnect, useDisconnect } from "wagmi";

import { Button } from "@/components/ui/button";
import { ANVIL_ACCOUNTS, anvilConnectorId } from "@/config/anvil-connectors";
import { useChain } from "@/context/chain";

/**
 * Switch between anvil's unlocked accounts without a wallet.
 *
 * Each account is its own wagmi connector, so switching is a plain
 * connect/disconnect rather than an account-change event the mock connector has
 * no way to emit. Transactions then go out as `eth_sendTransaction` from an
 * account anvil already trusts — no signing prompt, no keys in the app.
 *
 * Local chain only; the connectors do not exist in a production build.
 */
const STORAGE_KEY = "0xslots.devAccount";

export function DevAccountSwitcher() {
  const { chainId } = useChain();
  const { address, connector } = useAccount();
  const { connectAsync, isPending } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const config = useConfig();
  const queryClient = useQueryClient();

  const isLocal = chainId === SlotsChain.ANVIL;

  const pick = useCallback(
    async (id: string) => {
      try {
        window.localStorage.setItem(STORAGE_KEY, id);
      } catch {
        // private mode — the choice just will not survive a reload
      }
      const target = config.connectors.find((c) => c.id === id);
      if (!target) return;
      // Disconnect first: wagmi holds one active connector, and connecting over
      // a live one leaves the previous account lingering in the accounts list.
      if (connector) await disconnectAsync();
      // The chainId is not optional. Without it the mock connector stays on
      // config.chains[0] — Base — and would aim its RPC at mainnet.
      await connectAsync({ connector: target, chainId: anvil.id });
      await queryClient.invalidateQueries();
    },
    [config.connectors, connector, connectAsync, disconnectAsync, queryClient],
  );

  // Restore the last choice after a reload. The mock connector forgets it: its
  // `connected` flag lives in a module closure that a page load resets, so
  // wagmi's own reconnect finds nothing to authorize.
  const restored = useRef(false);
  useEffect(() => {
    if (!isLocal || restored.current || connector) return;
    restored.current = true;
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      return;
    }
    if (saved && config.connectors.some((c) => c.id === saved)) void pick(saved);
  }, [isLocal, connector, config.connectors, pick]);

  if (!isLocal) return null;

  return (
    <div className="px-2 pb-2 space-y-1.5">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <Users className="size-3" />
        <span>Act as</span>
      </div>
      <div className="grid grid-cols-2 gap-1">
        {ANVIL_ACCOUNTS.map((a) => {
          const id = anvilConnectorId(a.address);
          const active = connector?.id === id && address === a.address;
          return (
            <Button
              key={a.address}
              variant={active ? "default" : "outline"}
              size="sm"
              className="h-6 px-2 text-[11px] justify-start"
              disabled={isPending}
              onClick={() => pick(id)}
            >
              {a.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
