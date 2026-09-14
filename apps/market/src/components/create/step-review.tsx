"use client";

import { NATIVE_CURRENCY_ADDRESS } from "@0xslots/sdk";
import { useAccount } from "wagmi";

import type { CreateState } from "@/hooks/use-create-collection";
import { useObjectUrls } from "@/hooks/use-object-urls";
import { rate } from "@/lib/format";

/**
 * The three things the button does, named before it is pressed.
 *
 * This submission is three steps and two of them ask the wallet, so a single
 * spinner would leave the second prompt looking like a duplicate of the first.
 */
export const PHASES = [
  { title: "Deploy", running: "Opening the collection…", note: "the wallet asks" },
  { title: "Upload the art", running: "Uploading the art…", note: null },
  {
    title: "Point it at them",
    running: "Pointing it at the art…",
    note: "the wallet asks again",
  },
] as const;

export function StepReview({
  state,
  activePhase,
}: {
  state: CreateState;
  /**
   * Which of PHASES is running, or null before the button is pressed.
   *
   * An index rather than the label, so the strip and the button cannot drift
   * apart — matching on a prefix of the label is the kind of thing that works
   * until somebody renames a phase.
   */
  activePhase: number | null;
}) {
  const { address } = useAccount();
  const urls = useObjectUrls(state.files);
  const taxBps = BigInt(Math.round(Number(state.taxPct || "0") * 100));
  // A dash here read as "nowhere", which is alarming and wrong: an empty
  // field means the connected wallet, and with no wallet yet it means the one
  // that signs. Say that, rather than a character that looks like a failure.
  const recipient = state.recipient || address || null;
  const currency =
    state.currency === "custom" ? state.customCurrency : state.currency;

  return (
    <div>
      <h2 className="text-[26px] font-extrabold leading-[1.1] tracking-[-0.035em] sm:text-[30px]">
        This is what you&rsquo;re opening.
      </h2>
      <p className="mt-2.5 max-w-[52ch] text-[14px] leading-relaxed text-dim">
        Nothing has been spent yet. The button below is the first thing that
        costs gas.
      </p>

      <div className="mt-7 flex flex-wrap items-center gap-4">
        <div className="flex gap-1">
          {urls.slice(0, 5).map((url) => (
            // biome-ignore lint/performance/noImgElement: a local object URL.
            <img
              key={url}
              src={url}
              alt=""
              className="size-12 bg-lift object-cover"
            />
          ))}
          {urls.length > 5 && (
            <span className="grid size-12 place-items-center bg-lift text-[11px] tabular text-dim">
              +{urls.length - 5}
            </span>
          )}
        </div>
        <div>
          <p className="text-[20px] font-bold leading-none tracking-[-0.025em]">
            {state.name.trim() || "Untitled"}
          </p>
          <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-dim">
            {state.symbol.trim() || "———"} · {state.files.length}{" "}
            {state.files.length === 1 ? "place" : "places"}
          </p>
        </div>
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-4 border-t border-line pt-5 text-[13px] sm:grid-cols-4">
        <Fact label="Rent">{rate(taxBps)}</Fact>
        <Fact label="Funded window">
          {Number(state.window) / 86_400} days
        </Fact>
        <Fact label="Currency">
          {currency === NATIVE_CURRENCY_ADDRESS ? "ETH" : "token"}
        </Fact>
        <Fact label="Terms">
          {state.manager ? "rent can change" : "fixed for ever"}
        </Fact>
      </dl>

      <div className="mt-5 border border-brand/40 bg-brand-wash px-4 py-3 text-[12.5px] leading-snug">
        <span className="text-dim">Rent goes to</span>{" "}
        {recipient ? (
          <b className="tabular">{recipient}</b>
        ) : (
          <b>the wallet you connect</b>
        )}
        <br />
        <span className="text-dim">Manager</span>{" "}
        <b>{state.manager || "nobody — rent is fixed for ever"}</b>
      </div>

      <div className="mt-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dim">
          What happens when you press it
        </p>
        <ol className="mt-2.5 flex flex-col text-[12px] sm:flex-row">
          {PHASES.map((phase, i) => {
            const active = activePhase === i;
            return (
              <li
                key={phase.title}
                className={`flex-1 px-3 py-2.5 transition-colors ${
                  active ? "bg-brand text-ink" : i === 0 ? "bg-brand-wash" : "bg-lift"
                }`}
              >
                <b>
                  {i + 1} · {phase.title}
                </b>
                <br />
                <span className={active ? "text-ink/70" : "text-dim"}>
                  {phase.note ??
                    `${state.files.length} ${state.files.length === 1 ? "work" : "works"} to Économe`}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-[11px] text-dim">{label}</dt>
      <dd className="mt-1 tabular">{children}</dd>
    </div>
  );
}
