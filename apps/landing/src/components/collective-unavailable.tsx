"use client";

import { CHAINS, slotCollectiveFactoryAddress } from "@0xslots/contracts";
import type { Address } from "viem";
import { useChain } from "@/context/chain";

/** Chain ids that actually have a collective factory. */
const DEPLOYED_ON = Object.keys(
  slotCollectiveFactoryAddress as Record<string, Address>,
).map(Number);

/**
 * Whether collectives exist on a chain at all.
 *
 * Derived from the address table rather than a hand-kept list, so shipping the
 * factory to a new chain is one entry in `addresses.ts` and every screen updates
 * with it. Nothing here can drift from what the app would actually call.
 */
export function useCollectiveFactory(): Address | undefined {
  const { chainId } = useChain();
  return (slotCollectiveFactoryAddress as Record<number, Address | undefined>)[
    chainId
  ];
}

/**
 * Shown wherever collectives are asked for on a chain that has none.
 *
 * Names the chains that DO have them rather than saying only "not here" — the
 * useful next action is switching, and the user cannot guess where to switch to.
 * The list is computed, so it can never claim a chain the app cannot reach.
 */
export function CollectiveUnavailable() {
  const { chainId } = useChain();

  const current =
    CHAINS.find((c) => c.id === chainId)?.name ?? `chain ${chainId}`;

  const available = DEPLOYED_ON.map(
    (id) => CHAINS.find((c) => c.id === id)?.name,
  ).filter((n): n is string => !!n);

  return (
    <div className="border p-4 text-xs">
      <p className="font-medium">
        Collectives aren&apos;t deployed on {current}.
      </p>
      <p className="mt-1 text-muted-foreground">
        {available.length > 0 ? (
          <>
            The collective factory is live on{" "}
            <span className="font-medium text-foreground">
              {available.join(", ")}
            </span>
            . Switch chain from the sidebar to use it.
          </>
        ) : (
          // `CHAINS` filters anvil out of production builds, so a dev-only
          // deployment legitimately resolves to an empty list here rather than
          // naming a chain this build cannot select.
          <>The collective factory has not shipped to a selectable chain yet.</>
        )}
      </p>
    </div>
  );
}
