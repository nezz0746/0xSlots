/**
 * The first line of a wallet error, which is the only one written for people.
 *
 * viem and the wallet SDKs append request details, docs links and version
 * strings after a newline. All of that belongs in a console, not a dialog.
 */
export function describeError(cause: unknown, fallback: string): string {
  if (!(cause instanceof Error)) return fallback;
  return cause.message.split("\n")[0]?.trim() || fallback;
}
