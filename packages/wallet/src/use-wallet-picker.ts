"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Connector, useConfig, useConnect } from "wagmi";
import { resolveConnector } from "./connectors";
import { describeError } from "./errors";
import { useOnMobile } from "./mobile";
import { useWalletModal } from "./provider";
import {
  connectorFor,
  deepLink,
  OFFERED,
  type OfferedWallet,
  unlisted,
} from "./wallets";

/** A wallet the picker can offer right now, and how to start it. */
export type WalletChoice = {
  wallet: OfferedWallet;
  /** Announced by an extension, so it connects directly. */
  installed: boolean;
  /** Reached through the WalletConnect relay, so a URI has to be shown. */
  viaRelay: boolean;
  choose: () => Promise<void>;
};

/** Something wagmi discovered that the catalogue does not name. */
export type DiscoveredChoice = {
  connector: Connector;
  choose: () => Promise<void>;
};

/** A relay session in progress: the URI arrives a moment after the choice. */
export type Pairing = {
  wallet: OfferedWallet;
  uri: string | null;
  /** Where a phone should go to open the wallet. Null until there is a URI,
   *  and always null for a wallet with no app to open. */
  link: string | null;
};

/**
 * Everything a connect panel has to show and do, with nothing about how.
 *
 * The rows are the catalogue matched against what wagmi found, in catalogue
 * order. Choosing one resolves its connector (building the relay or the Base
 * Account SDK on first use), listens for the pairing URI when there is one,
 * connects, and closes the panel. Cancelling drops the listeners and the
 * attempt; a late result from a cancelled attempt is ignored.
 *
 * State resets whenever the panel is not the connect panel, so an overlay
 * that stays mounted behaves the same as one that unmounts.
 */
export function useWalletPicker() {
  const { options, panel, close } = useWalletModal();
  const config = useConfig();
  const { connectAsync, connectors, reset } = useConnect();
  const mobile = useOnMobile();
  const [picking, setPicking] = useState<string | null>(null);
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stranded, setStranded] = useState(false);
  const attempt = useRef(0);
  const cleanup = useRef<() => void>(() => {});

  const cancel = useCallback(() => {
    attempt.current++;
    cleanup.current();
    cleanup.current = () => {};
    reset();
    setPicking(null);
    setPairing(null);
    setStranded(false);
    setError(null);
  }, [reset]);

  useEffect(() => {
    if (panel !== "connect") cancel();
  }, [panel, cancel]);
  useEffect(
    () => () => {
      attempt.current++;
      cleanup.current();
    },
    [],
  );

  const choose = useCallback(
    async (wallet: OfferedWallet, direct?: Connector, viaRelay = false) => {
      cancel();
      const current = ++attempt.current;
      setPicking(wallet.name);
      const relayed = viaRelay || wallet.connectorId === "walletConnect";
      if (relayed) setPairing({ wallet, uri: null, link: null });
      try {
        const connector =
          direct ??
          (await resolveConnector(
            config,
            viaRelay ? "walletConnect" : (wallet.connectorId ?? ""),
            options,
          ));
        if (current !== attempt.current) return;
        // Subscribe BEFORE connect: a warm provider emits its URI at once.
        if (relayed) {
          let timer: ReturnType<typeof setTimeout> | undefined;
          const onMessage = ({
            type,
            data,
          }: {
            type: string;
            data?: unknown;
          }) => {
            if (
              current !== attempt.current ||
              type !== "display_uri" ||
              typeof data !== "string"
            )
              return;
            const link = mobile ? deepLink(wallet, data) : null;
            setPairing({ wallet, uri: data, link });
            if (link) {
              window.location.href = link;
              // If the page is still visible after a beat, the app did not
              // open. The URI stays on screen either way.
              timer = setTimeout(() => {
                if (
                  current === attempt.current &&
                  document.visibilityState === "visible"
                )
                  setStranded(true);
              }, 2500);
            }
          };
          connector.emitter.on("message", onMessage);
          cleanup.current = () => {
            connector.emitter.off("message", onMessage);
            clearTimeout(timer);
          };
        }
        await connectAsync({ connector });
        if (current !== attempt.current) return;
        cleanup.current();
        cleanup.current = () => {};
        setPicking(null);
        setPairing(null);
        close();
      } catch (cause) {
        if (current !== attempt.current) return;
        cleanup.current();
        cleanup.current = () => {};
        setPicking(null);
        setError(describeError(cause, "Could not connect. Please try again."));
      }
    },
    [cancel, config, options, mobile, connectAsync, close],
  );

  const canRelay =
    Boolean(options.walletConnectProjectId) ||
    connectors.some((c) => c.id === "walletConnect");

  const { wallets, installable } = useMemo(() => {
    const wallets: WalletChoice[] = [];
    const installable: OfferedWallet[] = [];
    for (const wallet of OFFERED) {
      const direct = connectorFor(wallet, connectors);
      const generic = wallet.connectorId === "walletConnect";
      // The bare relay row is how the OTHER rows reach a phone; on a phone it
      // would show a QR code to the device that cannot scan it.
      if (generic && mobile && !direct) continue;
      const viaRelay = !direct && canRelay && Boolean(wallet.native || generic);
      const reachable =
        Boolean(direct) || viaRelay || wallet.connectorId === "baseAccount";
      if (!reachable) {
        if (wallet.install) installable.push(wallet);
        continue;
      }
      wallets.push({
        wallet: { ...wallet, icon: direct?.icon ?? wallet.icon },
        installed: Boolean(direct),
        viaRelay,
        choose: () => choose(wallet, direct, viaRelay),
      });
    }
    return { wallets, installable };
  }, [connectors, canRelay, mobile, choose]);

  const others = useMemo<DiscoveredChoice[]>(
    () =>
      unlisted(connectors)
        .filter((c) => !["farcaster", "farcasterMiniApp"].includes(c.id))
        .map((connector) => ({
          connector,
          choose: () =>
            choose(
              { name: connector.name, rdns: [], icon: connector.icon },
              connector,
            ),
        })),
    [connectors, choose],
  );

  return {
    wallets,
    installable,
    others,
    mobile,
    /** The wallet being connected, by name. */
    picking,
    pairing,
    /** A phone handoff that did not open the app. */
    stranded,
    error,
    cancel,
  };
}
