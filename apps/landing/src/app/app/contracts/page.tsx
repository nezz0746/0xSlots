"use client";

import { CHAINS } from "@0xslots/contracts";
import { ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import { useMemo } from "react";
import { useReadContracts } from "wagmi";
import { CopyAddress } from "@/components/copy-address";
import { PageHeader } from "@/components/page-header";
import { useChain } from "@/context/chain";
import { CONTRACTS_PAGE_ENABLED } from "@/lib/features";
import { beaconAbi, CONTRACTS } from "./registry";

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
export default function ContractsPage() {
  // Local-only. A disabled feature has no route, not a hidden one.
  if (!CONTRACTS_PAGE_ENABLED) notFound();

  const { chainId } = useChain();
  const chain = CHAINS.find((c) => c.id === chainId);

  const present = useMemo(
    () =>
      CONTRACTS.map((c) => ({ entry: c, address: c.address(chainId) })).filter(
        (c): c is { entry: (typeof CONTRACTS)[number]; address: `0x${string}` } =>
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
      ? [{ address, abi: entry.abi, functionName: entry.adminFn, chainId } as const]
      : []),
    ...(entry.implFn
      ? [{ address, abi: entry.abi, functionName: entry.implFn, chainId } as const]
      : []),
    ...(entry.beacon
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
    const impl = entry.implFn ? take() : undefined;
    const beacon = entry.beacon ? take() : undefined;
    return { entry, address, version, admin, impl, beacon };
  });

  /**
   * What each beacon is actually serving.
   *
   * A second round, because the address to ask is the answer to the first one.
   * Reading it through the factory would have kept it to a single pass, but only
   * `SlotFactory` forwards `implementation()` — and the point of the check is to
   * ask the contract the proxies resolve through, not a convenience getter that
   * might be forwarding something else.
   */
  const beacons = rows.flatMap((r) =>
    r.beacon?.status === "success"
      ? [{ name: r.entry.name, address: r.beacon.result as `0x${string}` }]
      : [],
  );

  const { data: served } = useReadContracts({
    contracts: beacons.map(({ address }) => ({
      address,
      abi: beaconAbi,
      functionName: "implementation",
      chainId,
    })),
    query: { enabled: beacons.length > 0 },
  });

  const servedBy = new Map(
    beacons.map(({ name }, i) => [
      name,
      served?.[i]?.status === "success"
        ? (served[i].result as `0x${string}`)
        : undefined,
    ]),
  );

  const explorer = chain?.blockExplorers?.default.url;

  return (
    <div className="space-y-6">
      <PageHeader>
        <div>
          <h1 className="text-xl font-semibold">Contracts</h1>
          <p className="text-muted-foreground text-sm mt-1">
            What is deployed on {chain?.name ?? `chain ${chainId}`}, read live
            from the chain.
          </p>
        </div>
      </PageHeader>

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
            {rows.map(({ entry, address, version, admin, impl, beacon }) => (
              <tr key={entry.name} className="border-b last:border-0 align-top">
                <td className="px-4 py-3">
                  <div className="font-medium">{entry.name}</div>
                  <div className="text-muted-foreground text-xs mt-0.5">
                    {entry.role}
                  </div>
                  {impl?.status === "success" ? (
                    <div className="text-muted-foreground/70 text-xs mt-1">
                      implementation{" "}
                      <CopyAddress address={impl.result as `0x${string}`} />
                    </div>
                  ) : null}
                  {entry.beacon && beacon?.status === "success" ? (
                    <BeaconLine
                      serves={entry.beacon.serves}
                      beacon={beacon.result as `0x${string}`}
                      running={servedBy.get(entry.name)}
                      expected={entry.beacon.expected(chainId)}
                    />
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
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
                  </div>
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
        Addresses come from <code>@0xslots/contracts</code>; version and upgrade
        authority are read from the contracts themselves. They disagree when a
        deployment did not land — which is the point of showing both.
      </p>
    </div>
  );
}


/**
 * A factory's beacon, and whether it is serving the implementation the package
 * says it should be.
 *
 * The two really do drift. Deploying an implementation and pointing a beacon at
 * it are separate transactions, and for a while the deploy script did only the
 * first — so a record could name a version that no slot was running. That is
 * invisible from every other view in this app, because a slot behaves normally
 * while running whatever code the beacon last pointed at.
 *
 * "expected" is the address the SDK carries for this chain, which is what the
 * app and the indexer are written against. A mismatch is not necessarily an
 * emergency — someone may be mid-upgrade — but nobody should have to diff two
 * addresses by eye to find out.
 */
function BeaconLine({
  serves,
  beacon,
  running,
  expected,
}: {
  serves: string;
  beacon: `0x${string}`;
  running: `0x${string}` | undefined;
  expected: `0x${string}` | undefined;
}) {
  const synced =
    running && expected
      ? running.toLowerCase() === expected.toLowerCase()
      : undefined;

  return (
    <div className="text-muted-foreground/70 text-xs mt-1 space-y-0.5">
      <div>
        beacon <CopyAddress address={beacon} />{" "}
        <span className="text-muted-foreground/50">· {serves}</span>
      </div>
      {running ? (
        <div className="flex items-center gap-1.5">
          <span>serving</span>
          <CopyAddress address={running} />
          {synced === true ? (
            <span className="text-emerald-600 dark:text-emerald-500">
              in sync
            </span>
          ) : synced === false ? (
            <span className="font-medium text-amber-600 dark:text-amber-500">
              stale — expected <CopyAddress address={expected as `0x${string}`} />
            </span>
          ) : (
            <span className="text-muted-foreground/50">
              nothing recorded to compare
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}
