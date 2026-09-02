"use client";

import { CHAINS } from "@0xslots/contracts";
import { ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { usePublicClient, useReadContracts } from "wagmi";
import { CopyAddress } from "@/components/copy-address";
import { PageHeader } from "@/components/page-header";
import { useChain } from "@/context/chain";
import { CONTRACTS_PAGE_ENABLED } from "@/lib/features";
import { BEACON_IMPLEMENTATIONS, beaconAbi, CONTRACTS } from "./registry";

/**
 * Every deployed contract on the selected chain: address, version, and who can
 * upgrade it.
 *
 * The question this answers is an operator's, not a visitor's — "which code is
 * behind this proxy right now, and who holds the key". During an incident that
 * is the first thing you want and the slowest thing to assemble by hand, which
 * is why it is one page rather than five block-explorer tabs.
 *
 * Everything here is read live from the chain. The address comes from the
 * package, but the version and the admin come from the contract, because a
 * committed address book records what was DEPLOYED and this page has to show
 * what is TRUE — those diverge exactly when it matters.
 */
/** EIP-1967: `keccak256("eip1967.proxy.implementation") - 1`. */
const ERC1967_IMPL =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc" as const;

export default function ContractsPage() {
  // Local-only. A disabled feature has no route, not a hidden one.
  if (!CONTRACTS_PAGE_ENABLED) notFound();

  const { chainId } = useChain();
  const chain = CHAINS.find((c) => c.id === chainId);

  const present = useMemo(
    () =>
      CONTRACTS.map((c) => ({ entry: c, address: c.address(chainId) })).filter(
        (
          c,
        ): c is { entry: (typeof CONTRACTS)[number]; address: `0x${string}` } =>
          Boolean(c.address),
      ),
    [chainId],
  );

  // One multicall for the whole page. Reading these one at a time would let
  // the rows straddle a block, which is precisely the inconsistency the page
  // exists to rule out.
  const calls = present.flatMap(({ entry, address }) => [
    ...(entry.hasVersion
      ? [{ address, abi: entry.abi, functionName: "version", chainId } as const]
      : []),
    ...(entry.adminFn
      ? [
          {
            address,
            abi: entry.abi,
            functionName: entry.adminFn,
            chainId,
          } as const,
        ]
      : []),
    ...(entry.ownsBeacon
      ? [{ address, abi: entry.abi, functionName: "beacon", chainId } as const]
      : []),
  ]);

  const { data, isLoading } = useReadContracts({
    contracts: calls,
    query: { enabled: calls.length > 0 },
  });

  // Walk the flat result back into rows, in the same order it was built.
  let cursor = 0;
  const rows = present.map(({ entry, address }) => {
    const take = () => (data ? data[cursor++] : undefined);
    const version = entry.hasVersion ? take() : undefined;
    const admin = entry.adminFn ? take() : undefined;
    const beacon = entry.ownsBeacon ? take() : undefined;
    return { entry, address, version, admin, beacon };
  });

  /**
   * The beacon rows, resolved in two more passes.
   *
   * Dependent reads: the beacon's address is the answer to the first call, and
   * the implementation's is the answer to the second. Three rounds for two rows
   * is more round-trips than a page usually deserves, but each address here is
   * asked of the chain rather than read from the package — which is the point.
   * The factory cannot disagree with its own beacon (`implementation()` there
   * is a forward, and the factory holds no copy), so there is nothing to
   * reconcile; there is only the question of what is actually deployed.
   */
  const beaconsOf = new Map(
    rows.flatMap((r) =>
      r.beacon?.status === "success"
        ? [[r.entry.name, r.beacon.result as `0x${string}`] as const]
        : [],
    ),
  );

  const withBeacon = BEACON_IMPLEMENTATIONS.map((b) => ({
    spec: b,
    beacon: beaconsOf.get(b.owner),
    owner: present.find((p) => p.entry.name === b.owner)?.address,
  })).filter(
    (
      b,
    ): b is {
      spec: (typeof BEACON_IMPLEMENTATIONS)[number];
      beacon: `0x${string}`;
      owner: `0x${string}`;
    } => Boolean(b.beacon && b.owner),
  );

  const { data: served } = useReadContracts({
    contracts: withBeacon.map(({ beacon }) => ({
      address: beacon,
      abi: beaconAbi,
      functionName: "implementation",
      chainId,
    })),
    query: { enabled: withBeacon.length > 0 },
  });

  const implementations = withBeacon.map((b, i) => ({
    ...b,
    address:
      served?.[i]?.status === "success"
        ? (served[i].result as `0x${string}`)
        : undefined,
  }));

  const { data: implVersions } = useReadContracts({
    contracts: implementations.flatMap(({ spec, address }) =>
      address
        ? [
            {
              address,
              abi: spec.abi,
              functionName: "version",
              chainId,
            } as const,
          ]
        : [],
    ),
    query: { enabled: implementations.some((i) => i.address) },
  });

  let vCursor = 0;
  const beaconRows = implementations.map((i) => ({
    ...i,
    version: i.address ? implVersions?.[vCursor++] : undefined,
  }));

  /**
   * What each UUPS proxy is currently delegating to.
   *
   * A storage read, not a call: the implementation lives in the ERC-1967 slot
   * and the proxies expose no getter for it. `SlotFactory.implementation()`
   * looks like one and is not — it forwards the BEACON's implementation, which
   * is a different contract entirely, and reading it here would put the wrong
   * address beside the wrong proxy.
   *
   * Three `eth_getStorageAt` rather than one multicall, because storage reads do
   * not batch. Acceptable on a page that exists for incidents.
   */
  const publicClient = usePublicClient({ chainId });
  const upgradeable = present.filter(({ entry }) => entry.upgradeable);

  const { data: proxyImpls } = useQuery({
    queryKey: [
      "contracts",
      "impl",
      chainId,
      upgradeable.map((u) => u.address).join(","),
    ],
    enabled: Boolean(publicClient) && upgradeable.length > 0,
    queryFn: async () => {
      const out = new Map<string, `0x${string}`>();
      await Promise.all(
        upgradeable.map(async ({ entry, address }) => {
          const raw = await publicClient!.getStorageAt({
            address,
            slot: ERC1967_IMPL,
          });
          if (!raw) return;
          const impl = `0x${raw.slice(-40)}` as `0x${string}`;
          if (!/^0x0+$/.test(impl)) out.set(entry.name, impl);
        }),
      );
      return out;
    },
  });

  const explorer = chain?.blockExplorers?.default.url;

  return (
    <div className="">
      <PageHeader>
        <div>
          <h1 className="text-xl font-semibold">Contracts</h1>
          <p className="text-muted-foreground text-sm mt-1">
            What is deployed on {chain?.name ?? `chain ${chainId}`}, read live
            from the chain.
          </p>
        </div>
      </PageHeader>
      <div className="w-full px-3 md:px-5 py-3 space-y-3">
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b text-left">
              <tr>
                <th className="px-4 py-2.5 font-medium">Contract</th>
                <th className="px-4 py-2.5 font-medium">Address</th>
                <th className="px-4 py-2.5 font-medium">Version</th>
                <th className="px-4 py-2.5 font-medium">Upgrade authority</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ entry, address, version, admin }) => (
                <tr
                  key={entry.name}
                  className="border-b last:border-0 align-top"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{entry.name}</div>
                    <div className="text-muted-foreground text-xs mt-0.5">
                      {entry.role}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <AddressPair
                      explorer={explorer}
                      rows={
                        entry.upgradeable
                          ? [
                              { label: "proxy", address },
                              {
                                label: "impl",
                                address: proxyImpls?.get(entry.name),
                              },
                            ]
                          : // Not a proxy: one address, and labelling it would
                            // imply a second that does not exist.
                            [{ label: null, address }]
                      }
                    />
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {!entry.hasVersion ? (
                      // Not "0". A stateless contract is replaced rather than
                      // upgraded, so it has no version to be behind on.
                      <span className="text-muted-foreground">—</span>
                    ) : isLoading ? (
                      <span className="text-muted-foreground">…</span>
                    ) : version?.status === "success" ? (
                      String(version.result)
                    ) : (
                      <span className="text-destructive">unreadable</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {!entry.upgradeable ? (
                      <span className="text-muted-foreground">
                        not upgradeable
                      </span>
                    ) : isLoading ? (
                      <span className="text-muted-foreground">…</span>
                    ) : admin?.status === "success" ? (
                      <CopyAddress address={admin.result as `0x${string}`} />
                    ) : (
                      <span className="text-destructive">unreadable</span>
                    )}
                  </td>
                </tr>
              ))}

              {/* Behind a beacon, so they are the code every proxy of their kind
                runs — the largest blast radius here. Their address is asked of
                the chain through the factory's beacon, never read from the
                package, because that is the address the proxies resolve. */}
              {beaconRows.map(({ spec, address, version, beacon, owner }) => (
                <tr
                  key={spec.name}
                  className="border-b last:border-0 align-top"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{spec.name}</div>
                    <div className="text-muted-foreground text-xs mt-0.5">
                      {spec.role}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {/* "beacon" where the others say "proxy": there is no single
                      proxy here. Hundreds delegate through this one beacon, and
                      it is the address they all resolve. */}
                    <AddressPair
                      explorer={explorer}
                      rows={[
                        { label: "beacon", address: beacon },
                        { label: "impl", address },
                      ]}
                    />
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {version?.status === "success" ? (
                      String(version.result)
                    ) : address ? (
                      <span className="text-muted-foreground">…</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {/* The factory, and only the factory: it owns the beacon, so
                      `upgradeBeacon` is the one way this address changes. */}
                    <CopyAddress address={owner} />
                    <div className="text-muted-foreground/70 text-xs mt-0.5">
                      via {spec.owner}.upgradeBeacon
                    </div>
                  </td>
                </tr>
              ))}

              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    Nothing deployed on {chain?.name ?? `chain ${chainId}`}.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <p className="text-muted-foreground text-xs">
          Addresses come from <code>@0xslots/contracts</code>; version and
          upgrade authority are read from the contracts themselves. They
          disagree when a deployment did not land — which is the point of
          showing both.
        </p>
      </div>
    </div>
  );
}

/**
 * One or two addresses for a row, labelled.
 *
 * Two, because "the address" of an upgradeable contract is ambiguous in exactly
 * the way that matters during an incident: the proxy is what everything holds
 * and what does not change, the implementation is what the code actually is and
 * what an upgrade moves. Showing one without the other makes you go and look up
 * the missing half at the worst possible moment.
 */
function AddressPair({
  rows,
  explorer,
}: {
  rows: { label: string | null; address: `0x${string}` | undefined }[];
  explorer: string | undefined;
}) {
  return (
    <div className="space-y-0.5">
      {rows.map(({ label, address }, i) => (
        <div
          key={label ?? i}
          className="flex items-center gap-1.5 whitespace-nowrap"
        >
          {label ? (
            <span className="text-muted-foreground/60 text-xs w-11 shrink-0">
              {label}
            </span>
          ) : null}
          {address ? (
            <>
              <CopyAddress address={address} />
              {explorer ? (
                <a
                  href={`${explorer}/address/${address}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="size-3" />
                </a>
              ) : null}
            </>
          ) : (
            <span className="text-muted-foreground">…</span>
          )}
        </div>
      ))}
    </div>
  );
}
