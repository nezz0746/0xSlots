"use client";

import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, Users } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback } from "react";
import { type Address, isAddress } from "viem";
import { useAccount } from "wagmi";
import { CollectiveRoleCard } from "@/components/collective-role-card";
import { CopyAddress } from "@/components/copy-address";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { NavLink } from "@/context/navigation";
import { useCollective, useCollectiveRoles } from "@/hooks/use-collectives";

/**
 * One collective, addressed by the URL.
 *
 * Replaces the inline drawer the list used to carry. A collective has more to
 * say than a table row can hold — five roles with their holders, the payout
 * split, and controls that mutate all of it — and a URL for it means a
 * governance page can be linked, bookmarked and shared, which a drawer's
 * transient open state never could.
 */
export default function CollectivePage() {
  const params = useParams<{ address: string }>();
  const address = params?.address;
  const { address: me } = useAccount();
  const queryClient = useQueryClient();

  const valid = !!address && isAddress(address);

  const {
    data: collective,
    isLoading,
    error,
  } = useCollective(valid ? address : undefined);

  // Always enabled here — roles are the reason this page exists, unlike the
  // list where they were fetched only on demand.
  const {
    data: roles,
    isLoading: rolesLoading,
    refetch,
  } = useCollectiveRoles(valid ? (address as Address) : undefined, valid);

  const handleChanged = useCallback(() => {
    void refetch();
    // The list's badges read from a different cache entry, so a role change
    // here has to reach it too — otherwise going back shows the old answer.
    void queryClient.invalidateQueries({ queryKey: ["my-collectives"] });
    void queryClient.invalidateQueries({ queryKey: ["collective"] });
  }, [refetch, queryClient]);

  // Derived from the same rows the cards render, so what the page offers and
  // what it shows cannot disagree. AccessControl is the real gate.
  const isAdmin =
    !!me &&
    (roles
      ?.find((g) => g.label === "DEFAULT_ADMIN")
      ?.members.some((m) => m.account.toLowerCase() === me.toLowerCase()) ??
      false);

  return (
    <div className="min-h-screen">
      <PageHeader>
        <div className="flex min-w-0 items-center gap-3">
          <NavLink
            href="/app/collectives"
            aria-label="Back to my collectives"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
          </NavLink>
          <Users className="size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <h1 className="text-xl font-bold leading-tight tracking-tight">
              Collective
            </h1>
            {valid && (
              <div className="text-muted-foreground">
                <CopyAddress address={address} truncate={false} ens />
              </div>
            )}
          </div>
        </div>
        {collective && (
          <div className="flex shrink-0 items-center gap-2">
            {collective.paused && (
              <Badge variant="outline" className="text-[10px]">
                Paused
              </Badge>
            )}
            <span className="text-[10px] text-muted-foreground">
              created{" "}
              {formatDistanceToNow(
                new Date(Number(collective.createdAt) * 1000),
                {
                  addSuffix: true,
                },
              )}
            </span>
          </div>
        )}
      </PageHeader>

      <div className="w-full space-y-4 px-3 py-4 md:px-5">
        {!valid && (
          <Notice title="Not an address">
            <span className="break-all">{address}</span> is not a valid address.
          </Notice>
        )}

        {valid && isLoading && (
          <p className="text-xs text-muted-foreground">Loading…</p>
        )}

        {valid && error && (
          <Notice title="Could not reach the indexer">
            {error instanceof Error ? error.message : "Unknown error"}
          </Notice>
        )}

        {valid && !isLoading && !error && !collective && (
          <Notice title="Not indexed yet">
            No collective at this address on the current chain. If you just
            created it, the indexer may still be catching up — the transaction
            has to be mined and read before it appears here.
          </Notice>
        )}

        {collective && (
          <>
            {/* ── Roles ──────────────────────────────────────── */}
            <section>
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider">
                  Roles
                </h2>
                {isAdmin && (
                  <span className="text-[10px] text-muted-foreground">
                    You are an admin — you can grant and revoke any role
                  </span>
                )}
              </div>

              {rolesLoading ? (
                <p className="text-xs text-muted-foreground">Loading roles…</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {roles?.map((group) => (
                    <CollectiveRoleCard
                      key={group.label}
                      collective={collective.id}
                      group={group}
                      isAdmin={isAdmin}
                      onChanged={handleChanged}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* ── Payouts ────────────────────────────────────── */}
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider">
                Payouts
              </h2>
              <div className="border">
                <div className="border-b px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">
                    Tax collected from this collective&apos;s slots pools here
                    and fans out over these shares when someone calls
                    distribute.
                  </p>
                </div>
                {collective.recipients.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-muted-foreground">
                    No payees indexed.
                  </p>
                ) : (
                  <div className="divide-y">
                    {collective.recipients.map((r) => (
                      <div
                        key={`${r.index}-${r.account}`}
                        className="flex items-center justify-between gap-3 px-3 py-2"
                      >
                        <CopyAddress address={r.account} ens />
                        <div className="flex items-center gap-3">
                          <span className="tabular-nums text-[10px] text-muted-foreground">
                            {r.allocation}
                          </span>
                          <span className="w-12 text-right tabular-nums text-xs font-medium">
                            {(r.shareBps / 100).toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* ── Provenance ─────────────────────────────────── */}
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider">
                Provenance
              </h2>
              <dl className="grid gap-2 border p-3 sm:grid-cols-2">
                <Fact label="Deployed by">
                  <CopyAddress address={collective.deployer} ens />
                </Fact>
                <Fact
                  label="Founding admin"
                  hint="At deployment. Roles move afterwards — the live answer is above."
                >
                  <CopyAddress address={collective.admin} ens />
                </Fact>
              </dl>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function Notice({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border p-4 text-xs">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-muted-foreground">{children}</p>
    </div>
  );
}

function Fact({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5">{children}</dd>
      {hint && (
        <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
