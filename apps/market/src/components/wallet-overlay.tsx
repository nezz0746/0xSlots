"use client";

import {
  type OfferedWallet,
  useWalletAccount,
  useWalletModal,
  useWalletPicker,
} from "@0xslots/wallet";
import { lazy, Suspense, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const QrCode = lazy(() => import("@0xslots/wallet/qr"));

/**
 * The wallet, in the middle of the market.
 *
 * Centred at every width, including a phone: a sheet sliding up from the
 * bottom is a convention this app follows nowhere else. The package supplies
 * the wallet list and the connection state and nothing visual, so the shell
 * is the app's own — here, the same dialog every other overlay uses.
 */
export function WalletOverlay() {
  const { panel, close } = useWalletModal();

  return (
    <Dialog open={panel !== null} onOpenChange={(next) => !next && close()}>
      {/* Mounted only while a panel is open, so nothing subscribes to
          connectors in the background and no stale panel sits in the
          accessibility tree. */}
      {panel !== null && (
        <DialogContent className="max-w-sm">
          {panel === "connect" && <ConnectPanel />}
          {panel === "account" && <AccountPanel />}
        </DialogContent>
      )}
    </Dialog>
  );
}

function ConnectPanel() {
  const { close } = useWalletModal();
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
        <Head
          title={`Open ${pairing.wallet.name}`}
          note={
            mobile
              ? "Approve the connection in your wallet."
              : "Scan this with the wallet on your phone."
          }
        />
        <div className="mx-auto mt-5 w-full max-w-[15rem] bg-white p-2">
          {pairing.uri ? (
            <Suspense fallback={<CodeLoading />}>
              <QrCode value={pairing.uri} className="block w-full" />
            </Suspense>
          ) : (
            <CodeLoading />
          )}
        </div>

        {pairing.link && (
          <a
            href={pairing.link}
            className="mt-5 block border border-ink bg-ink px-3 py-2.5 text-center text-[13px] text-paper"
          >
            Open {pairing.wallet.name}
          </a>
        )}
        {stranded && (
          <p className="mt-3 text-[12px] leading-snug text-dim">
            {pairing.wallet.name} did not open. Try again, or install it.
          </p>
        )}

        <div className="mt-5 flex items-center justify-between text-[12px]">
          <Quiet onClick={cancel}>Pick another wallet</Quiet>
          {pairing.wallet.install && (
            <a
              href={pairing.wallet.install}
              target="_blank"
              rel="noreferrer"
              className="text-dim underline underline-offset-4 hover:text-ink"
            >
              Get {pairing.wallet.name}
            </a>
          )}
        </div>
        {error && <Alert>{error}</Alert>}
      </>
    );

  return (
    <>
      <Head
        title="Connect a wallet"
        note="Your wallet holds the works you take, and pays their rent."
      />
      <div className="mt-5 grid gap-1.5">
        {wallets.map(({ wallet, choose }) => (
          <Row
            key={wallet.name}
            wallet={wallet}
            busy={picking === wallet.name}
            disabled={!!picking}
            onClick={() => void choose()}
          />
        ))}
        {others.map(({ connector, choose }) => (
          <Row
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
            className="flex min-h-12 items-center gap-3 border border-dashed border-line px-3 text-[13px] text-dim transition-colors hover:bg-lift hover:text-ink"
          >
            <Mark wallet={wallet} />
            <span className="flex-1">Get {wallet.name}</span>
            <span aria-hidden>↗</span>
          </a>
        ))}
      </div>
      {picking && (
        <div className="mt-3 text-[12px]">
          <Quiet onClick={cancel}>Cancel</Quiet>
        </div>
      )}
      {error && <Alert>{error}</Alert>}
    </>
  );
}

function AccountPanel() {
  const { close } = useWalletModal();
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
      <Head title="Your wallet" note={walletName ?? "Connected"} />

      <button
        type="button"
        onClick={() => void copy()}
        className="mt-5 flex min-h-12 w-full items-center gap-3 border border-line px-3 text-[12px] transition-colors hover:bg-lift"
      >
        <span className="flex-1 truncate text-left tabular">{address}</span>
        <span className="shrink-0 text-dim">{copied ? "Copied" : "Copy"}</span>
      </button>

      <p className="mt-5 text-[11px] text-muted-foreground">Network</p>
      {!supported && (
        <p className="mt-1.5 border border-ebbing/40 px-3 py-2 text-[12px] leading-snug text-ebbing">
          This wallet is on a network Slotmarket does not serve.
        </p>
      )}
      <div className="mt-1.5 grid gap-1.5">
        {chains.map((chain) => (
          <button
            key={chain.id}
            type="button"
            disabled={busy}
            onClick={() => void switchChain(chain.id)}
            className={`flex min-h-10 items-center border px-3 text-[13px] transition-colors disabled:opacity-50 ${
              chain.id === chainId
                ? "border-ink bg-lift"
                : "border-line hover:bg-lift"
            }`}
          >
            <span className="flex-1 text-left">{chain.name}</span>
            {chain.id === chainId && <span aria-hidden>·</span>}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-1.5">
        <button
          type="button"
          disabled={busy}
          onClick={() => void changeWallet()}
          className="min-h-10 border border-line px-3 text-[13px] transition-colors hover:bg-lift disabled:opacity-50"
        >
          Change wallet
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void disconnect()}
          className="min-h-10 px-3 text-[13px] text-dim transition-colors hover:text-ebbing disabled:opacity-50"
        >
          Disconnect
        </button>
      </div>
      {error && <Alert>{error}</Alert>}
    </>
  );
}

/**
 * A panel's heading, as the dialog's own title.
 *
 * `DialogTitle` rather than an `h2`: Radix announces it as the dialog's label,
 * and a modal without one is unlabelled to a screen reader. The close button
 * went with it — `DialogContent` renders one, and two in the same corner was
 * the shadcn move showing through the hand-rolled version underneath.
 */
function Head({ title, note }: { title: string; note: string }) {
  return (
    <DialogHeader>
      <DialogTitle>{title}</DialogTitle>
      <DialogDescription>{note}</DialogDescription>
    </DialogHeader>
  );
}

function Row({
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
      className="flex min-h-12 items-center gap-3 border border-line px-3 text-[13px] transition-colors hover:bg-lift disabled:cursor-wait disabled:opacity-50"
    >
      <Mark wallet={wallet} />
      <span className="flex-1 text-left">{wallet.name}</span>
      {busy && (
        <span role="status" aria-label="Connecting" className="text-dim">
          …
        </span>
      )}
    </button>
  );
}

function Mark({ wallet }: { wallet: OfferedWallet }) {
  const [failed, setFailed] = useState(false);
  if (wallet.icon && !failed)
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
      className="grid size-7 shrink-0 place-items-center text-[11px] font-bold text-white"
      style={{ background: wallet.brand ?? "#2c3e9e" }}
    >
      {wallet.name[0]}
    </span>
  );
}

function CodeLoading() {
  return (
    <div
      role="status"
      className="grid aspect-square w-full place-items-center text-[12px] text-dim"
    >
      Preparing connection…
    </div>
  );
}

function Quiet({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-dim underline underline-offset-4 transition-colors hover:text-ink"
    >
      {children}
    </button>
  );
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="mt-4 text-[12px] leading-snug text-ebbing">
      {children}
    </p>
  );
}
