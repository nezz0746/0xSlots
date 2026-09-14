import { appChains } from "@0xslots/config/chains";
import { proxyTransports } from "@0xslots/config/transports";
import { walletStorage } from "@0xslots/wallet/config";
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { createConfig } from "wagmi";

/**
 * Same proxy as the web config, and it matters more here.
 *
 * A mini app runs inside somebody else's webview, which is exactly the place a
 * bundled credential is hardest to notice leaking and easiest to scrape.
 */
const transports = proxyTransports(appChains.map((c) => c.id));

export const miniAppConfig = createConfig({
  chains: appChains,
  connectors: [farcasterMiniApp()],
  transports,
  ssr: false,
  storage: walletStorage("0xslots.miniapp"),
});

// Module augmentation lives in wagmi.ts (web config) which shares the same
// chain / transport shape. The miniapp config is structurally compatible.
