import { appChains } from "@0xslots/config/chains";
import { alchemyTransports } from "@0xslots/config/transports";
import { walletStorage } from "@0xslots/wallet/config";
import { createConfig } from "wagmi";
import { anvilConnectors } from "@/config/anvil-connectors";
import { alchemyKey } from "@/constants";

const transports = alchemyTransports(
  appChains.map((c) => c.id),
  alchemyKey,
);

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
