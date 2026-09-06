/**
 * The wallets this app offers, in the order it offers them.
 *
 * wagmi finds installed wallets on its own: they announce themselves over
 * EIP-6963 with a name and an icon, and arrive as connectors. That covers
 * Rabby, Rainbow and Zerion, none of which ship a connector of their own.
 *
 * What discovery cannot do is mention a wallet that is not installed. A picker
 * built only from what announced itself shows one row on a fresh browser and
 * looks broken, so the five are named here and matched against whatever turned
 * up. Installed ones connect; the rest say where to get them.
 *
 * The rdns values are the identifiers each wallet publishes in its EIP-6963
 * announcement, and wagmi uses them as the connector id.
 */
export type OfferedWallet = {
  /** How the app refers to it. */
  name: string;
  /**
   * EIP-6963 identifiers this wallet announces itself under.
   *
   * More than one where a wallet has shipped under different names, so a
   * rename upstream does not silently drop it out of the list.
   */
  rdns: string[];
  /** The configured connector's id, for wallets that do not need installing. */
  connectorId?: string;
  /**
   * Ids the connector actually reports at runtime, when they differ.
   *
   * `connectorId` names the entry in `DEFERRED`; the connector wagmi builds
   * from it reports whatever its own package decided to call itself, and those
   * two are not always the same string. Base Account is reached through
   * `coinbaseWallet` in smart-wallet mode — see the note in `config/connectors.ts`
   * for why — and that connector calls itself `coinbaseWalletSDK`.
   *
   * Unmatched, it counted as a wallet nobody had named: the picker listed Base
   * Account from `OFFERED` and a second row called "Coinbase Wallet", both
   * reaching the same wallet, one of them with a placeholder letter for a mark.
   */
  aliases?: string[];
  /** Where to get it, for a browser that does not have it. */
  install?: string;
  /**
   * The URL scheme the wallet's phone app answers on.
   *
   * Taken from WalletConnect's own registry rather than written from memory,
   * because a scheme that is one character out fails silently: the phone just
   * does nothing, which looks like the app not being installed.
   *
   * Only wallets that ship a phone app have one, and Base Account has none by
   * design: it is a popup, so a mobile browser reaches it the same way a laptop
   * does.
   */
  native?: string;
  /**
   * The wallet's own mark, for the row shown before it is installed.
   *
   * An installed wallet announces its icon over EIP-6963 and that one is used
   * instead, because it is whatever version the wallet currently ships. These
   * are the same marks from WalletConnect's registry, which publishes them for
   * exactly this: naming a wallet in a list of wallets.
   */
  icon?: string;
  /** Behind the mark while it loads, and the fallback if it ever fails. */
  brand?: string;
};

