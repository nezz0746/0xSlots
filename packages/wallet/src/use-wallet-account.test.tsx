import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWalletModal, WalletProvider } from "./provider";
import { useWalletAccount } from "./use-wallet-account";

const mocks = vi.hoisted(() => ({
  account: {
    status: "connected",
    address: "0x1234567890123456789012345678901234567890" as string | undefined,
    connector: { id: "coinbaseWalletSDK", name: "Coinbase Wallet" } as
      | { id: string; name: string }
      | undefined,
    chainId: 84532 as number | undefined,
  },
  disconnect: vi.fn(),
  switchChain: vi.fn(),
  writeText: vi.fn(),
}));
vi.mock("wagmi", () => ({
  useAccount: () => mocks.account,
  useConfig: () => ({ storage: { getItem: vi.fn() }, state: {} }),
  useConnectors: () => [],
  useDisconnect: () => ({
    disconnectAsync: mocks.disconnect,
    isPending: false,
  }),
  useSwitchChain: () => ({
    chains: [
      { id: 84532, name: "Base Sepolia" },
      { id: 8453, name: "Base" },
    ],
    switchChainAsync: mocks.switchChain,
    isPending: false,
  }),
}));
vi.mock("@wagmi/core", () => ({ reconnect: vi.fn() }));

function Account() {
  const { panel } = useWalletModal();
  const a = useWalletAccount();
  return (
    <div>
      <output data-testid="panel">{panel ?? "none"}</output>
      <output data-testid="wallet">{a.walletName}</output>
      <output data-testid="supported">{String(a.supported)}</output>
      <button type="button" onClick={() => void a.copy()}>
        {a.copied ? "Copied" : "Copy"}
      </button>
      <button type="button" onClick={() => void a.switchChain(8453)}>
        Switch
      </button>
      <button type="button" onClick={() => void a.disconnect()}>
        Disconnect
      </button>
      <button type="button" onClick={() => void a.changeWallet()}>
        Change wallet
      </button>
      {a.error && <p role="alert">{a.error}</p>}
    </div>
  );
}
function App() {
  return (
    <WalletProvider appName="Slots">
      <Opener />
      <Account />
    </WalletProvider>
  );
}
function Opener() {
  const { openAccount } = useWalletModal();
  return (
    <button type="button" onClick={openAccount}>
      Open account
    </button>
  );
}

beforeEach(() => {
  mocks.account.address = "0x1234567890123456789012345678901234567890";
  mocks.account.connector = {
    id: "coinbaseWalletSDK",
    name: "Coinbase Wallet",
  };
  mocks.account.chainId = 84532;
  mocks.disconnect.mockReset().mockResolvedValue(undefined);
  mocks.switchChain.mockReset().mockResolvedValue(undefined);
  mocks.writeText.mockReset().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText: mocks.writeText } });
});
afterEach(cleanup);

describe("account actions", () => {
  it("names the wallet as this app offers it, not as the SDK calls itself", () => {
    render(<App />);
    expect(screen.getByTestId("wallet").textContent).toBe("Base Account");
  });

  it("flags a network the app does not serve", () => {
    mocks.account.chainId = 1;
    render(<App />);
    expect(screen.getByTestId("supported").textContent).toBe("false");
  });

  it("switches network and closes the panel on disconnect", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Open account" }));
    expect(screen.getByTestId("panel").textContent).toBe("account");
    fireEvent.click(screen.getByRole("button", { name: "Switch" }));
    await waitFor(() =>
      expect(mocks.switchChain).toHaveBeenCalledWith({ chainId: 8453 }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    await waitFor(() =>
      expect(screen.getByTestId("panel").textContent).toBe("none"),
    );
  });

  it("sends a wallet change back to the picker", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Open account" }));
    fireEvent.click(screen.getByRole("button", { name: "Change wallet" }));
    await waitFor(() => expect(mocks.disconnect).toHaveBeenCalled());
    expect(screen.getByTestId("panel").textContent).toBe("connect");
  });

  it("reports a refused switch and forgets it when the panel closes", async () => {
    mocks.switchChain.mockRejectedValue(
      new Error("User rejected the request\nVersion: 2"),
    );
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Open account" }));
    fireEvent.click(screen.getByRole("button", { name: "Switch" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "User rejected the request",
    );
    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("confirms a copied address", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() =>
      expect(mocks.writeText).toHaveBeenCalledWith(mocks.account.address),
    );
    expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy();
  });
});
