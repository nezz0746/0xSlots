import type { Config, Connector } from "@wagmi/core";
import { coinbaseWallet, walletConnect } from "wagmi/connectors";

export interface WalletOptions {
  appName: string;
  walletConnectProjectId?: string;
  appUrl?: string;
  appIcon?: string;
}

// Config-owned instances: no app imports, global wagmi config, or relay sockets on load.
const registered = new WeakMap<Config, Map<string, Promise<Connector>>>();

export function resolveConnector(
  config: Config,
  id: string,
  options: WalletOptions,
): Promise<Connector> {
  const actualId = id === "baseAccount" ? "coinbaseWalletSDK" : id;
  const live = config.connectors.find((c) => c.id === actualId);
  if (live) return Promise.resolve(live);
  let cache = registered.get(config);
  if (!cache) {
    cache = new Map();
    registered.set(config, cache);
  }
  const existing = cache.get(actualId);
  if (existing) return existing;

  const pending = (async () => {
    const factory =
      actualId === "coinbaseWalletSDK"
        ? coinbaseWallet({
            appName: options.appName,
            preference: { options: "smartWalletOnly" },
          })
        : actualId === "walletConnect" && options.walletConnectProjectId
          ? walletConnect({
              projectId: options.walletConnectProjectId,
              showQrModal: false,
              metadata: {
                name: options.appName,
                description: options.appName,
                url: options.appUrl ?? window.location.origin,
                icons: options.appIcon ? [options.appIcon] : [],
              },
            })
          : undefined;
    if (!factory) throw new Error("This wallet connection is unavailable.");
    // setup is wagmi's registration path for deferred connectors. Keep its use here.
    const connector = config._internal.connectors.setup(factory);
    config._internal.connectors.setState((current) => [...current, connector]);
    return connector;
  })();
  cache.set(actualId, pending);
  void pending.catch(() => cache?.delete(actualId));
  return pending;
}