export const OFFERED: OfferedWallet[] = [
  {
    // First, because this is a Base app and it is the only one here that asks
    // for neither an extension nor a relay: it opens a popup and works.
    name: "Base Account",
    rdns: [],
    connectorId: "baseAccount",
    aliases: ["coinbaseWalletSDK"],
  },
  {
    name: "MetaMask",
    rdns: ["io.metamask", "io.metamask.mobile"],
    install: "https://metamask.io/download/",
    native: "metamask://",
    icon: "data:image/png;base64,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",
    brand: "#f6851b",
  },
  {
    name: "Rabby",
    rdns: ["io.rabby"],
    install: "https://rabby.io/",
    native: "rabby://",
    icon: "data:image/png;base64,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",
    brand: "#7084ff",
  },
  {
    name: "Rainbow",
    rdns: ["me.rainbow"],
    install: "https://rainbow.me/download",
    native: "rainbow://",
    icon: "data:image/png;base64,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",
    brand: "#001e59",
  },
  {
    name: "Zerion",
    rdns: ["io.zerion.wallet"],
    install: "https://zerion.io/download",
    native: "zerion://",
    icon: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHgAAAB4CAMAAAAOusbgAAACSVBMVEUkYe3///8gXu31+P5Cd/Dz9v4+dO8jYO0bW+wcW+wdXOwiYO0hX+0fXe0eXe0jYe0iX+0eXOz2+P4fXu0lYu0cXOxDd/AbWuz09/5FefAoZO33+f6wxvjK2fvI1/qPrvYmY+0qZe02bu41be4hXu0taO5Of/AsZ+48cu8zbO4xau5Nf/A7cu9LffA5cO84b+8xa+5Ade9zmvNfjPJ3nfRVhfF1m/RTg/FjjvJ/o/Te5/ynv/iFp/Xm7f2MrPX+/v/Z4/y3y/mlvvj2+f6Tsfbi6v37/P/p7/3o7v3y9v7x9f7w9P7O3PtHevBokvNvl/Pa5PzA0vo9c+/4+v7X4vxJfPA4cO82bu8/de8rZu4pZO0wae5MfvA6ce9KfPBJe/AnY+0mYu1DePBBdu8wau4eXew/dO8uaO4tZ+5rlPNaiPFqk/NZh/F0m/Rjj/JRgvFymfNhjfJQgfF7oPRpk/NYh/FXhvF4nfRWhfFmkPJxmfNei/JulvN0mvRQgPF+ovRtlvN9ofRslfO90PrN2/vu8v76/P+5zPmowPiXtPb5+/+GqPXo7/2Ws/bn7v3V4fz19/7j6v2wxvmNrfbt8v3L2vv9/f/b5fzJ2Pu4zPmnwPimv/jH1vq2yvnk7P3S3/vh6fzg6PzP3PucuPe9z/qbt/f9/v+8zvn8/f/r8f3a5fyZtfeIqfX6+//Y4/z5+v7G1vrn7f2kvvjF1fqjvfezyPmRsPbz9/6yx/mOrfbf6PxDd+8pZe1Cd+9qlPNwmPO8z/nl7P3T3/t/i9OqAAADP0lEQVR4nO2Z5XbbQBBGd5Q6WsmyzInDzMwMTdKmYSwzMzMzMzMzM3OfrCenTo7jGqRdqX+69wF8j2Zmvx1ZCDEYDAaDwWAwGAwGgxpe4ogwUnpl89SwEeoJm5Am8jRea9mVVpstRDW2kE8VRgqzKacFiPloJRfLb8m94CrgSL3GiZUUYlgokIr5yHoa8UaRVIycjym8NUkSsVjKjyEX7ySuNEKISzn4nNDbPoMqQyQh9TWR995a8g7/wYqKxxCIG2i9CPE479UDtd6a8cSH2APOWaJ2yAqxBl6EkOhY3azGu1uiuiI84PG4N6MVe1sjTBp5B+otlL1QKq4O1847UG9UOEqRN3Ym7RrgBY/zj4YE90ZNobgQ/SDhjpFBxbUaTfRwTPaV1wN790zSuNBuzELk9kBRFpWlfaHdGHHi7Si/4ie6FNpNsjDWX6tjHfoUehDZXtTuy2uYLuvqRcgsxhf7ONUV2kaHT3icGdfm5b1Ps0wrR8KhDU89vQ9DNczogHBi1n4P8RqaNUslsn3zBbe2sZR+6/CD0SQIVq+l1Sw6dpy1Qd2Z6By9npcXElbt6lqSIXipeScqKFmeKOvVX4tlfXcdABxrygu3eKk5WSbf3oPA85cHZ6j58Hysbz55gms9xreyNF4w/xuvc93wletWOTf3X3ilOY+80/HONlGL3TkwZrHq71zeVzUP6zZSboTFvq4iaDs9GesazlzuS59igJtLHbrFFUK8/ZQfLwDELNItORDe5N8LANGzdGo1l3skoBgMTZl6tJo3RQf2AsCNrUj7VgtbgnoHlrwNWp9qLumaEjGcO5AermmAi5cUeQFgb3WChgEuFCn1AsDxcpNWR8uS9kyFGOBqBLYo+Nng4HeqvADv41IEDY6WPK1RpRjgfCdHXW/e2KPaCwAXqeuNV5B4AVxxC6jmW8o4SSYGqF9mosgT4S6pFwA+ZBO/N8qphyjE8LPDTuY1W37QeAF6CF8duV4XndjVS9Zm7msfnbjvM5nY+KWfTtydQHhbid/oxN+JdwNT5y/D0Pc92wmDGlr6uyiCU4xPH/qkGTY7VA3ZkVS7EJ9M9hGX4zT7p5zBYDAYDAaDwWAw/mN+A3VlbP6kMBEvAAAAAElFTkSuQmCC",
    brand: "#2461ed",
  },
  {
    /*
      Last, and not really a wallet: it is the relay every wallet above uses to
      reach a phone, offered under its own name for the ones nobody thought to
      list. On a phone it is hidden, because there it is how the rows above
      work rather than an alternative to them.
    */
    name: "WalletConnect",
    rdns: [],
    connectorId: "walletConnect",
    icon: "data:image/png;base64,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dOnOnTu1vMEwDssHO4uKirZv305eslBfX89wJJNyu93V1dXTp0+Pi4vT+aYoh8NRV1dnNptnzJjx6quvssoWs+UGnud37Ngxbdo0k8nkdDr7+/t1u7M7JyenqqqKvOnPbrebzebvvvuO9aBCy8jIeO+998gSTGpqanJyMquLADbB4nl+586d8vqNyWTKysrq6+vTYbZcLheZq+R/IW/YamtrYzquEBwOh5wqIjU11WKxMMkWg2AVFhaOTZUsMzOzr69PV7df3G73nj17lG8ldTgccXFxp0+fZjSuEOx2+7hUETabbc6cOSdOnNB4PFoHi8xVIV+vYDKZMjMz9dOJ8nlVyP9qt9v1k62MjIz3339/opsQixcv1r4TNQ3WuAZU0k8nulyukHPVWOROH/NOVDagkvadqF2wioqKduzYESZVMuadmJOTE2auGsvhcLA9l5evASf9pM1mS0pK+uabbzQZl1bBkq8BI/kw2050u93yNWAk0tLSWHXi2GvASGh5nahFsNasWbNr165I5ioZq06MpAGVmHRiJA2olJqaqs28BR4snud37doV3d9qnK2cnJyamppbbrklir91OBwJCQma3aaMvAGVtDnfgg0Wz/Pbt2+f0lw1jmadSNaroksVQZ7D0WDemmoDKtlsNuhOBAyW2Wzet2+fyjfMkk7s7e1tb2+nN7TxXC7XO++8E92v6IzlcDigs2W328OsLETOarW2tLTAvToQMFjBYLCpqSkrK2v27NkqD7VkyRK4TlTTgEqgnRjdeZWSKIoej+eXX36hNK4QYKtQkqTm5uYnn3xS/bcAdaL6BlQC6kT1DUiIovjss8+eO3eO0rhCAz95lyTpxIkTjz/+uMovgrhOnOiOjXrU7/lQnKvKyso0eDezFssN165d+/zzz6l0IsVsud1uig2oZLfbZ86cefLkSfWHUnMNOJYoijzPnz17Vv2QJqXRAinpxOzs7Pj4eJWHotKJZL0KLlUElX0QtBowGAwWFRVBN6BMu1s6kiR99dVXtDpREISo7/nANaCSyk6kdQ0oiuLGjRu1/HUCTW9CU+zEqK8ToRtQKepOpHhepVkDyrTeNsO2E7VpQKUoOtGgDShjsNFPkqSmpib1axBTvU6MfM8ChCntgwi/vypyoigWFRX9+OOPKo8TBTZbkyVJ0vg60eVyadyAShHug6DbgNrPVQSzhykkSWptbX3qqaeodGL4/Vvkjg3bVBGT7oOYaIfxVAWDwY0bN2p8XjUWy5eCXLt2jVYnhjnfotWAPp/vr7/+Uj/FhulEug3I9hfqGL9thlYnTnS+RasBfT6fx+M5dOiQ0+mcM2eOyqOFPJePjQaUsX+NEelE9etbpBMHBgbkbJH1KvWpEgRhw4YN7e3tQ0NDzc3NVLI1bn2L4tp6WVkZwwaUsQ+WvL5FpRPlZ1/HPmWqhs/nW7t2rbxpZ2hoqKmpyeVyqe9E+dlXuneXdfIbrTp6KYjFYmlsbLzvvvvUH+qDDz5YtWoVlVR5PB7lq9WTkpIaGhoeeOABlcfnOO6jjz5yu93qU+X3+wsLC5k/3STTUbA4jrv//vtra2upZEs9QRBKS0snOlmhmC31RFGsqKjQ/qnUMPQVLLrzlho+n2/STUtJSUmNjY2gP8wUCdKATFZBw9Ddi9e8Xm9BQQHbnxUlDTjphZUgCAUFBWx/vNnv9/M8r7dU6TFYcrY6OzuZfLsgCCHPqyb6MM/zoPvxwxBFsbi4WD/nVWPpMVgcx125csXj8Wj/QxI+n6+0tHRKP4REFiO6urogxxUCaUDmD/hPRKfBYtKJETagkvad6Pf7S0tLddiAMv0Gi2QrOztbm070+XyrV6+O+kfbBEHIz8/XJluiKBYWFup2riJ0HSySLQ06kVwDdnR0qDwIz/PQnUgaUJ/nVWPpPVgkW+vXr4frxKgbUAm6E/1+f0VFhZ4bUGaAYJFzeaBOVNmASnCdSBpQV6ugYRgjWECdSKUBQx6WeicapQFlhgmW3Im0skXWq4C2l5BOpLW+RfYsGKIBZUYKFulEKmunPp9v/fr1oD/cTda31Hci2V916tQpSuPSiMGCJXeimnN50oAa/Bw8WZdX04nBYNBYDSgzXrDktdPoOhG0AUN+XdSdqM+7yxEyZLCi7kQNGlApuk40aAPKjBqsKDpRswZUmmonGrcBZQYOlnzPJ5JOJOtVDB8xEAQhNzc3kl+9E0UxPz/foA0oM3awItxjQ9bWqa9XTRXZPh++E0kDGj1VsRAskq2SkpKJOpFhAyqF78RgMFhWVmboBpTFQrDkez7KTmTegEqkE5XZIg1o3LP1cWIkWCE7UScNqOTz+cbdq46ZBpTFTrDkTiTzliAI+mlAJdKJJFvkjk1sNKBMd0/pqGexWGpra7du3arbVMnuuOOO+vr6bdu2xdJcRcRgsJAexFQVIv3AYCEQGCwEAoOFQGCwEAgMFgKBwUIgMFgIBAYLgcBgIRAYLAQCg4VAYLAQCAwWAoHBQiAwWAgEBguBwGAhEBgsBAKDhUBgsBAIDBYCgcFCIDBYCAQGC4HAYCEQGCwEAoOFQGCwEAgMFgKBwUIgMFgIBAYLgcBgIRAYLAQCg4VAYLAQCAwWAoHBQiAwWAgEBguBwGAhEBgsBAKDhUBgsBAIDBYCgcFCIDBYCAQGC4HAYCEQGCwEAoOFQGCwEAgMFgKBwUIgMFgIxP8FAAD//1bMOEyOvgjJAAAAAElFTkSuQmCC",
    brand: "#3b99fc",
  },
];

