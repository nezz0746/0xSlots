"use client";

import { slotCollectiveFactoryAbi } from "@0xslots/contracts";
import { Plus, Trash2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { type Address, isAddress } from "viem";
import {
  useAccount,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import {
  CollectiveUnavailable,
  useCollectiveFactory,
} from "@/components/collective-unavailable";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NavLink } from "@/context/navigation";
import { cn } from "@/lib/utils";

/**
 * Create a SlotCollective.
 *
 * A collective is the one address that can be BOTH of a slot's named addresses:
 * `recipient` (tax flows to it) and `manager` (it may propose tax / utility /
 * policy changes). This form sets the two halves that decision implies —
 * who gets paid, and who may govern — because they are separate powers and the
 * contract keeps them separate.
 *
 * Everything here is a constructor argument. There is no edit-later step in this
 * form: shares and roles CAN be changed afterwards, but only by the roles that
 * govern them, which is the point.
 */

/** A payout row. Allocations are relative — the contract sums them itself. */
interface Payee {
  address: string;
  shares: string;
}

/** The four manager roles, plus the admin that administers them. */
const ROLE_FIELDS = [
  {
    key: "taxManagers",
    label: "Tax",
    hint: "May change the tax rate and the liquidation bounty.",
  },
  {
    key: "policyManagers",
    label: "Policy",
    hint: "May change who is allowed to hold the slot.",
  },
  {
    key: "utilityManagers",
    label: "Utility",
    hint: "May change what holding the slot grants.",
  },
  {
    key: "splitManagers",
    label: "Split",
    hint: "May rewrite the payouts below, and pause distribution.",
  },
] as const;

type RoleKey = (typeof ROLE_FIELDS)[number]["key"];

export default function CreateCollectivePage() {
  const { address: connected } = useAccount();
  const factory = useCollectiveFactory();

  const [payees, setPayees] = useState<Payee[]>([
    { address: "", shares: "50" },
    { address: "", shares: "50" },
  ]);
  const [admin, setAdmin] = useState("");
  const [roles, setRoles] = useState<Record<RoleKey, string>>({
    taxManagers: "",
    policyManagers: "",
    utilityManagers: "",
    splitManagers: "",
  });

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const totalShares = useMemo(
    () => payees.reduce((sum, p) => sum + (Number(p.shares) || 0), 0),
    [payees],
  );

  /** Patch one row by position, leaving the rest untouched. */
  const updatePayee = (i: number, patch: Partial<Payee>) =>
    setPayees((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const validPayees = payees.filter(
    (p) => isAddress(p.address) && Number(p.shares) > 0,
  );

  const adminAddress = admin.trim() === "" ? connected : (admin as Address);
  const adminValid = !!adminAddress && isAddress(adminAddress);

  // Every role list is optional — a collective with only an admin is valid, and
  // the admin can run all four relays itself (`onlyRoleOrAdmin`).
  const parseRole = (raw: string): Address[] =>
    raw
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s): s is Address => isAddress(s));

  const roleErrors = ROLE_FIELDS.filter(({ key }) => {
    const raw = roles[key].trim();
    if (!raw) return false;
    const entries = raw.split(/[\s,]+/).filter(Boolean);
    return entries.some((e) => !isAddress(e));
  });

  const canSubmit =
    !!factory &&
    adminValid &&
    validPayees.length > 0 &&
    validPayees.length === payees.length &&
    totalShares > 0 &&
    roleErrors.length === 0 &&
    !isPending &&
    !isConfirming;

  function submit() {
    if (!factory || !adminValid) return;

    writeContract(
      {
        address: factory,
        abi: slotCollectiveFactoryAbi,
        functionName: "createManager",
        args: [
          {
            recipients: validPayees.map((p) => p.address as Address),
            allocations: validPayees.map((p) => BigInt(p.shares)),
            // The contract validates that this equals the sum, so it is derived
            // rather than asked for — a field the user could get wrong for no
            // benefit.
            totalAllocation: BigInt(totalShares),
            // Distribution incentive: the cut a third-party keeper earns for
            // calling `distribute`. Zero means only members bother, which is
            // the right default for a collective that sweeps its own slots.
            distributionIncentive: 0,
          },
          {
            admin: adminAddress as Address,
            taxManagers: parseRole(roles.taxManagers),
            policyManagers: parseRole(roles.policyManagers),
            utilityManagers: parseRole(roles.utilityManagers),
            splitManagers: parseRole(roles.splitManagers),
          },
        ],
      },
      {
        onSuccess: () => toast.success("Collective submitted"),
        onError: (e) => toast.error(e.message.split("\n")[0] ?? "Failed"),
      },
    );
  }

  // ── Not deployed on this chain ────────────────────────────────
  if (!factory) {
    return (
      <div className="min-h-screen">
        <PageHeader>
          <div>
            <h1 className="text-xl font-bold tracking-tight leading-tight">
              Create Collective
            </h1>
          </div>
        </PageHeader>
        <div className="w-full px-3 md:px-5 py-8">
          <CollectiveUnavailable />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <PageHeader>
        <div className="flex items-center gap-3">
          <Users className="size-5 text-muted-foreground" />
          <div>
            <h1 className="text-xl font-bold tracking-tight leading-tight">
              Create Collective
            </h1>
            <p className="text-muted-foreground text-xs">
              One address that receives a slot&apos;s tax and governs it
            </p>
          </div>
        </div>
      </PageHeader>

      <div className="w-full px-3 md:px-5 py-4 pb-24">
        <div className="flex flex-col lg:flex-row gap-4 items-start">
          {/* ── Payouts ──────────────────────────────────────── */}
          <section className="flex-1 min-w-0 border w-full">
            <header className="border-b px-3 py-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider">
                Who gets paid
              </h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Tax collected from slots pools here and fans out over these
                shares. Shares are relative — they need not total 100.
              </p>
            </header>

            <div className="p-3 space-y-2">
              {payees.map((p, i) => {
                const bad = p.address !== "" && !isAddress(p.address);
                const pct =
                  totalShares > 0
                    ? ((Number(p.shares) || 0) / totalShares) * 100
                    : 0;
                return (
                  // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      placeholder="0x…"
                      value={p.address}
                      onChange={(e) =>
                        updatePayee(i, { address: e.target.value })
                      }
                      className={cn("text-xs flex-1", bad && "border-red-500")}
                    />
                    <Input
                      inputMode="decimal"
                      value={p.shares}
                      onChange={(e) =>
                        updatePayee(i, { shares: e.target.value })
                      }
                      className="text-xs w-20"
                    />
                    <span className="w-12 shrink-0 text-right tabular-nums text-[10px] text-muted-foreground">
                      {pct.toFixed(1)}%
                    </span>
                    <button
                      type="button"
                      aria-label="Remove payee"
                      disabled={payees.length <= 1}
                      onClick={() =>
                        setPayees(payees.filter((_, j) => j !== i))
                      }
                      className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                );
              })}

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() =>
                  setPayees([...payees, { address: "", shares: "0" }])
                }
              >
                <Plus className="size-3.5" />
                Add payee
              </Button>
            </div>
          </section>

          {/* ── Governance ───────────────────────────────────── */}
          <section className="flex-1 min-w-0 border w-full">
            <header className="border-b px-3 py-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider">
                Who governs
              </h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Each dimension is its own role, so changing what a slot costs
                and changing who may hold it are separate powers. Leave a role
                empty and only the admin can use it.
              </p>
            </header>

            <div className="p-3 space-y-3">
              <div>
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Admin
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    can do everything
                  </span>
                </div>
                <Input
                  placeholder={connected ?? "0x…"}
                  value={admin}
                  onChange={(e) => setAdmin(e.target.value)}
                  className={cn(
                    "text-xs",
                    admin !== "" && !isAddress(admin) && "border-red-500",
                  )}
                />
                {admin === "" && connected && (
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    Defaults to your connected wallet.
                  </p>
                )}
              </div>

              {ROLE_FIELDS.map(({ key, label, hint }) => (
                <div key={key}>
                  <div className="mb-1 flex items-baseline justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {label} managers
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      optional
                    </span>
                  </div>
                  <Input
                    placeholder="0x… , 0x…"
                    value={roles[key]}
                    onChange={(e) =>
                      setRoles({ ...roles, [key]: e.target.value })
                    }
                    className="text-xs"
                  />
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {hint}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ── Submit ─────────────────────────────────────────── */}
        <div className="mt-4 flex flex-col gap-2">
          {roleErrors.length > 0 && (
            <p className="text-[11px] text-red-600 dark:text-red-500">
              Invalid address in {roleErrors.map((r) => r.label).join(", ")}.
            </p>
          )}
          {error && (
            <p className="text-[11px] text-red-600 dark:text-red-500">
              {error.message.split("\n")[0]}
            </p>
          )}
          {isSuccess && (
            <p className="text-[11px] text-emerald-600 dark:text-emerald-500">
              Collective created.{" "}
              <NavLink href="/collectives" className="underline">
                See it in My Collectives
              </NavLink>
            </p>
          )}

          <Button
            className="w-full md:w-auto md:self-start"
            disabled={!canSubmit}
            onClick={submit}
          >
            {isPending
              ? "Confirm in wallet…"
              : isConfirming
                ? "Creating…"
                : "Create collective"}
          </Button>
        </div>
      </div>
    </div>
  );
}
