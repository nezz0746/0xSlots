import type { Address } from "viem";
import { anvil, base, baseSepolia } from "viem/chains";

/**
 * SlotsHub contract addresses by chain ID.
 *
 * These MUST match `apps/contracts/deployments/<chainId>/SlotFactoryV3.json`
 * and the factory datasources in `packages/subgraph/config/<network>.json`.
 * A slot created through a factory the subgraph does not index is invisible to
 * every consumer of this SDK, and fails silently — the transaction succeeds.
 */
export const slotFactoryAddress = {
  [base.id]: "0xbf2F890E8F5CCCB3A1D7c5030dBC1843B9E36B0e",
  [baseSepolia.id]: "0x6D87C1647f228Baf8DE0374FCd7FdEBF6900fdFF",
  // Local anvil, pinned by apps/contracts/script/DeployLocal.s.sol. The address
  // survives edits to Slot.sol and friends — see LocalBootstrap.sol for why a
  // plain CREATE2 would not. Listed unconditionally because it is only data;
  // whether the chain is OFFERED is decided by `CHAINS` in ./index.ts.
  [anvil.id]: "0x78F614D6e3489a90BD2584D2ab1D90F5C35722F6",
} as const;

/**
 * SlotCollectiveFactory — deploys SlotCollectives behind one upgradeable beacon.
 *
 * A collective fills BOTH of a slot's named addresses: `recipient` (tax flows to
 * it) and `manager` (it may propose tax / utility / policy changes).
 *
 * This table is the single source of truth for whether collectives exist on a
 * chain: `CollectiveUnavailable` in the app derives its "not deployed here, try
 * X" message straight from these keys, so shipping to a new chain is one entry
 * and every screen updates with it.
 *
 * ADMIN IS STILL THE DEPLOYER EOA on both chains. That key can `upgradeBeacon`
 * and so replace the logic of every collective at once — see `transferAdmin`,
 * and the M-2 finding in docs/audits. Move it to a multisig before collectives
 * hold anything worth taking.
 */
export const slotCollectiveFactoryAddress = {
  // Deployed 2026-08-13, block 49962974.
  [base.id]: "0x9DE033C5E2FAC9e096c91a83635d7a7Cf21b4486",
  // Deployed 2026-08-12, block 45393270. Beacon-backed, admin is the deployer.
  [baseSepolia.id]: "0x03825eA2529e9eA2d5aDFf9DBc3773cDE61Da43d",
  // Local anvil, pinned by `apps/contracts/script/DeployLocal.s.sol` step 7.
  [anvil.id]: "0x60E7C43423f7aCD6a70d5a1eFd688558a391Bb6d",
} as const;

export const batchCollectorAddress = {
  [baseSepolia.id]: "0xd3c7090C2F89c5132C3f91DD1da4bCffEAe10e13",
} as const;

export const erc721SlotsAddress = {
  [baseSepolia.id]: "0x65e88189ac09527c5F7da0296ef33C77E5a6BE27",
} as const;

export const feedModuleAddress = {
  [baseSepolia.id]: "0x17b663b7C779B64f339ab916aB734A6a4f0b075E",
  [base.id]: "0xe92BE44E3D77be84E2aC4D6da9FFDaC0FCa67f72",
} as const;

export const feedRouterAddress = {
  [baseSepolia.id]: "0x93E67283Cbb4bE7b86FeBbb9620e72777715C710",
  [base.id]: "0xCfFA953EfC77591463a9560211bC783b5aaF3A4a",
} as const;

export const feedSocialGroupAddress = {
  [baseSepolia.id]: "0xC664a125F58cEc92d041c73c58388e58b7b5fE5D",
  [base.id]: "0x5b524d7A1E7449963c42aEaFfAE751573e22F314",
} as const;

/**
 * FeedHub — beacon factory + registry for on-chain Feed contracts. The default
 * feed is `feeds(0)`. base (mainnet) is pending its deploy.
 */
export const feedHubAddress = {
  [baseSepolia.id]: "0xE4c0c374E3233b5174a1600AF1321cDa9b6B5cF8",
} as const;

/**
 * Supported chain IDs for 0xSlots protocol
 */
export type SupportedChainId = keyof typeof slotFactoryAddress;

/**
 * Get the SlotsHub address for a given chain ID
 * @param chainId - The chain ID
 * @returns The SlotsHub address or undefined if not deployed on the chain
 */
export function getSlotsHubAddress(chainId: number): Address | undefined {
  return slotFactoryAddress[chainId as SupportedChainId];
}

