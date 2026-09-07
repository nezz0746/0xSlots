"use client";

import { CHAINS, type KnownHook, knownHooks } from "@0xslots/contracts";
import { ExternalLink, Plug } from "lucide-react";
import Image from "next/image";
import type { Address } from "viem";
import { CopyAddress } from "@/components/copy-address";
import { HookFlagRow } from "@/components/hook-flags";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { useChain } from "@/context/chain";
import { NavLink } from "@/context/navigation";
import { useHooks } from "@/hooks/use-explorer";
import { useHookCheck } from "@/hooks/use-hook-check";
import {
  describeSeconds,
  type HookFamilySpec,
  useHookDataCheck,
  useHookSchema,
  ZERO_WORD,
} from "@/hooks/use-hook-schema";

/**
 * The hooks this client can name, and what each of them asks for.
 *
 * ── Why this is not the module gallery ──────────────────────────────────────
 *
 * The retired protocol had one, and it was removed on purpose: a slot had many
 * modules, so browsing them was browsing a slot's contents, and the hook a slot
 * points at is a column on the slots table instead. That reasoning still holds
 * and this page does not undo it. It answers a different question, asked before
 * a slot exists rather than after — WHAT CAN I ATTACH, and what will it want
 * from me — which the slots table cannot answer at all, because it only lists
 * what somebody already chose.
 *
 * Everything on a card is read from the chain at the address, not from this
 * app: the callbacks from `subscriptions()`, the configuration from
 * `descriptors()`, and whether that configuration is optional from
 * `validateHookData` itself. The name and the sentence are the only editorial
 * content, and they are the only part that could ever be out of date.
 */
