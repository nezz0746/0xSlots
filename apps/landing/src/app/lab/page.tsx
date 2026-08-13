"use client";

import { Clock, FlaskConical, RotateCcw, Wallet } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { BuyWidget } from "@/components/lab/buy-widget";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  DAY,
  duration,
  money,
  SITUATIONS,
  type Situation,
  SLOT_TERMS,
  WALLET_BALANCE,
} from "@/lib/lab-slot";
import { cn } from "@/lib/utils";

/**
 * The lab: one slot, five situations, nothing real.
 *
 * A sandbox rather than a page of the product. The widget in the middle is the
 * thing being designed; everything around it is a rig for putting it into the
 * states that matter — and the states that matter are not a settings matrix but
 * five moments in one story, from an empty slot to an occupant who has run out.
 *
 * The clock is a control here because the mechanism is a clock. Advancing time
 * and watching the runway shorten is the fastest way to understand what holding
 * a slot costs, and no amount of explanatory copy substitutes for it.
 */

/** A fixed epoch, so the page renders identically on server and client. */
const T0 = Date.UTC(2026, 7, 13, 12, 0, 0);

export default function LabPage() {
  const [situationId, setSituationId] = useState(SITUATIONS[1].id);
  const [elapsed, setElapsed] = useState(0);
  const [log, setLog] = useState<{ id: number; text: string }[]>([]);
  const nextLogId = useRef(0);

  const base = SITUATIONS.find((s) => s.id === situationId) ?? SITUATIONS[0];

  // Advancing the clock drains the occupant's funding, exactly as the chain
  // would. This is the only place the lab mutates the scenario, and it is the
  // whole reason the clock is exposed.
  const situation: Situation = {
    ...base,
    heldForSeconds: base.heldForSeconds + elapsed,
    deposit: base.occupied
      ? Math.max(
          0,
          base.deposit -
            (base.price * SLOT_TERMS.taxBps * elapsed) /
              (10_000 * 30 * 24 * 3600),
        )
      : 0,
  };

  const onAct = useCallback((message: string) => {
    nextLogId.current += 1;
    setLog((l) => [{ id: nextLogId.current, text: message }, ...l].slice(0, 4));
  }, []);

  const reset = () => {
    setElapsed(0);
    setLog([]);
  };

  return (
    <div className="min-h-screen">
      <PageHeader>
        <div className="flex items-center gap-3">
          <FlaskConical className="size-5 text-muted-foreground" />
          <div>
            <h1 className="text-xl font-bold leading-tight tracking-tight">
              Lab
            </h1>
            <p className="text-xs text-muted-foreground">
              The purchase widget, with invented data
            </p>
          </div>
        </div>
        <span className="hidden shrink-0 items-center gap-1.5 text-xs text-muted-foreground md:flex">
          <Wallet className="size-3.5" />
          <span className="tabular-nums">{money(WALLET_BALANCE)}</span>
          <span className="opacity-60">pretend balance</span>
        </span>
      </PageHeader>

      <div className="w-full px-3 py-5 md:px-5">
        {/* ── The rig ─────────────────────────────────────────── */}
        <div className="mb-5 border border-dashed">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-dashed px-3 py-2">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Scenario
            </span>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-[11px] tabular-nums text-muted-foreground">
                <Clock className="size-3" />
                {elapsed === 0 ? "now" : `+${duration(elapsed)}`}
              </span>
              {[1, 7, 30].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setElapsed((e) => e + d * DAY)}
                  className="border px-2 py-0.5 text-[11px] tabular-nums transition-colors hover:bg-muted"
                >
                  +{d}d
                </button>
              ))}
              <button
                type="button"
                onClick={reset}
                aria-label="Reset the scenario"
                className="flex items-center gap-1 border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <RotateCcw className="size-3" />
                Reset
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 p-3">
            {SITUATIONS.map((s) => {
              const active = s.id === situationId;
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setSituationId(s.id);
                    setElapsed(0);
                  }}
                  className={cn(
                    "border px-2.5 py-1.5 text-xs transition-colors",
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "hover:bg-muted",
                  )}
                >
                  {s.label}
                </button>
              );
            })}
          </div>

          <p className="border-t border-dashed px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            {situation.scene}
          </p>
        </div>

        {/* ── The subject and the widget ──────────────────────── */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]">
          <div className="min-w-0 space-y-5">
            <SlotCard />
            <Explainer />
            {log.length > 0 && <ActionLog log={log} />}
          </div>

          <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">
            <BuyWidget
              situation={situation}
              nowMs={T0 + elapsed * 1000}
              onAct={onAct}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** What is actually being bought. Without this the widget prices nothing. */
function SlotCard() {
  const { name, description, taxBps, minDepositSeconds, tenureSeconds } =
    SLOT_TERMS;

  return (
    <section className="border">
      <div className="border-b p-4 md:p-5">
        <h2 className="text-lg font-semibold tracking-tight">{name}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>

      {/* A placeholder for the thing itself. A slot is a place, and pricing a
          place without showing it is most of why this is hard to grasp. */}
      <div className="flex h-24 items-center justify-center border-b bg-muted/40">
        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          your banner here
        </span>
      </div>

      <dl className="grid grid-cols-1 divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Term
          label="Tax"
          value={`${taxBps / 100}%`}
          hint="of your price, monthly"
        />
        <Term
          label="Minimum funding"
          value={duration(minDepositSeconds)}
          hint="you must stay above this"
        />
        <Term
          label="Safe period"
          value={duration(tenureSeconds)}
          hint="nobody can take it"
        />
      </dl>
    </section>
  );
}

function Term({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="p-3">
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-base font-semibold tabular-nums">{value}</dd>
      <p className="text-[10px] text-muted-foreground">{hint}</p>
    </div>
  );
}

/**
 * The rules, as three sentences.
 *
 * Placed after the slot rather than before it: nobody reads mechanism copy
 * until they know what is on offer.
 */
function Explainer() {
  return (
    <section className="border p-4 md:p-5">
      <h3 className="text-sm font-semibold">How holding it works</h3>
      <ol className="mt-3 space-y-2.5">
        {[
          [
            "You set the price",
            "Whatever you would accept to hand it over. Nobody negotiates it.",
          ],
          [
            "You pay tax on that price",
            "Drawn continuously from funding you put up. Name a higher price, pay more.",
          ],
          [
            "Anyone can take it at your price",
            "That is the trade: the number that keeps your costs down is the number that loses it.",
          ],
        ].map(([title, body], i) => (
          <li key={title} className="flex gap-3">
            <span className="mt-0.5 font-mono text-[11px] text-muted-foreground">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-snug">{title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {body}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ActionLog({ log }: { log: { id: number; text: string }[] }) {
  return (
    <section className="border border-dashed p-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
        Would have happened
      </p>
      <ul className="mt-2 space-y-1">
        {log.map((l, i) => (
          <li
            key={l.id}
            className={cn(
              "text-xs tabular-nums",
              i === 0 ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {l.text}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground">
        Nothing was signed. No wallet, no chain, no transaction.
      </p>
    </section>
  );
}

export { Button };