/**
 * Check if SlotsHub is deployed on a given chain
 * @param chainId - The chain ID
 * @returns True if deployed, false otherwise
 */
export function isSlotsHubDeployed(chainId: number): boolean {
  return chainId in slotFactoryAddress;
}

/**
 * Get all supported chain IDs
 * @returns Array of supported chain IDs
 */
export function getSupportedChainIds(): SupportedChainId[] {
  return Object.keys(slotFactoryAddress).map(Number) as SupportedChainId[];
}

/**
 * MinimumTenurePolicyFactory — deploys one MinimumTenurePolicy per duration at
 * a CREATE2 address derived from that duration, so any tenure is available
 * without the policy needing mutable per-slot storage.
 */
export const MINIMUM_TENURE_POLICY_FACTORY: Partial<
  Record<number, `0x${string}`>
> = {
  // Redeployed with the IModuleMetadata rename (`policyURI()` →
  // `metadataURI()`). A policy is not upgradeable and its address is a CREATE2
  // hash of the INIT CODE, so new bytecode necessarily means a new factory AND
  // new addresses for every duration it predicts. Pointing creation at the old
  // factory would mint a pre-rename policy that the upgraded SlotFactory then
  // refuses to verify — which is why this moved rather than being left alone.
  [baseSepolia.id]: "0x2a399E4D93d9b7Ffa8367894A39859013B214E4a",
  [base.id]: "0x6C90Ca1A6ac6bBC0e4B48cc3CF589F6A3c2b30a5",
};

/**
 * MinimumPricePolicyFactory — deploys one MinimumPricePolicy per
 * (currency, minPrice) pair at a CREATE2 address derived from that pair. The
 * currency is part of the key because the floor is a bare integer whose
 * meaning depends entirely on the token's decimals.
 */
export const MINIMUM_PRICE_POLICY_FACTORY: Partial<
  Record<number, `0x${string}`>
> = {
  // Redeployed 2026-08-08 to accept `address(0)` — a floor denominated in
  // native ETH — and again with the IModuleMetadata rename. The factory is not
  // upgradeable, so each is new bytecode at a new address, and every policy it
  // predicts moved with it. Floors made by the earlier factories still work on
  // the slots using them; they resolve through POLICY_FACTORIES below.
  [baseSepolia.id]: "0x958088c4Afb2cf3E4c7C23560B57fCb64dfC6551",
  [base.id]: "0xFA64C88960c0aaC55279d42131A5B7fB57e0Ff1A",
};

/**
 * Every `IPolicyFactory` on a chain, in the order a resolver should try them.
 *
 * Policy resolution is a loop: ask each factory "did you make this?" until one
 * says yes. That is the whole reason `IPolicyFactory` exists — a client needs
 * no per-kind knowledge to decide whether an address is a genuine policy.
 *
 * Superseded factories belong here too if their policies should keep resolving.
 * The ones from before `IPolicyFactory` are deliberately absent: they have no
 * `verify()`, so slots still pointing at their policies read as unrecognised,
 * which is the honest answer.
 */
export const POLICY_FACTORIES: Partial<
  Record<number, readonly `0x${string}`[]>
> = {
  // Current first — resolution stops at the first factory that claims a policy,
  // so the one minting new policies should not sit behind three dead ones.
  [baseSepolia.id]: [
    "0x2a399E4D93d9b7Ffa8367894A39859013B214E4a", // MinimumTenurePolicyFactory (current)
    "0x958088c4Afb2cf3E4c7C23560B57fCb64dfC6551", // MinimumPricePolicyFactory  (current)
    "0x51650AB1c3aBc6614A38c622A322535b16cD764e", // Tenure, pre-metadata-rename
    "0x6a1F9D1F78CD63cd969d500994CB333027A22844", // Price, pre-metadata-rename
    "0x83d86EDBC62187180A4f94A3099a98ABaa1dfe0c", // Price, pre-native-ETH floors
  ],
  [base.id]: [
    "0x6C90Ca1A6ac6bBC0e4B48cc3CF589F6A3c2b30a5", // MinimumTenurePolicyFactory (current)
    "0xFA64C88960c0aaC55279d42131A5B7fB57e0Ff1A", // MinimumPricePolicyFactory  (current)
    "0xE322cDADB8fd511788F0fA25BffD794b7A946125", // Tenure, pre-metadata-rename
    "0xe218F2e710D2B686fD4524236F3B79EC06E92091", // Price, pre-metadata-rename
    "0xF1cA0Fe72269AaEf1E5e34bfF484269f18e1b777", // Price, pre-native-ETH floors
  ],
};
