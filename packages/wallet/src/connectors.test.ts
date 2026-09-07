import { createConfig, http } from "@wagmi/core";
import { baseSepolia } from "viem/chains";
import { describe, expect, it, vi } from "vitest";
import { resolveConnector } from "./connectors";
import { connectorFor, deepLink, OFFERED, unlisted } from "./wallets";

const mocks = vi.hoisted(() => ({
  walletConnect: vi.fn(),
  coinbaseWallet: vi.fn(),
}));
vi.mock("wagmi/connectors", () => mocks);
const makeConfig = () =>
  createConfig({
    chains: [baseSepolia],
    transports: { [baseSepolia.id]: http() },
    multiInjectedProviderDiscovery: false,
  });

describe("connector ownership", () => {
  it("constructs lazily, disables the SDK modal, and isolates config instances", async () => {
    mocks.walletConnect.mockImplementation(() => () => ({
      id: "walletConnect",
      name: "WalletConnect",
      type: "walletConnect",
    }));
    const a = makeConfig();
    const b = makeConfig();
    expect(mocks.walletConnect).not.toHaveBeenCalled();
    const options = { appName: "Slots", walletConnectProjectId: "project" };
    const [first, same] = await Promise.all([
      resolveConnector(a, "walletConnect", options),
      resolveConnector(a, "walletConnect", options),
    ]);
    const other = await resolveConnector(b, "walletConnect", options);
    expect(first).toBe(same);
    expect(first).not.toBe(other);
    expect(a.connectors).toContain(first);
    expect(b.connectors).not.toContain(first);
    expect(mocks.walletConnect).toHaveBeenCalledWith(
      expect.objectContaining({ showQrModal: false, projectId: "project" }),
    );
  });

  it("deduplicates Base Account's SDK alias and preserves unknown extensions", () => {
    const base = OFFERED.find((w) => w.name === "Base Account");
    if (!base) throw new Error("Base Account missing from wallet catalog");
    const sdk = { id: "coinbaseWalletSDK", name: "Coinbase Wallet" };
    const other = { id: "app.phantom", name: "Phantom" };
    expect(connectorFor(base, [sdk])).toBe(sdk);
    expect(unlisted([sdk, other])).toEqual([other]);
  });

  it("keeps the full pairing URI when handing off to a mobile wallet", () => {
    const wallet = OFFERED.find((w) => w.name === "Rainbow");
    if (!wallet) throw new Error("Rainbow missing from wallet catalog");
    const uri = "wc:topic@2?relay-protocol=irn&symKey=abc";
    expect(deepLink(wallet, uri)).toBe(
      `rainbow://wc?uri=${encodeURIComponent(uri)}`,
    );
  });
});
