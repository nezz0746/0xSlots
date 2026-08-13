"use client";

import {
  ArrowDown,
  ArrowUp,
  Check,
  Loader2,
  Plus,
  ShieldCheck,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { RunwayAxis } from "@/components/lab/runway-axis";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  burnPerMonth,
  costToTake,
  DAY,
  duration,
  HEALTH_TONE,
  healthOf,
  minDepositFor,
  money,
  runwaySeconds,
  type Situation,
  SLOT_TERMS,
  WALLET_BALANCE,
} from "@/lib/lab-slot";
import { cn } from "@/lib/utils";

/** Funding presets, in days. Buying time is what a deposit actually does. */
const FUNDING_DAYS = [7, 30, 90] as const;
/** Price nudges. Compounding, so repeated taps behave like a market moving. */
const PRICE_STEPS = [-25, -10, 10, 25] as const;

type Pending = null | "take" | "fund" | "reprice" | "leave";

export function BuyWidget({
  situation,
  nowMs,
  onAct,
}: {
  situation: Situation;
  nowMs: number;
  /** Reports a simulated action so the page can show what would have happened. */
  onAct: (message: string) => void;
}) {
  const { taxBps, minDepositSeconds, currency } = SLOT_TERMS;

  // ── Your intended terms ─────────────────────────────────────
  // Seeded from the situation so switching scene resets the form to something
  // sensible rather than stranding a half-typed number from a different story.
  const suggested = situation.occupied ? situation.price : 25;
  const [price, setPrice] = useState(suggested);
  const [fundDays, setFundDays] = useState<number>(30);
  const [custom, setCustom] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [open, setOpen] = useState(false);

  const firstRender = useRef(true);
  useEffect(() => {
    setPrice(situation.occupied ? situation.price : 25);
    setFundDays(30);
    setCustom(null);
    setPending(null);
    // Holders land with the panel already open: they are here because something
    // needs deciding. Visitors get the quiet trigger instead.
    setOpen(situation.youHold);
    firstRender.current = false;
  }, [situation]);

  // ── Derived, all from the same three inputs ─────────────────
  const funding = useMemo(() => {
    if (custom !== null) {
      const n = Number(custom.replace(",", "."));
      return Number.isFinite(n) && n >= 0 ? n : 0;
    }
    // A preset means "this many days of runway at the price I have named".
    return (price * taxBps * (fundDays * DAY)) / (10_000 * 30 * 24 * 3600);
  }, [custom, fundDays, price, taxBps]);

  const floor = minDepositFor(price, taxBps, minDepositSeconds);
  const monthly = burnPerMonth(price, taxBps);

  // What the position looks like AFTER the action being contemplated.
  const nextDeposit = situation.youHold ? situation.deposit + funding : funding;
  const nextRunway = runwaySeconds(nextDeposit, price, taxBps);

  // What it looks like right now, for a holder.
  const nowRunway = runwaySeconds(situation.deposit, situation.price, taxBps);
  const nowHealth = healthOf(nowRunway);

  const total = costToTake(situation.price, funding, situation.occupied);
  const overBudget = total > WALLET_BALANCE;
  const underFloor = funding < floor;
  const protectedUntil =
    situation.heldForSeconds < SLOT_TERMS.tenureSeconds
      ? SLOT_TERMS.tenureSeconds - situation.heldForSeconds
      : 0;

  const run = (kind: Exclude<Pending, null>, message: string) => {
    setPending(kind);
    window.setTimeout(() => {
      setPending(null);
      onAct(message);
    }, 900);
  };

  // ── Holder view ─────────────────────────────────────────────
  if (situation.youHold) {
    return (
      <div className="border bg-background">
        <StatusBanner
          health={nowHealth}
          runway={nowRunway}
          price={situation.price}
        />

        <div className="space-y-5 p-4 md:p-5">
          <RunwayAxis runway={nowRunway} health={nowHealth} nowMs={nowMs} />

          <Ledger
            rows={[
              ["Your price", money(situation.price, currency)],
              ["Funding left", money(situation.deposit, currency)],
              ["Costs you", `${money(monthly, currency)} / month`],
            ]}
          />

          {/* The two ways out of trouble, side by side, because they are
              genuinely alternatives — money or a lower number. */}
          <div className="grid gap-3 md:grid-cols-2">
            <Panel
              title="Add funding"
              hint="Buys time. Changes nothing else."
              icon={Plus}
            >
              <PresetRow
                options={FUNDING_DAYS.map((d) => ({
                  key: d,
                  label: `${d}d`,
                  sub: money(
                    (situation.price * taxBps * (d * DAY)) /
                      (10_000 * 30 * 24 * 3600),
                    currency,
                  ),
                }))}
                value={fundDays}
                onSelect={(d) => {
                  setCustom(null);
                  setFundDays(d as number);
                }}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Takes you to{" "}
                <span className="font-medium text-foreground">
                  {duration(
                    runwaySeconds(
                      situation.deposit +
                        (situation.price * taxBps * (fundDays * DAY)) /
                          (10_000 * 30 * 24 * 3600),
                      situation.price,
                      taxBps,
                    ),
                  )}
                </span>
                .
              </p>
              <Button
                className="mt-3 w-full"
                disabled={pending !== null}
                onClick={() =>
                  run("fund", `Added ${fundDays} days of funding.`)
                }
              >
                {pending === "fund" ? <Spinner /> : null}
                Add {fundDays} days
              </Button>
            </Panel>

            <Panel
              title="Lower your price"
              hint="Costs less to hold. Easier for someone to take."
              icon={ArrowDown}
            >
              <PriceStepper
                price={price}
                onChange={setPrice}
                taxBps={taxBps}
                currency={currency}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                {price < situation.price ? (
                  <>
                    Runway becomes{" "}
                    <span className="font-medium text-foreground">
                      {duration(
                        runwaySeconds(situation.deposit, price, taxBps),
                      )}
                    </span>{" "}
                    without adding a thing.
                  </>
                ) : price > situation.price ? (
                  <>
                    Burns faster — down to{" "}
                    <span className="font-medium text-foreground">
                      {duration(
                        runwaySeconds(situation.deposit, price, taxBps),
                      )}
                    </span>
                    .
                  </>
                ) : (
                  "Move it to see the effect."
                )}
              </p>
              <Button
                variant="outline"
                className="mt-3 w-full"
                disabled={pending !== null || price === situation.price}
                onClick={() =>
                  run("reprice", `Price set to ${money(price, currency)}.`)
                }
              >
                {pending === "reprice" ? <Spinner /> : null}
                Set price to {money(price, currency)}
              </Button>
            </Panel>
          </div>

          <FootNote>
            You can leave whenever you like — lower your price until someone
            takes it, and you are paid that price plus whatever funding is left.
            Walking away with <code className="font-mono">release</code> returns
            your funding but nothing for the slot.
          </FootNote>
        </div>
      </div>
    );
  }

  // ── Visitor view ────────────────────────────────────────────
  return (
    <div className="border bg-background">
      <div className="border-b p-4 md:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {situation.occupied ? "Held by" : "Nobody holds this"}
            </p>
            <p className="mt-0.5 text-lg font-semibold">
              {situation.occupied
                ? situation.occupantName
                : "It is free to take"}
            </p>
          </div>
          {situation.occupied && (
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Their price
              </p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums">
                {money(situation.price, currency)}
              </p>
            </div>
          )}
        </div>

        {situation.occupied && (
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            That price is an open offer. Pay it and the slot is yours — they
            cannot say no, and the money goes to them.
          </p>
        )}

        {protectedUntil > 0 && (
          <div className="mt-3 flex items-start gap-2 border border-violet-500/30 bg-violet-500/5 p-2.5">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-violet-600 dark:text-violet-400" />
            <p className="text-xs leading-relaxed">
              <span className="font-medium">Not yet.</span> This slot has a
              3-day minimum tenure and {situation.occupantName} took it{" "}
              {duration(situation.heldForSeconds)} ago. You can take it in{" "}
              {duration(protectedUntil)}.
            </p>
          </div>
        )}
      </div>

      {/* The trigger the brief asked for: quiet until wanted, then the whole
          widget unfolds. Height animation is avoided — it janks on variable
          content — so it fades and lifts instead. */}
      {!open ? (
        <div className="p-4 md:p-5">
          <Button
            size="lg"
            className="w-full"
            disabled={protectedUntil > 0}
            onClick={() => setOpen(true)}
          >
            {situation.occupied
              ? `Take it for ${money(situation.price, currency)}`
              : "Take this slot"}
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {protectedUntil > 0
              ? "Locked while the tenure runs"
              : "See the full cost before anything is signed"}
          </p>
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-top-1 space-y-5 p-4 duration-300 motion-reduce:animate-none md:p-5">
          <Step
            n={1}
            title="Name your price"
            hint="What you would accept to hand it over. Anyone can take it at this number, so an honest one keeps it."
          >
            <PriceStepper
              price={price}
              onChange={setPrice}
              taxBps={taxBps}
              currency={currency}
              large
            />
          </Step>

          <Step
            n={2}
            title="Fund the tax"
            hint="Held in escrow and drawn down over time. Add or withdraw later; whatever is left comes back to you."
          >
            <PresetRow
              options={FUNDING_DAYS.map((d) => ({
                key: d,
                label: `${d} days`,
                sub: money(
                  (price * taxBps * (d * DAY)) / (10_000 * 30 * 24 * 3600),
                  currency,
                ),
              }))}
              value={custom === null ? fundDays : -1}
              onSelect={(d) => {
                setCustom(null);
                setFundDays(d as number);
              }}
            />
            <Input
              inputMode="decimal"
              placeholder={`or an amount in ${currency}`}
              value={custom ?? ""}
              onChange={(e) => setCustom(e.target.value)}
              className="mt-2 text-sm"
            />
            {underFloor && (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-500">
                This slot needs at least {money(floor, currency)} — seven days
                of tax at your price.
              </p>
            )}
          </Step>

          <div className="space-y-2.5 border-t pt-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              What you get
            </p>
            <RunwayAxis
              runway={nextRunway}
              health={healthOf(nextRunway)}
              nowMs={nowMs}
            />
          </div>

          <div className="border-t pt-4">
            <Ledger
              rows={[
                ...(situation.occupied
                  ? ([
                      [
                        `Paid to ${situation.occupantName}`,
                        money(situation.price, currency),
                      ],
                    ] as [string, string][])
                  : []),
                ["Funding (yours, refundable)", money(funding, currency)],
                ["Then costs you", `${money(monthly, currency)} / month`],
              ]}
              total={["You pay now", money(total, currency)]}
            />
          </div>

          {overBudget && (
            <p className="text-xs text-red-600 dark:text-red-500">
              That is more than your {money(WALLET_BALANCE, currency)} balance.
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              size="lg"
              className="flex-1"
              disabled={
                pending !== null || overBudget || underFloor || price <= 0
              }
              onClick={() =>
                run(
                  "take",
                  `Took the slot at ${money(price, currency)} with ${duration(nextRunway)} of funding.`,
                )
              }
            >
              {pending === "take" ? <Spinner /> : null}
              {situation.occupied ? "Take it" : "Take the slot"} ·{" "}
              {money(total, currency)}
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending !== null}
            >
              Cancel
            </Button>
          </div>

          <FootNote>
            After this, anyone can take it from you at whatever price you are
            showing — that is the deal in both directions. Raise your price and
            it costs more to keep; lower it and it is easier to lose.
          </FootNote>
        </div>
      )}
    </div>
  );
}

// ── Pieces ───────────────────────────────────────────────────

function StatusBanner({
  health,
  runway,
  price,
}: {
  health: ReturnType<typeof healthOf>;
  runway: number;
  price: number;
}) {
  const tone = HEALTH_TONE[health];
  const urgent = health === "critical" || health === "gone";

  // One sentence, in the imperative where something is actually needed. A
  // status that reads the same whether or not you must act teaches nothing.
  const line =
    health === "gone"
      ? "Anyone can remove you from this slot right now."
      : health === "critical"
        ? `Funding runs out in ${duration(runway)}. Add funds or lower your price.`
        : health === "warning"
          ? `Funding runs out in ${duration(runway)}.`
          : `Funded for ${duration(runway)}. Nothing needs doing.`;

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 border-b p-4 md:px-5",
        urgent ? "bg-red-500/5" : health === "warning" ? "bg-amber-500/5" : "",
      )}
    >
      {urgent ? (
        <TriangleAlert className={cn("mt-0.5 size-4 shrink-0", tone.text)} />
      ) : (
        <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", tone.dot)} />
      )}
      <div className="min-w-0">
        <p className={cn("text-sm font-medium", urgent && tone.text)}>{line}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          You hold it at {money(price)}.
        </p>
      </div>
    </div>
  );
}

