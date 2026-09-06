"use client";

import { useWalletModal } from "@0xslots/wallet";
import { useAccount } from "wagmi";

import { Button } from "@/components/ui/button";

/** Opens the app's wallet overlay, and names the wallet once there is one. */
export function ConnectButton() {
  const { address, chain, isReconnecting } = useAccount();
  const { openConnect, openAccount } = useWalletModal();

  if (!address)
    return (
      <Button size="sm" disabled={isReconnecting} onClick={openConnect}>
        {isReconnecting ? "Connecting…" : "Connect"}
      </Button>
    );

  return (
    <Button
      size="sm"
      variant={chain ? "outline" : "destructive"}
      onClick={openAccount}
    >
      {chain ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Wrong network"}
    </Button>
  );
}