/** A connector, as much of one as this module needs to know about. */
type Candidate = { id: string; name: string; icon?: string | undefined };

/**
 * Which connector, if any, can open a given wallet right now.
 *
 * Announced connectors win over configured ones. A browser with the MetaMask
 * extension announces it with its own icon and reaches it directly, which is
 * better than the SDK's relay, and it is also how the same wallet avoids being
 * listed twice.
 */
export function connectorFor<T extends Candidate>(
  wallet: OfferedWallet,
  connectors: readonly T[],
): T | undefined {
  const announced = connectors.find((connector) =>
    wallet.rdns.includes(connector.id),
  );
  if (announced) return announced;

  const ids = [wallet.connectorId, ...(wallet.aliases ?? [])].filter(
    Boolean,
  ) as string[];

  return ids.length
    ? connectors.find((connector) => ids.includes(connector.id))
    : undefined;
}

/**
 * Anything installed that this app does not list by name.
 *
 * Somebody using a wallet nobody thought to name should still be able to
 * connect with it, and it should be at the bottom rather than absent.
 */
export function unlisted<T extends Candidate>(connectors: readonly T[]): T[] {
  const known = new Set(OFFERED.flatMap((wallet) => wallet.rdns));
  const configured = new Set(
    OFFERED.flatMap((wallet) => [
      wallet.connectorId,
      ...(wallet.aliases ?? []),
    ]).filter(Boolean) as string[],
  );

  return connectors.filter(
    (connector) =>
      !known.has(connector.id) &&
      !configured.has(connector.id) &&
      // The bare injected fallback has no identity to show, and duplicates
      // whatever announced itself properly.
      connector.id !== "injected" &&
      connector.id !== "mock",
  );
}