function Step({
  n,
  title,
  hint,
  children,
}: {
  n: number;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-baseline gap-2">
        {/* Numbered because this genuinely is a sequence — you cannot fund a
            price you have not named. */}
        <span className="font-mono text-[11px] text-muted-foreground">
          {String(n).padStart(2, "0")}
        </span>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="mb-2.5 mt-0.5 pl-6 text-xs leading-relaxed text-muted-foreground">
        {hint}
      </p>
      <div className="pl-6">{children}</div>
    </section>
  );
}

function PriceStepper({
  price,
  onChange,
  taxBps,
  currency,
  large = false,
}: {
  price: number;
  onChange: (n: number) => void;
  taxBps: number;
  currency: string;
  large?: boolean;
}) {
  const step = (pct: number) =>
    onChange(Math.max(0, Math.round(price * (1 + pct / 100) * 100) / 100));

  return (
    <div>
      <div className="flex items-baseline gap-2">
        <input
          inputMode="decimal"
          value={price}
          onChange={(e) => {
            const n = Number(e.target.value.replace(",", "."));
            if (Number.isFinite(n) && n >= 0) onChange(n);
          }}
          className={cn(
            "min-w-0 flex-1 bg-transparent font-semibold tabular-nums tracking-tight outline-none",
            large ? "text-3xl" : "text-xl",
          )}
        />
        <span className="shrink-0 text-sm text-muted-foreground">
          {currency}
        </span>
      </div>
      <div className="mt-2 flex">
        {PRICE_STEPS.map((p, i) => (
          <button
            key={p}
            type="button"
            onClick={() => step(p)}
            className={cn(
              "flex-1 border py-1 text-xs tabular-nums transition-colors hover:bg-muted",
              i > 0 && "-ml-px",
              p < 0
                ? "text-red-600 dark:text-red-500"
                : "text-emerald-700 dark:text-emerald-500",
            )}
          >
            {p > 0 ? `+${p}` : p}%
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Costs{" "}
        <span className="font-medium tabular-nums text-foreground">
          {money(burnPerMonth(price, taxBps), currency)}
        </span>{" "}
        a month to hold at this price.
      </p>
    </div>
  );
}

function PresetRow({
  options,
  value,
  onSelect,
}: {
  options: { key: number; label: string; sub: string }[];
  value: number;
  onSelect: (k: number) => void;
}) {
  return (
    <div className="flex">
      {options.map((o, i) => {
        const active = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onSelect(o.key)}
            aria-pressed={active}
            className={cn(
              "flex-1 border px-2 py-2 text-left transition-colors",
              i > 0 && "-ml-px",
              active
                ? "border-foreground bg-foreground text-background"
                : "hover:bg-muted",
            )}
          >
            <span className="block text-xs font-medium">{o.label}</span>
            <span
              className={cn(
                "block tabular-nums text-[10px]",
                active ? "opacity-70" : "text-muted-foreground",
              )}
            >
              {o.sub}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Ledger({
  rows,
  total,
}: {
  rows: [string, string][];
  total?: [string, string];
}) {
  return (
    <div className="space-y-1.5">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-4">
          <span className="text-xs text-muted-foreground">{k}</span>
          <span className="text-xs font-medium tabular-nums">{v}</span>
        </div>
      ))}
      {total && (
        <div className="flex items-baseline justify-between gap-4 border-t pt-2">
          <span className="text-sm font-medium">{total[0]}</span>
          <span className="text-base font-semibold tabular-nums">
            {total[1]}
          </span>
        </div>
      )}
    </div>
  );
}

function Panel({
  title,
  hint,
  icon: Icon,
  children,
}: {
  title: string;
  hint: string;
  icon: typeof Plus;
  children: React.ReactNode;
}) {
  return (
    <div className="border p-3">
      <div className="flex items-center gap-1.5">
        <Icon className="size-3.5 text-muted-foreground" />
        <h4 className="text-sm font-semibold">{title}</h4>
      </div>
      <p className="mb-2.5 mt-0.5 text-xs text-muted-foreground">{hint}</p>
      {children}
    </div>
  );
}

function FootNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-t pt-3 text-xs leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
}

function Spinner() {
  return <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />;
}

export { ArrowUp, Check, Wallet };
