import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWalletModal, WalletProvider } from "./provider";

const mocks = vi.hoisted(() => ({
  account: {
    status: "disconnected",
    connector: undefined as { id: string; name: string } | undefined,
  },
  connectors: [] as { id: string }[],
  config: { storage: { getItem: vi.fn() }, state: { status: "disconnected" } },
  reconnect: vi.fn(),
  resolveConnector: vi.fn(),
}));
vi.mock("wagmi", () => ({
  useAccount: () => mocks.account,
  useConfig: () => mocks.config,
  useConnectors: () => mocks.connectors,
}));
vi.mock("@wagmi/core", () => ({ reconnect: mocks.reconnect }));
vi.mock("./connectors", () => ({ resolveConnector: mocks.resolveConnector }));

/** Stands in for whatever chrome an app draws around the panels. */
function Panels() {
  const { panel, openConnect, openAccount, close } = useWalletModal();
  return (
    <div>
      <button type="button" onClick={openConnect}>
        Connect
      </button>
      <button type="button" onClick={openAccount}>
        Account
      </button>
      <button type="button" onClick={close}>
        Dismiss
      </button>
      <output>{panel ?? "none"}</output>
    </div>
  );
}
const App = () => (
  <WalletProvider appName="Slots" walletConnectProjectId="project">
    <Panels />
  </WalletProvider>
);

beforeEach(() => {
  mocks.account.status = "disconnected";
  mocks.account.connector = undefined;
  mocks.connectors = [];
  mocks.config.storage.getItem.mockReset().mockResolvedValue(null);
  mocks.resolveConnector.mockReset().mockResolvedValue({ id: "walletConnect" });
  mocks.reconnect.mockReset().mockResolvedValue([]);
});
afterEach(cleanup);

describe("wallet panel state", () => {
  it("names the open panel and renders no chrome of its own", () => {
    const { container } = render(<App />);
    expect(screen.getByRole("status").textContent).toBe("none");
    expect(container.querySelectorAll("dialog").length).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    expect(screen.getByRole("status").textContent).toBe("connect");
    fireEvent.click(screen.getByRole("button", { name: "Account" }));
    expect(screen.getByRole("status").textContent).toBe("account");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.getByRole("status").textContent).toBe("none");
  });

  it("restores a deferred relay only when it was the previous wallet", async () => {
    mocks.config.storage.getItem.mockResolvedValue("walletConnect");
    render(<App />);
    await waitFor(() =>
      expect(mocks.reconnect).toHaveBeenCalledWith(mocks.config, {
        connectors: [{ id: "walletConnect" }],
      }),
    );
    expect(mocks.resolveConnector).toHaveBeenCalledTimes(1);
  });

  it("retries discovery when the previous extension announces after mount", async () => {
    mocks.config.storage.getItem.mockResolvedValue("me.rainbow");
    const view = render(<App />);
    await waitFor(() =>
      expect(mocks.config.storage.getItem).toHaveBeenCalled(),
    );
    expect(mocks.reconnect).not.toHaveBeenCalled();
    const connector = { id: "me.rainbow" };
    mocks.connectors = [connector];
    view.rerender(<App />);
    await waitFor(() =>
      expect(mocks.reconnect).toHaveBeenCalledWith(mocks.config, {
        connectors: [connector],
      }),
    );
  });

  it("does not reconnect a wallet the visitor has just disconnected", async () => {
    mocks.account.status = "connected";
    mocks.account.connector = { id: "coinbaseWalletSDK", name: "Coinbase" };
    mocks.config.storage.getItem.mockResolvedValue("coinbaseWalletSDK");
    const view = render(<App />);
    mocks.account.status = "disconnected";
    mocks.account.connector = undefined;
    view.rerender(<App />);
    await waitFor(() =>
      expect(mocks.config.storage.getItem).toHaveBeenCalled(),
    );
    expect(mocks.reconnect).not.toHaveBeenCalled();
  });
});
