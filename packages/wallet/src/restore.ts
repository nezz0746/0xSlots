"use client";

import { reconnect } from "@wagmi/core";
import { useEffect, useRef } from "react";
import { useAccount, useConfig, useConnectors } from "wagmi";
import { resolveConnector, type WalletOptions } from "./connectors";

/**
 * Reconnects the wallet used last time, and only that one.
 *
 * wagmi's own reconnect would try every connector it knows, which for a
 * deferred relay means opening a socket on page load whether or not anyone
 * ever used it. This reads the id it stored, and if that connector is a
 * deferred one, builds it on demand.
 *
 * An extension can announce itself over EIP-6963 after the first render, so a
 * previous wallet that is not there yet is left alone rather than given up on:
 * the effect runs again when the connector list changes and tries once then.
 */
export function useRestoreWallet(options: WalletOptions) {
  const config = useConfig();
  const connectors = useConnectors();
  const { status, connector: connectedConnector } = useAccount();
  const attempted = useRef(new Set<string>());
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const { appName, appUrl, appIcon, walletConnectProjectId } = options;
  useEffect(() => {
    if (status === "connected" && connectedConnector)
      attempted.current.add(connectedConnector.id);
    if (status !== "disconnected") return;
    void (async () => {
      const recent = await config.storage?.getItem("recentConnectorId");
      if (!mounted.current || !recent || attempted.current.has(recent)) return;
      const live = connectors.find((c) => c.id === recent);
      const deferred =
        recent === "coinbaseWalletSDK" ||
        (recent === "walletConnect" && walletConnectProjectId);
      if (!live && !deferred) return;
      attempted.current.add(recent);
      const connector =
        live ??
        (await resolveConnector(config, recent, {
          appName,
          appUrl,
          appIcon,
          walletConnectProjectId,
        }));
      if (mounted.current && config.state.status === "disconnected")
        await reconnect(config, { connectors: [connector] });
    })().catch(() => {
      /* A rejected or expired session is simply disconnected. */
    });
  }, [
    config,
    connectors,
    status,
    connectedConnector,
    appName,
    appUrl,
    appIcon,
    walletConnectProjectId,
  ]);
}
