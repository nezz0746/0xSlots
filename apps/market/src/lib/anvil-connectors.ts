import type { Address } from "viem";
import { anvil } from "viem/chains";
import type { CreateConnectorFn } from "wagmi";
import { mock } from "wagmi/connectors";

/**
 * Click-to-send local accounts, development only.
 *
 * Anvil unlocks the accounts from its default mnemonic, so
 * `eth_sendTransaction` from one is accepted unsigned. wagmi's `mock`
 * connector forwards every unhandled method straight to the chain's RPC, so
 * the two together give real transactions with no wallet prompt and no keys in
 * the app.
 *
 * All three of `connect`, `getChainId` and `getProvider` are pinned to anvil,
 * and each is load-bearing. `mock` answers `config.chains[0]` everywhere it is
 * not told otherwise, which here is Base Sepolia:
 *
 *   - unpinned `getProvider` aims local transactions at a public testnet RPC;
 *   - unpinned `getChainId` makes the app believe the wallet is on Base
 *     Sepolia, which reads as "no such collection on this network" while
 *     standing on the collection;
 *   - unpinned `connect` is the one that actually decides. wagmi stores the
 *     chain id the CONNECT returned, so overriding only the other two leaves
 *     the store on 84532 and every write fails with "the current chain of the
 *     wallet does not match the target chain for the transaction".
 *
 * `NODE_ENV` is inlined by the bundler, so a production build drops both the
 * connectors and this module.
 */
export const ANVIL_ACCOUNTS: { label: string; address: Address }[] = [
  { label: "Deployer", address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" },
  { label: "Alice", address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" },
  { label: "Bob", address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" },
  { label: "Carol", address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906" },
];

function anvilConnector(label: string, address: Address): CreateConnectorFn {
  const base = mock({
    accounts: [address],
    // `reconnect` is what makes `isAuthorized()` answer truthfully; without it
    // wagmi treats the connector as unauthorized and tears the session down.
    features: { reconnect: true, defaultConnected: false },
  });
  return (config) => {
    const connector = base(config);
    return {
      ...connector,
      id: `anvil-${address.toLowerCase()}`,
      name: `Anvil · ${label}`,
      connect: async (params) => ({
        ...(await connector.connect(params)),
        chainId: anvil.id,
      }),
      getProvider: () => connector.getProvider({ chainId: anvil.id }),
      getChainId: async () => anvil.id,
    };
  };
}

export const anvilConnectors: CreateConnectorFn[] =
  process.env.NODE_ENV === "development"
    ? ANVIL_ACCOUNTS.map((a) => anvilConnector(a.label, a.address))
    : [];
