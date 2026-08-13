"use client";

import { Scale } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import {
  NOT_POLICIES,
  POLICIES,
  type PolicyEntry,
  STATUS_LABEL,
} from "@/lib/policy-catalogue";
import { cn } from "@/lib/utils";

/**
 * What a slot's terms can be.
 *
 * Cards rather than a table: each entry is a sentence, which a column either
 * squeezes into an unreadable ribbon or lets push the page sideways.
 *
 * The page is deliberately short on prose. A policy is one rule; the value here
 * is scanning eight of them quickly, not reading an essay about any one. The
 * mechanism lives in the docs.
 */
export default function PoliciesPage() {
  const live = POLICIES.filter((p) => p.status === "live");
  const planned = POLICIES.filter((p) => p.status === "planned");

  return (
    <div className="min-h-screen">
      <PageHeader>
        <div className="flex items-center gap-3">
          <Scale className="size-5 text-muted-foreground" />
          <div>
            <h1 className="text-xl font-bold leading-tight tracking-tight">
              Policies
            </h1>
            <p className="text-xs text-muted-foreground">
              Extra rules a slot can put on who may hold it
            </p>
          </div>
        </div>
        <div className="hidden shrink-0 items-center gap-3 text-xs text-muted-foreground md:flex">
          <span>
            <span className="font-medium text-foreground">{live.length}</span>{" "}
            live
          </span>
          <span>
            <span className="font-medium text-foreground">
              {planned.length}
            </span>{" "}
            planned
          </span>
        </div>
      </PageHeader>

      <div className="w-full space-y-7 px-3 py-5 md:px-5">
        {/* Two facts that change how everything below reads: a policy can only
            say no, and a slot only has room for one. */}
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          A policy is asked before every buy and every price change, and can
          only refuse — never move money, never end an occupancy. One per slot;
          no combinator ships yet.
        </p>

        <Group title="Live" rows={live} />
        <Group title="Planned" rows={planned} />
        <Group title="Not possible as a policy" rows={NOT_POLICIES} />
      </div>
    </div>
  );
}

function Group({ title, rows }: { title: string; rows: PolicyEntry[] }) {
  if (rows.length === 0) return null;

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {rows.map((p) => (
          <PolicyCard key={p.id} entry={p} />
        ))}
      </div>
    </section>
  );
}

function PolicyCard({ entry }: { entry: PolicyEntry }) {
  const Icon = entry.icon;

  return (
    <article className="flex flex-col border bg-background p-3">
      <header className="flex items-start gap-2.5">
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center",
            entry.tint,
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold leading-tight">
              {entry.name}
            </h3>
            <StatusBadge entry={entry} />
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {entry.summary}
          </p>
        </div>
      </header>

      {entry.blocker && (
        <p className="mt-2 border-l-2 border-amber-500/40 pl-2 text-xs leading-relaxed text-amber-700 dark:text-amber-500">
          {entry.blocker}
        </p>
      )}

      {/* `mt-auto` so footers line up across a row whatever the text length. */}
      {(entry.terms || entry.impact !== "n/a") && (
        <footer className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pt-3">
          {entry.terms ? (
            <code className="font-mono text-xs text-muted-foreground">
              {entry.terms}
            </code>
          ) : (
            <span />
          )}
          {entry.impact !== "n/a" && (
            <span className="text-xs text-muted-foreground">
              {entry.impact === "near-pure"
                ? "forced sale intact"
                : "forced sale delayed"}
            </span>
          )}
        </footer>
      )}
    </article>
  );
}

function StatusBadge({ entry }: { entry: PolicyEntry }) {
  const label = STATUS_LABEL[entry.status];

  if (entry.status === "live") {
    return (
      <Badge className="shrink-0 bg-emerald-600 text-[10px] hover:bg-emerald-600 dark:bg-emerald-500">
        {label}
      </Badge>
    );
  }
  if (entry.status === "planned") {
    return (
      <Badge variant="secondary" className="shrink-0 text-[10px]">
        {label}
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="shrink-0 text-[10px] text-muted-foreground"
    >
      {label}
    </Badge>
  );
}
