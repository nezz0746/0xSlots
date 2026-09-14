import { appChains } from "@0xslots/config/chains";
import { proxyTransports } from "@0xslots/config/transports";
import { walletStorage } from "@0xslots/wallet/config";
import { createConfig } from "wagmi";
import { anvilConnectors } from "@/config/anvil-connectors";

/**
 * Every read goes through `/api/rpc/<chainId>`, not to Alchemy directly.
 *
 * The key used to be `NEXT_PUBLIC_ALCHEMY_API_KEY` and therefore in the bundle
 * every visitor downloads. See the note in `@0xslots/config/transports` for why
 * that is worse than it looks, and the route itself for what the server does
 * with it.
 */
const transports = proxyTransports(appChains.map((c) => c.id));

// Local click-to-send accounts, development only. `NODE_ENV` is inlined by the
// bundler, so a production build drops both the connectors and the module.
const isDev = process.env.NODE_ENV === "development";

export const config = createConfig({
  chains: appChains,
  transports,
  connectors: isDev ? anvilConnectors : [],
  ssr: true,
  storage: walletStorage("0xslots.explorer"),
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