/**
 * Where to send a phone so its wallet app picks up a WalletConnect session.
 *
 * The uri is the pairing string WalletConnect hands over once the session is
 * proposed, and `wc?uri=` is the path every one of these wallets listens on.
 * Encoded because the uri carries its own query string, and an unencoded one
 * arrives at the wallet cut off at the first ampersand.
 *
 * The scheme is used rather than the wallet's https link. A universal link
 * falls back to a web page when the app is missing, which sounds kinder until
 * you see it: the phone opens a download page mid connection and the pairing
 * is gone. The scheme either opens the app or does nothing, and doing nothing
 * is a state the picker can notice and explain.
 */
export function deepLink(wallet: OfferedWallet, uri: string): string | null {
  return wallet.native
    ? `${wallet.native}wc?uri=${encodeURIComponent(uri)}`
    : null;
}

/**
 * The name this app gives a connected wallet.
 *
 * A connector reports whatever its package calls itself — "Coinbase Wallet"
 * for the smart-wallet connector that this app offers as Base Account. The
 * catalogue's name wins where the connector matches an entry; anything else
 * is shown under its own.
 */
export function walletLabel(
  connector?: Candidate | undefined,
): string | undefined {
  if (!connector) return undefined;
  const listed = OFFERED.find(
    (wallet) =>
      wallet.rdns.includes(connector.id) ||
      wallet.connectorId === connector.id ||
      wallet.aliases?.includes(connector.id),
  );
  return listed?.name ?? connector.name;
}
