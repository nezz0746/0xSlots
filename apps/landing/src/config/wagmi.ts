import { appChains } from "@0xslots/config/chains";
import { alchemyTransports } from "@0xslots/config/transports";
import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  baseAccount,
  metaMaskWallet,
  rabbyWallet,
  rainbowWallet,
  safeWallet,
  walletConnectWallet,
  zerionWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig } from "wagmi";
import { anvilConnectors } from "@/config/anvil-connectors";
import { alchemyKey } from "@/constants";

const transports = alchemyTransports(
  appChains.map((c) => c.id),
  alchemyKey,
);

const connectors = connectorsForWallets(
  [
    {
      groupName: "Recommended",
      wallets: [
        rainbowWallet,
        baseAccount,
        walletConnectWallet,
        metaMaskWallet,
        rabbyWallet,
        zerionWallet,
        safeWallet,
      ],
    },
  ],
  {
    appName: "0xSlots",
    projectId: "8d4685db15de09d142d3650e08c90f79",
  },
);

// Local click-to-send accounts, development only. `NODE_ENV` is inlined by the
// bundler, so a production build drops both the connectors and the module.
const isDev = process.env.NODE_ENV === "development";

export const config = createConfig({
  chains: appChains,
  transports,
  connectors: isDev ? [...connectors, ...anvilConnectors] : connectors,
  ssr: false,
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
