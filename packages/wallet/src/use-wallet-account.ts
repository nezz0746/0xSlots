"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount, useDisconnect, useSwitchChain } from "wagmi";
import { describeError } from "./errors";
import { useWalletModal } from "./provider";
import { walletLabel } from "./wallets";

/**
 * What an account panel shows and does: the address, the wallet's name, the
 * network and the ones it could switch to, and the four actions.
 *
 * Errors and the copied flag clear whenever the panel is not the account
 * panel, so a stale "Address copied" never greets the next opening.
 */
export function useWalletAccount() {
  const { panel, openConnect, close } = useWalletModal();
  const { address, connector, chainId } = useAccount();
  const { disconnectAsync, isPending: disconnecting } = useDisconnect();
  const { chains, switchChainAsync, isPending: switching } = useSwitchChain();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (panel === "account") return;
    setError(null);
    setCopied(false);
    clearTimeout(copyTimer.current);
  }, [panel]);
  useEffect(() => () => clearTimeout(copyTimer.current), []);

  const run = useCallback(async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(describeError(cause, "Please try again."));
    }
  }, []);

  const copy = useCallback(
    () =>
      run(async () => {
        await navigator.clipboard.writeText(address ?? "");
        setCopied(true);
        clearTimeout(copyTimer.current);
        copyTimer.current = setTimeout(() => setCopied(false), 1500);
      }),
    [run, address],
  );
  const switchChain = useCallback(
    (id: number) => run(() => switchChainAsync({ chainId: id })),
    [run, switchChainAsync],
  );
  const disconnect = useCallback(
    () =>
      run(async () => {
        await disconnectAsync();
        close();
      }),
    [run, disconnectAsync, close],
  );
  const changeWallet = useCallback(
    () =>
      run(async () => {
        await disconnectAsync();
        openConnect();
      }),
    [run, disconnectAsync, openConnect],
  );

  return {
    address,
    connector,
    walletName: walletLabel(connector),
    chainId,
    chains,
    /** False when the wallet sits on a network this app does not serve. */
    supported: chains.some((c) => c.id === chainId),
    switching,
    disconnecting,
    busy: switching || disconnecting,
    copied,
    error,
    copy,
    switchChain,
    disconnect,
    changeWallet,
  };
}
