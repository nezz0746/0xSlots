import {
  minimumTenureHookFactoryAbi,
  minimumTenureHookFactoryAddress,
} from "@0xslots/contracts/slots";
import type {
  Account,
  Address,
  Chain,
  Hash,
  PublicClient,
  WalletClient,
} from "viem";
import { SlotsError } from "../errors";

/**
 * `MinimumTenureHookFactory` — a duration in, a hook address out.
 *
 * Deliberately plain functions over a `PublicClient`/`WalletClient` rather than
 * methods on `SlotsClient`: the factory is not part of the slot lifecycle, a
 * caller reaches for it exactly once while assembling a `SlotInit`, and it
 * needs none of the client's state.
 *
 * ── The shape a UI should use ────────────────────────────────────────────────
 *
 * {@link predictTenureHook} is a `view`, so the address for a duration is known
 * before anything is sent. Resolve it while the creator is still picking, and
 * only send {@link getOrDeployTenureHook} when {@link isTenureHookDeployed} says
 * nothing is there yet. Most durations people pick will already exist — the
 * whole point of the factory is that the second slot wanting 7 days reuses the
 * first slot's hook.
 *
 * ── metadataURI ──────────────────────────────────────────────────────────────
 *
 * The hook takes its `metadataURI` as a constructor argument, so the URI is
 * part of the initcode and therefore part of the address. Omitting it takes the
 * factory's canonical default and gives ONE address per duration protocol-wide;
 * passing one is a genuinely different configuration that correctly lands
 * somewhere else. If you are not publishing metadata, omit it — do not pass
 * `""` explicitly and assume it matches, because it only matches when the
 * factory's default is also empty.
 */

/** The `MinimumTenureHookFactory` on `chainId`, if this client knows one. */
export function getTenureHookFactoryAddress(
  chainId: number,
): Address | undefined {
  return minimumTenureHookFactoryAddress[chainId];
}

function factoryFor(chainId: number): Address {
  const address = minimumTenureHookFactoryAddress[chainId];
  if (!address)
    throw new SlotsError(
      "getTenureHookFactoryAddress",
      `No MinimumTenureHookFactory known for chain ${chainId}`,
    );
  return address;
}

export interface TenureHookParams {
  publicClient: PublicClient;
  /** Defaults to the factory recorded for the public client's chain. */
  factory?: Address;
  /** The protection window, in seconds. Must be > 0. */
  tenureSeconds: bigint;
  /**
   * Omit for the factory's canonical default — the path that gives one address
   * per duration. Passing a URI is a different configuration and a different
   * address.
   */
  metadataURI?: string;
}

async function resolveFactory(
  publicClient: PublicClient,
  factory?: Address,
): Promise<Address> {
  if (factory) return factory;
  const chainId = publicClient.chain?.id ?? (await publicClient.getChainId());
  return factoryFor(chainId);
}

function assertTenure(tenureSeconds: bigint): void {
  if (tenureSeconds <= 0n)
    throw new SlotsError(
      "tenureSeconds",
      "tenureSeconds must be > 0 — the factory rejects a zero window",
    );
}

/**
 * The address the hook for this configuration has, or would have.
 *
 * No transaction, and correct before the deployment exists — that is what lets
 * a client render the resulting hook address while the creator is still
 * choosing.
 */
export async function predictTenureHook({
  publicClient,
  factory,
  tenureSeconds,
  metadataURI,
}: TenureHookParams): Promise<Address> {
  assertTenure(tenureSeconds);
  const address = await resolveFactory(publicClient, factory);
  return publicClient.readContract({
    address,
    abi: minimumTenureHookFactoryAbi,
    functionName: "predict",
    args:
      metadataURI === undefined
        ? [tenureSeconds]
        : [tenureSeconds, metadataURI],
  } as never) as Promise<Address>;
}

/** Whether the hook for this configuration already exists. */
export async function isTenureHookDeployed({
  publicClient,
  factory,
  tenureSeconds,
  metadataURI,
}: TenureHookParams): Promise<boolean> {
  assertTenure(tenureSeconds);
  const address = await resolveFactory(publicClient, factory);
  return publicClient.readContract({
    address,
    abi: minimumTenureHookFactoryAbi,
    functionName: "isDeployed",
    args:
      metadataURI === undefined
        ? [tenureSeconds]
        : [tenureSeconds, metadataURI],
  } as never) as Promise<boolean>;
}

/**
 * Whether `hook` really came from this factory.
 *
 * Answers on address derivation, not on what the hook says about itself: a
 * contract that reports the right family and the right duration is free to
 * write, but it cannot sit at the address CREATE2 assigns to the configuration
 * it claims. Note this is stricter than "is a MinimumTenureHook" — a genuine
 * hook deployed by hand rather than through the factory answers false.
 */
export async function verifyTenureHook({
  publicClient,
  factory,
  hook,
}: {
  publicClient: PublicClient;
  factory?: Address;
  hook: Address;
}): Promise<boolean> {
  const address = await resolveFactory(publicClient, factory);
  return publicClient.readContract({
    address,
    abi: minimumTenureHookFactoryAbi,
    functionName: "verify",
    args: [hook],
  } as never) as Promise<boolean>;
}

export interface GetOrDeployTenureHookParams extends TenureHookParams {
  walletClient: WalletClient;
  account?: Account | Address;
  chain?: Chain;
}

/**
 * The hook for this configuration, deploying it only if it is not already
 * there.
 *
 * Returns the address and the transaction hash, if one was needed. `hash` is
 * `undefined` when the hook already existed and nothing was sent — check it
 * rather than assuming a receipt to wait on.
 */
export async function getOrDeployTenureHook({
  publicClient,
  walletClient,
  factory,
  tenureSeconds,
  metadataURI,
  account,
  chain,
}: GetOrDeployTenureHookParams): Promise<{ hook: Address; hash?: Hash }> {
  assertTenure(tenureSeconds);
  const address = await resolveFactory(publicClient, factory);
  const args =
    metadataURI === undefined ? [tenureSeconds] : [tenureSeconds, metadataURI];

  const hook = (await publicClient.readContract({
    address,
    abi: minimumTenureHookFactoryAbi,
    functionName: "predict",
    args,
  } as never)) as Address;

  // Permissionless and idempotent on-chain too, so this check is a gas saving
  // rather than a correctness requirement — a racing caller who deploys it
  // between these two calls costs us a no-op, not a revert.
  const code = await publicClient.getCode({ address: hook });
  if (code && code !== "0x") return { hook };

  const resolvedAccount = account ?? walletClient.account;
  if (!resolvedAccount)
    throw new SlotsError(
      "getOrDeployTenureHook",
      "No account provided and the walletClient has none",
    );

  const hash = await walletClient.writeContract({
    address,
    abi: minimumTenureHookFactoryAbi,
    functionName: "getOrDeploy",
    args,
    account: resolvedAccount,
    chain: chain ?? walletClient.chain,
  } as never);

  return { hook, hash };
}
