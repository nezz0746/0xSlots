import type { Hash, PublicClient } from "viem";

/**
 * Wait for a transaction, and treat a revert as a failure.
 *
 * `waitForTransactionReceipt` resolves for a MINED transaction whether it
 * succeeded or reverted — `status` carries the answer and nothing throws. So a
 * panel that only awaited it reported success for every revert: the spinner
 * stopped, no error appeared, and the figures refreshed to exactly what they
 * had been. Every write in this app goes through here.
 */
export async function confirm(
  client: PublicClient | undefined,
  hash: Hash,
): Promise<void> {
  if (!client) return;
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success")
    throw new Error(
      "The transaction was mined but reverted. Nothing changed, and the fee was still spent.",
    );
}