export default function HooksPage() {
  const { chainId } = useChain();
  const chain = CHAINS.find((c) => c.id === chainId);
  const named = knownHooks[chainId] ?? [];

  // Every hook any slot on this chain points at, whether or not this app can
  // name it. The two lists together are the honest picture: a catalogue alone
  // would imply these are the only ones, and a slot may point at any address.
  const { data: onChain } = useHooks();
  const namedSet = new Set(named.map((h) => h.address.toLowerCase()));
  const unnamed = (onChain ?? []).filter(
    (h) => !namedSet.has(h.id.toLowerCase()),
  );

  const usage = new Map(
    (onChain ?? []).map((h) => [h.id.toLowerCase(), h] as const),
  );

  return (
    <div>
      <PageHeader>
        <div>
          <h1 className="text-xl font-semibold">Hooks</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A slot has one extension point, fixed at creation unless its manager
            may move it. These are the ones this app can name on{" "}
            {chain?.name ?? `chain ${chainId}`}.
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <NavLink href="/app/create">Create a slot</NavLink>
        </Button>
      </PageHeader>

      <div className="w-full space-y-6 px-3 py-3 md:px-5">
        {named.length === 0 ? (
          <p className="border border-dashed p-6 text-center text-sm text-muted-foreground">
            None on {chain?.name ?? `chain ${chainId}`}. A slot here can still
            point at any hook by address.
          </p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {named.map((hook) => (
              <HookCard
                key={hook.address}
                hook={hook}
                chainId={chainId}
                explorer={chain?.blockExplorers?.default.url}
                slotCount={usage.get(hook.address.toLowerCase())?.slotCount}
                failedCalls={
                  usage.get(hook.address.toLowerCase())?.failedCallCount
                }
              />
            ))}
          </div>
        )}

        {unnamed.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-medium">
              Also in use on {chain?.name ?? `chain ${chainId}`}
            </h2>
            <p className="text-xs text-muted-foreground">
              Hooks slots point at that this app does not ship a name for.
            </p>
            <div className="border">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50 text-left">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Address</th>
                    <th className="px-4 py-2.5 font-medium">Slots</th>
                    <th className="px-4 py-2.5 font-medium">Failed calls</th>
                  </tr>
                </thead>
                <tbody>
                  {unnamed.map((h) => (
                    <tr key={h.id} className="border-b last:border-0">
                      <td className="px-4 py-2.5">
                        <CopyAddress address={h.id} />
                      </td>
                      <td className="px-4 py-2.5 tabular-nums">
                        {h.slotCount}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums">
                        {h.failedCallCount > 0 ? (
                          <span className="text-amber-600 dark:text-amber-500">
                            {h.failedCallCount}
                          </span>
                        ) : (
                          h.failedCallCount
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function HookCard({
  hook,
  chainId,
  explorer,
  slotCount,
  failedCalls,
}: {
  hook: KnownHook;
  chainId: number;
  explorer?: string;
  slotCount?: number;
  failedCalls?: number;
}) {
  const check = useHookCheck(hook.address, chainId);
  const { families } = useHookSchema(hook.address);
  const configurable = families.filter((f) => f.fields.length > 0);

  return (
    <article className="flex flex-col gap-3 border p-4">
      <header className="space-y-1.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            {/* The project's own mark where it has one. A stock hook carries
                an app-relative path, so this app's logo stands for the hooks
                this app maintains. */}
            {hook.logo ? (
              <Image
                src={hook.logo}
                alt=""
                width={20}
                height={20}
                className="size-5 shrink-0 object-contain"
                unoptimized
              />
            ) : (
              <Plug className="size-4 shrink-0 text-muted-foreground" />
            )}
            <h2 className="font-medium">{hook.name}</h2>
            <span className="text-[10px] text-muted-foreground">
              {hook.url ? (
                <a
                  href={hook.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  {hook.by}
                </a>
              ) : (
                hook.by
              )}
            </span>
          </div>
          {explorer && (
            <a
              href={`${explorer}/address/${hook.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={`${hook.name} on the block explorer`}
            >
              <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>
        <p className="text-sm leading-snug text-muted-foreground">
          {hook.description}
        </p>
      </header>

      <CopyAddress address={hook.address} className="text-xs" />

      <div className="space-y-1.5">
        <h3 className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
          Callbacks
        </h3>
        {/* The same row the create form and the slot page draw, from the same
            `subscriptions()` call — so a hook looks identical here, while it is
            being attached, and after it is attached. */}
        <HookFlagRow flags={check.data?.flags} />
      </div>

      <div className="space-y-1.5">
        <h3 className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
          Configuration
        </h3>
        {configurable.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {families.length === 0
              ? "Publishes no schema. Attaches with an empty word."
              : "Takes no configuration."}
          </p>
        ) : (
          <div className="space-y-2">
            {configurable.map((family) => (
              <FamilyRow
                key={family.family}
                address={hook.address}
                family={family}
              />
            ))}
          </div>
        )}
      </div>

      {/* Absent rather than zero while the indexer has not answered: "0 slots"
          and "not asked yet" are different facts and only one of them is
          about the hook. */}
      {slotCount !== undefined && (
        <footer className="mt-auto flex items-center justify-between gap-3 border-t pt-3 text-xs text-muted-foreground">
          <span className="tabular-nums">
            {slotCount} {slotCount === 1 ? "slot" : "slots"}
            {failedCalls ? (
              <span className="ml-2 text-amber-600 dark:text-amber-500">
                {failedCalls} failed {failedCalls === 1 ? "call" : "calls"}
              </span>
            ) : null}
          </span>
          <NavLink
            href="/app/create"
            className="underline underline-offset-2 transition-colors hover:text-foreground"
          >
            Use it
          </NavLink>
        </footer>
      )}
    </article>
  );
}

/**
 * One configurable family, as the hook describes it.
 *
 * The signature gives the type, the bounds give the label, the unit and the
 * range, and `validateHookData` on the empty word gives the one thing neither
 * can express: whether a slot may attach this hook without configuring it.
 */
function FamilyRow({
  address,
  family,
}: {
  address: Address;
  family: HookFamilySpec;
}) {
  const zero = useHookDataCheck(address, ZERO_WORD, 0);

  return (
    <div className="border-l-2 border-muted pl-3 text-xs">
      {family.fields.map((field) => (
        <div key={field.name} className="flex items-baseline gap-2">
          <span className="font-medium capitalize">{field.name}</span>
          <span className="text-muted-foreground">
            {field.param.type}
            {field.unit ? `, ${field.unit}` : ""}
          </span>
          {field.bounded && (
            <span className="ml-auto text-muted-foreground">
              {field.unit === "seconds"
                ? `${describeSeconds(field.min)} – ${describeSeconds(field.max)}`
                : `${field.min.toString()} – ${field.max.toString()}`}
            </span>
          )}
        </div>
      ))}
      <p className="mt-0.5 text-[10px] text-muted-foreground">
        {zero.checking
          ? "Asking the hook…"
          : zero.ok
            ? "Optional — a slot may attach this hook without it."
            : "Required — the slot refuses an attach without it."}
      </p>
    </div>
  );
}
