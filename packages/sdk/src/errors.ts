/** Error thrown by SlotsClient operations, wrapping the original cause with operation context. */
export class SlotsError extends Error {
  declare readonly cause: unknown;

  constructor(
    public readonly operation: string,
    cause: unknown,
  ) {
    const msg = cause instanceof Error ? cause.message : String(cause);
    super(`${operation}: ${msg}`);
    this.name = "SlotsError";
    this.cause = cause;
  }
}

/**
 * The custom error a revert actually carried, if viem could decode one.
 *
 * viem puts the decoded error on a `ContractFunctionRevertedError` several
 * links down the cause chain, and leaves `shortMessage` at the useless
 * `The contract function "buy" reverted.` — so a module's `TenureNotElapsed`
 * reads identically to running out of gas unless this is dug out. Walks the
 * chain rather than reaching for a fixed depth, because how deep it sits
 * depends on whether the call was a simulation or a send.
 */
export function decodedRevert(error: unknown): string | undefined {
  let node = error as Record<string, unknown> | undefined;
  for (let depth = 0; node && typeof node === "object" && depth < 8; depth++) {
    const data = node.data as Record<string, unknown> | undefined;
    if (data && typeof data.errorName === "string") {
      const args = Array.isArray(data.args) ? data.args : [];
      return args.length
        ? `${data.errorName}(${args.map((a) => String(a)).join(", ")})`
        : data.errorName;
    }
    node = node.cause as Record<string, unknown> | undefined;
  }
  return undefined;
}
