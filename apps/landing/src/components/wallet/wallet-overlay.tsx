"use client";

import {
  type OfferedWallet,
  useWalletAccount,
  useWalletModal,
  useWalletPicker,
} from "@0xslots/wallet";
import { Check, Copy, ExternalLink, Loader2, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { lazy, Suspense, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const QrCode = lazy(() => import("@0xslots/wallet/qr"));

/**
 * The app's one wallet surface, in the middle of the app.
 *
 * Mounted once per provider tree rather than beside every trigger: connecting
 * is reached from the sidebar, the account menu and the create form, and three
 * copies of a dialog is three places for one of them to drift. Centred on
 * every width — a bottom sheet is a phone convention this app does not follow
 * anywhere else, and half of the traffic here is a laptop.
 */
export function WalletOverlay() {
  const { panel, close } = useWalletModal();
  return (
    <Dialog.Root open={panel !== null} onOpenChange={(o) => !o && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-100 bg-black/40 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-101 flex max-h-[85dvh] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto border bg-popover p-5 text-popover-foreground shadow-lg outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <Dialog.Close
            className="absolute right-3 top-3 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-4" />
          </Dialog.Close>
          {panel === "account" ? <AccountPanel /> : <ConnectPanel />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ConnectPanel() {
  const {
    wallets,
    installable,
    others,
    mobile,
    picking,
    pairing,
    stranded,
    error,
    cancel,
  } = useWalletPicker();

  if (pairing)
    return (
      <>
        <Dialog.Title className="text-base font-semibold">
          Open {pairing.wallet.name}
        </Dialog.Title>
        <Dialog.Description className="mt-1 text-xs text-muted-foreground">
          {mobile
            ? "Approve the connection in your wallet."
            : "Scan this with the wallet on your phone."}
        </Dialog.Description>

        <div className="mx-auto mt-4 w-full max-w-[16rem] bg-white p-2">
          {pairing.uri ? (
            <Suspense fallback={<CodeLoading />}>
              <QrCode value={pairing.uri} className="block w-full" />
            </Suspense>
          ) : (
            <CodeLoading />
          )}
        </div>

        {pairing.link && (
          <Button asChild variant="outline" className="mt-4">
            <a href={pairing.link}>Open {pairing.wallet.name}</a>
          </Button>
        )}
        {stranded && (
          <p className="mt-3 text-xs text-muted-foreground">
            {pairing.wallet.name} did not open. Try again, or install it.
          </p>
        )}

        <div className="mt-4 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={cancel}
            className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Pick another wallet
          </button>
          {pairing.wallet.install && (
            <a
              href={pairing.wallet.install}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Get {pairing.wallet.name}
            </a>
          )}
        </div>
        {error && <ErrorLine>{error}</ErrorLine>}
      </>
    );

  return (
    <>
      <Dialog.Title className="text-base font-semibold">
        Connect a wallet
      </Dialog.Title>
      <Dialog.Description className="mt-1 text-xs text-muted-foreground">
        Your wallet holds the slots you buy and signs what you do with them.
      </Dialog.Description>

      <div className="mt-4 grid gap-1.5">
        {wallets.map(({ wallet, choose }) => (
          <WalletRow
            key={wallet.name}
            wallet={wallet}
            busy={picking === wallet.name}
            disabled={!!picking}
            onClick={() => void choose()}
          />
        ))}
        {others.map(({ connector, choose }) => (
          <WalletRow
            key={connector.uid}
            wallet={{ name: connector.name, rdns: [], icon: connector.icon }}
            busy={picking === connector.name}
            disabled={!!picking}
            onClick={() => void choose()}
          />
        ))}
        {installable.map((wallet) => (
          <a
            key={wallet.name}
            href={wallet.install}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-11 items-center gap-3 border border-dashed px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Mark wallet={wallet} />
            <span className="flex-1">Get {wallet.name}</span>
            <ExternalLink className="size-3.5" />
          </a>
        ))}
      </div>

      {picking && (
        <button
          type="button"
          onClick={cancel}
          className="mt-3 self-start text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Cancel
        </button>
      )}
      {error && <ErrorLine>{error}</ErrorLine>}
    </>
  );
}

function AccountPanel() {
  const {
    address,
    walletName,
    chainId,
    chains,
    supported,
    busy,
    copied,
    error,
    copy,
    switchChain,
    disconnect,
    changeWallet,
  } = useWalletAccount();

  return (
    <>
      <Dialog.Title className="text-base font-semibold">
        Your wallet
      </Dialog.Title>
      <Dialog.Description className="mt-1 text-xs text-muted-foreground">
        {walletName ?? "Connected"}
      </Dialog.Description>

      <button
        type="button"
        onClick={() => void copy()}
        className="mt-4 flex min-h-11 w-full items-center gap-3 border px-3 font-mono text-xs transition-colors hover:bg-accent"
      >
        <span className="flex-1 truncate text-left">{address}</span>
        {copied ? (
          <Check className="size-3.5 text-emerald-600" />
        ) : (
          <Copy className="size-3.5 text-muted-foreground" />
        )}
      </button>

      <p className="mt-4 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        Network
      </p>
      <div className="mt-1.5 grid gap-1.5">
        {!supported && (
          <p className="border border-destructive/40 px-3 py-2 text-xs text-destructive">
            This wallet is on a network 0xSlots does not serve. Pick one below.
          </p>
        )}
        {chains.map((chain) => (
          <button
            key={chain.id}
            type="button"
            disabled={busy}
            onClick={() => void switchChain(chain.id)}
            className={cn(
              "flex min-h-10 items-center gap-3 border px-3 text-sm transition-colors hover:bg-accent disabled:opacity-50",
              chain.id === chainId && "bg-accent",
            )}
          >
            <span className="flex-1 text-left">{chain.name}</span>
            {chain.id === chainId && <Check className="size-3.5" />}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-1.5">
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => void changeWallet()}
        >
          Change wallet
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => void disconnect()}
        >
          Disconnect
        </Button>
      </div>
      {error && <ErrorLine>{error}</ErrorLine>}
    </>
  );
}

function WalletRow({
  wallet,
  busy,
  disabled,
  onClick,
}: {
  wallet: OfferedWallet;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex min-h-11 items-center gap-3 border px-3 text-sm transition-colors hover:bg-accent disabled:cursor-wait disabled:opacity-50"
    >
      <Mark wallet={wallet} />
      <span className="flex-1 text-left">{wallet.name}</span>
      {busy && <Loader2 className="size-3.5 animate-spin" />}
    </button>
  );
}

function Mark({ wallet }: { wallet: OfferedWallet }) {
  const [failed, setFailed] = useState(false);
  if (wallet.icon && !failed)
    // Not next/image: these are data URIs from the wallet catalogue, and the
    // optimizer has nothing to fetch or resize.
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={wallet.icon}
        alt=""
        className="size-7 shrink-0 object-cover"
        onError={() => setFailed(true)}
      />
    );
  return (
    <span
      aria-hidden
      className="grid size-7 shrink-0 place-items-center text-xs font-bold text-white"
      style={{ background: wallet.brand ?? "#0052ff" }}
    >
      {wallet.name[0]}
    </span>
  );
}

function CodeLoading() {
  return (
    <div
      role="status"
      className="grid aspect-square w-full place-items-center text-xs text-zinc-500"
    >
      Preparing connection…
    </div>
  );
}

function ErrorLine({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="mt-3 text-xs leading-snug text-destructive">
      {children}
    </p>
  );
}
