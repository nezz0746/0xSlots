import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WalletProvider } from "./provider";
import { useWalletPicker } from "./use-wallet-picker";

const mocks = vi.hoisted(() => ({
  connectAsync: vi.fn(),
  reset: vi.fn(),
  resolve: vi.fn(),
  connectors: [] as unknown[],
  mobile: false,
  listeners: new Set<(message: { type: string; data: unknown }) => void>(),
}));
vi.mock("wagmi", () => ({
  useConfig: () => ({}),
  useAccount: () => ({ status: "connected", connector: undefined }),
  useConnectors: () => mocks.connectors,
  useConnect: () => ({
    connectAsync: mocks.connectAsync,
    connectors: mocks.connectors,
    reset: mocks.reset,
  }),
}));
vi.mock("@wagmi/core", () => ({ reconnect: vi.fn() }));
vi.mock("./connectors", () => ({ resolveConnector: mocks.resolve }));
vi.mock("./mobile", () => ({
  useOnMobile: () => mocks.mobile,
  onMobile: () => mocks.mobile,
}));

const relay = {
  id: "walletConnect",
  emitter: {
    on: (_: string, fn: (message: { type: string; data: unknown }) => void) =>
      mocks.listeners.add(fn),
    off: (_: string, fn: (message: { type: string; data: unknown }) => void) =>
      mocks.listeners.delete(fn),
  },
};
const emit = (data: string) =>
  mocks.listeners.forEach((fn) => {
    fn({ type: "display_uri", data });
  });

/** The smallest thing that can be called a wallet picker. */
function Picker() {
  const { wallets, installable, others, pairing, picking, error, cancel } =
    useWalletPicker();
  return (
    <div>
      {wallets.map((w) => (
        <button
          key={w.wallet.name}
          type="button"
          onClick={() => void w.choose()}
        >
          {w.wallet.name}
        </button>
      ))}
      {others.map((o) => (
        <button
          key={o.connector.id}
          type="button"
          onClick={() => void o.choose()}
        >
          {o.connector.name}
        </button>
      ))}
      {installable.map((w) => (
        <a key={w.name} href={w.install}>
          Get {w.name}
        </a>
      ))}
      <button type="button" onClick={cancel}>
        Cancel
      </button>
      <output data-testid="picking">{picking ?? ""}</output>
      <output data-testid="uri">{pairing?.uri ?? ""}</output>
      <output data-testid="link">{pairing?.link ?? ""}</output>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

function App({ projectId = "public-id" }: { projectId?: string }) {
  return (
    <WalletProvider appName="Test" walletConnectProjectId={projectId}>
      <Picker />
    </WalletProvider>
  );
}

beforeEach(() => {
  mocks.connectors = [];
  mocks.mobile = false;
  mocks.listeners.clear();
  mocks.resolve.mockReset().mockResolvedValue(relay);
  mocks.connectAsync
    .mockReset()
    .mockImplementation(() => new Promise(() => {}));
  mocks.reset.mockReset();
});
afterEach(cleanup);

describe("wallet picker logic", () => {
  it("prefers an installed wallet and never builds the relay for it", async () => {
    const installed = { id: "io.metamask", name: "MetaMask", uid: "installed" };
    mocks.connectors = [installed];
    mocks.connectAsync.mockResolvedValue({});
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "MetaMask" }));
    await waitFor(() =>
      expect(mocks.connectAsync).toHaveBeenCalledWith({ connector: installed }),
    );
    expect(mocks.resolve).not.toHaveBeenCalled();
  });

  it("captures a URI emitted before connect resolves", async () => {
    mocks.connectAsync.mockImplementation(() => {
      emit("wc:test@2?key=abc&relay=irn");
      return new Promise(() => {});
    });
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Rainbow" }));
    await waitFor(() =>
      expect(screen.getByTestId("uri").textContent).toBe(
        "wc:test@2?key=abc&relay=irn",
      ),
    );
    expect(screen.getByTestId("picking").textContent).toBe("Rainbow");
    // No app to hand off to on a laptop, so nothing to open.
    expect(screen.getByTestId("link").textContent).toBe("");
  });

  it("hands a phone the wallet's own scheme, and hides the bare relay row", async () => {
    mocks.mobile = true;
    // jsdom cannot navigate and says so loudly. The handoff is what is under
    // test, so the assignment is captured rather than performed.
    const opened: string[] = [];
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        get href() {
          return "http://localhost/";
        },
        set href(value: string) {
          opened.push(value);
        },
      },
    });
    mocks.connectAsync.mockImplementation(() => {
      emit("wc:test@2?key=abc");
      return new Promise(() => {});
    });
    render(<App />);
    expect(screen.queryByRole("button", { name: "WalletConnect" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Rainbow" }));
    const link = `rainbow://wc?uri=${encodeURIComponent("wc:test@2?key=abc")}`;
    await waitFor(() =>
      expect(screen.getByTestId("link").textContent).toBe(link),
    );
    expect(opened).toEqual([link]);
  });

  it("reports the first line of a refusal and clears it on cancel", async () => {
    mocks.connectAsync.mockRejectedValue(
      new Error("User rejected connection\nDetails: 4001"),
    );
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Rainbow" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "User rejected connection",
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(mocks.listeners.size).toBe(0);
  });

  it("drops listeners on cancel and ignores a late connect", async () => {
    let finish!: () => void;
    mocks.connectAsync.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Rainbow" }));
    await waitFor(() => expect(mocks.listeners.size).toBe(1));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mocks.listeners.size).toBe(0);
    await act(async () => finish());
    expect(screen.getByTestId("uri").textContent).toBe("");
  });

  it("keeps discovered wallets and offers installs when there is no relay", () => {
    mocks.connectors = [{ id: "app.phantom", name: "Phantom", uid: "phantom" }];
    render(<App projectId="" />);
    expect(screen.getByRole("button", { name: "Phantom" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Get MetaMask/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "WalletConnect" })).toBeNull();
  });
});
