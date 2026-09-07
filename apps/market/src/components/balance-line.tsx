"use client";

/**
 * What you hold, under the field asking what you will spend.
 *
 * One line rather than two states, because "you have enough" and "you do not"
 * are the same sentence with one word changed, and swapping the whole line for
 * a warning made the shortfall read as an error the form had produced rather
 * than a fact about the wallet.
 */
export function BalanceLine({
  balance,
  total,
  at,
}: {
  balance: bigint | undefined;
  /** What the transaction would send. */
  total: bigint;
  at: (v: bigint) => string;
}) {
  if (balance === undefined) return null;
  const short = total > balance;
  return (
    <p
      className={`mt-1 text-[10px] leading-none tabular ${short ? "text-ebbing" : "text-dim"}`}
    >
      {short ? "Short: you hold " : "You hold "}
      {at(balance)}
    </p>
  );
}
