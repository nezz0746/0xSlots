import type { Address } from "viem";
import { anvil } from "viem/chains";
import type { CreateConnectorFn } from "wagmi";
import { mock } from "wagmi/connectors";

/**
 * Click-to-send local accounts.
 *
 * Anvil unlocks the accounts derived from its default mnemonic, so
 * `eth_sendTransaction` from one of them is accepted with no signature. wagmi's
 * `mock` connector forwards every unhandled method — `eth_sendTransaction`
 * included — straight to the chain's HTTP RPC, so the two together give real
 * transactions with no wallet prompt and no private keys in the app.
 *
 * ── The footgun this works around ────────────────────────────────────────────
 *
 * `mock`'s `setup()` sets its chain to `config.chains[0]`, and `getProvider()`
 * falls back to the same when called without a chainId. `config.chains[0]` here
 * is Base mainnet, so an un-pinned mock connector would aim
 * `eth_sendTransaction` at a public mainnet RPC. It would fail rather than do
 * damage — no account is unlocked there — but the error would be baffling.
 * `getProvider` is therefore overridden to always resolve anvil.
 *
 * Development only. `wagmi.ts` omits these entirely from a production build.
 */

/** Standard anvil mnemonic accounts, matching the roles SeedLocal.s.sol gives them. */
export const ANVIL_ACCOUNTS: { label: string; address: Address }[] = [
  { label: "Deployer", address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" },
  { label: "Alice", address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" },
  { label: "Bob", address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" },
  { label: "Carol", address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906" },
];

export const anvilConnectorId = (address: Address) =>
  `anvil-${address.toLowerCase()}`;

function anvilConnector(label: string, address: Address): CreateConnectorFn {
  const base = mock({
    accounts: [address],
    // `reconnect` is what makes `isAuthorized()` answer truthfully; without it
    // wagmi treats the connector as unauthorized and tears the session down.
    // `defaultConnected` stays false so nothing auto-connects a fake account
    // while the app is pointed at a real chain — the switcher restores the last
    // choice itself, and only on 31337.
    features: { reconnect: true, defaultConnected: false },
  });
  return (config) => {
    const connector = base(config);
    return {
      ...connector,
      id: anvilConnectorId(address),
      name: `Anvil · ${label}`,
      // Pin the RPC to anvil, whatever wagmi thinks the active chain is.
      getProvider: () => connector.getProvider({ chainId: anvil.id }),
    };
  };
}

export const anvilConnectors: CreateConnectorFn[] = ANVIL_ACCOUNTS.map((a) =>
  anvilConnector(a.label, a.address),
);
