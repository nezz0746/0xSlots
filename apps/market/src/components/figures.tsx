"use client";

/**
 * Three figures, read across as one sentence.
 *
 * Worth X, so it costs Y a month, so it lasts Z. That IS the model, and it is
 * the whole of what a reader needs before deciding — so it is all this shows.
 *
 * It used to show six, adding deposit, tax accrued and escrow left. Those are
 * the WORKING behind the runway rather than three more readings: escrow left
 * divided by rent is the runway, and it was already in the cell beside them.
 * Six cells at two lines each also made the panel taller than the work it sat
 * next to, which is the wrong thing for a marketplace to be looking at.
 */
export function Figures({
  items,
  className,
}: {
  items: {
    label: string;
    /** Rides in the label, dimmed — a rate, a definition. */
    qualifier?: string;
    value: string;
    /** A constraint on this figure. Quiet: a floor is not a reading. */
    foot?: string;
    tone?: Tone;
  }[];
  className?: string;
}) {
  return (
    <dl
      className={`grid grid-cols-3 border-y border-line ${className ?? ""}`}
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((item, i) => (
        <div
          key={item.label}
          className={`px-3 py-2.5 ${i > 0 ? "border-l border-line" : ""}`}
        >
          <dt className="flex items-baseline gap-1 text-[10px] leading-none text-dim">
            <span className="truncate">{item.label}</span>
            {item.qualifier && (
              <span className="shrink-0 opacity-70">{item.qualifier}</span>
            )}
          </dt>
          <dd
            className={`mt-1.5 flex items-baseline gap-1.5 text-[13px] leading-none tabular ${toneClass(item.tone)}`}
          >
            <span className="truncate font-medium">{item.value}</span>
            {item.foot && (
              <span className="shrink-0 text-[10px] font-normal text-dim">
                {item.foot}
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export type Tone = "plain" | "waning" | "gone" | "standing";

function toneClass(tone: Tone = "plain") {
  return tone === "waning"
    ? "text-waning"
    : tone === "gone"
      ? "text-ebbing"
      : tone === "standing"
        ? "text-standing"
        : "";
}

/** Past two months, days stop being the unit anyone reads. */
const LONG = 60n * 24n * 60n * 60n;
/** A week. Below this the figure earns its colour. */
const SHORT = 7n * 24n * 60n * 60n;
const DAY = 24n * 60n * 60n;

/**
 * The runway in days, and how alarmed to be about it.
 *
 * Days rather than "3d 4h": this cell exists to be compared, against the rent
 * beside it and against the same figure on another work, and a mixed-unit
 * string can be neither scanned nor ranked.
 */
export function describeRunway(
  seconds: bigint,
  isVacant: boolean,
  isInsolvent: boolean,
): { value: string; tone: Tone } {
  if (isVacant) return { value: "—", tone: "plain" };
  if (isInsolvent) return { value: "none", tone: "gone" };
  // `2^256 - 1` when the deposit outlives the arithmetic. Printing that in days
  // would be absurd; printing 0 is worse.
  if (seconds > LONG * 12n) return { value: "∞", tone: "plain" };

  const days = Number(seconds / DAY);
  if (days < 1) {
    const hours = Number(seconds / 3600n);
    return { value: hours < 1 ? "< 1h" : `${hours}h`, tone: "gone" };
  }
  return { value: `${days}d`, tone: seconds < SHORT ? "waning" : "plain" };
}
