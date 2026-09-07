import { slotsTestTokenAddress } from "@0xslots/contracts/slots";
import type { Address } from "viem";
import { SlotsChain } from "./chains";
import { NATIVE_CURRENCY_ADDRESS } from "./native";

export interface TokenInfo {
  address: Address;
  name: string;
  symbol: string;
  decimals: number;
  /**
   * Test token with an unpermissioned `mint(address,uint256)`.
   *
   * Circle's testnet USDC is the real FiatToken — `mint` is gated to
   * configured minters, so a testnet user has to leave the app for
   * faucet.circle.com before they can buy anything. A faucet token avoids
   * that dead end.
   */
  faucet?: boolean;
  /**
   * Slug naming this token's logo asset — `"usdc"`, `"weth"`.
   *
   * Deliberately not a URL or a path. This package is published and has more
   * than one consumer; a `/tokens/usdc.svg` would encode one app's `public/`
   * layout into shared data, and a CDN URL would put a third-party host in
   * every consumer's render path. The slug names the asset and lets each
   * consumer decide where it lives.
   */
  logo?: string;
}

/**
 * Re-exported so consumers have one place to look for currency concerns. The
 * definitions live in `./native` because `client.ts` needs them too, and
 * importing them from here would close a cycle — see that module's note.
 *
 * `address(0)` is a sound sentinel because `Slot.initialize` rejected it
 * outright before native support existed, so no slot predating that change can
 * be holding it.
 */
export { isNativeCurrency, NATIVE_CURRENCY_ADDRESS } from "./native";

/** Native ETH presented as a token, so consumers need no second code path. */
export const NATIVE_CURRENCY: TokenInfo = {
  address: NATIVE_CURRENCY_ADDRESS,
  name: "Ether",
  symbol: "ETH",
  decimals: 18,
  logo: "eth",
};

/**
 * Predetermined tokens available per chain for slot creation.
 * The first token in each array is the default.
 */
export const CHAIN_TOKENS: Record<SlotsChain, TokenInfo[]> = {
  [SlotsChain.ANVIL]: [
    {
      // The test token deployed by `script/slots/SeedSlots.s.sol`, the
      // hook-protocol local stack.
      //
      // `dev-chain.sh` re-checks it against the records on every local boot
      // and refuses to start when the generated table is a step behind.
      // Read from the generated deployment table, never typed here: plain
      // CREATE means the address moves whenever the SEED changes what it
      // deploys or in what order. Zero rather than a stale guess when nothing
      // is deployed — a token that is plainly absent gets reported, one that is
      // plausibly wrong gets debugged for an hour.
      address:
        slotsTestTokenAddress[31337] ??
        "0x0000000000000000000000000000000000000000",
      name: "0xSlots Test USD",
      symbol: "USDX",
      decimals: 18,
      // Unpermissioned `mint(address,uint256)` — the faucet button works as-is.
      faucet: true,
      logo: "usdc",
    },
    NATIVE_CURRENCY,
  ],
  [SlotsChain.BASE_SEPOLIA]: [
    // Default: mintable, so a new testnet user can create AND buy a slot
    // without leaving the app. Shared with the Feed app, so balances carry
    // across both rather than fragmenting across two test tokens.
    {
      address: "0xFA28A416810e39a7142C7557e6e43407d765f627",
      name: "Feed USDC",
      symbol: "USDCf",
      decimals: 6,
      faucet: true,
      logo: "usdc",
    },
    {
      address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      name: "USD Coin",
      symbol: "USDC",
      decimals: 6,
      logo: "usdc",
    },
    // The OP-stack WETH predeploy — the same address on every OP-stack chain.
    // No faucet, but wrapping testnet ETH at it is a single call.
    {
      address: "0x4200000000000000000000000000000000000006",
      name: "Wrapped Ether",
      symbol: "WETH",
      decimals: 18,
      logo: "weth",
    },
    // Appended, never first — same rule as WETH above. `getDefaultToken`
    // returns [0], so USDC stays the default and an untouched create form
    // produces the slot it always did.
    NATIVE_CURRENCY,
  ],
  /**
   * Ethereum Sepolia — native ETH first, and that is a decision rather than an
   * oversight.
   *
   * Every other chain here leads with a stablecoin because it has one a new
   * user can actually get: anvil and base-sepolia both default to a token with
   * an unpermissioned `mint`. Sepolia has none. Circle's USDC is the real
   * FiatToken, so leading with it would put a trip to faucet.circle.com and an
   * ERC-20 approval between a new user and their first slot, while testnet ETH
   * is one faucet away and needs no approval at all.
   */
  [SlotsChain.SEPOLIA]: [
    NATIVE_CURRENCY,
    {
      // Circle's testnet USDC. Mintable only by configured minters — see
      // `faucet` on TokenInfo — so it is offered, not defaulted to.
      address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
      name: "USD Coin",
      symbol: "USDC",
      decimals: 6,
      logo: "usdc",
    },
    {
      // Not the OP-stack predeploy: Ethereum has no such thing, and this is
      // the canonical Sepolia WETH.
      address: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
      name: "Wrapped Ether",
      symbol: "WETH",
      decimals: 18,
      logo: "weth",
    },
  ],
  [SlotsChain.BASE]: [
    {
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      name: "USD Coin",
      symbol: "USDC",
      decimals: 6,
      logo: "usdc",
    },
    // Appended, never first: `getDefaultToken` returns [0], so USDC stays the
    // default and an untouched create form produces the slot it always did.
    {
      address: "0x4200000000000000000000000000000000000006",
      name: "Wrapped Ether",
      symbol: "WETH",
      decimals: 18,
      logo: "weth",
    },
    NATIVE_CURRENCY,
  ],
};

/**
 * Get the list of predetermined tokens for a given chain.
 */
export function getChainTokens(chainId: number): TokenInfo[] {
  return CHAIN_TOKENS[chainId as SlotsChain] ?? [];
}

/**
 * Get the default token for a given chain (first in the list).
 */
export function getDefaultToken(chainId: number): TokenInfo | undefined {
  return getChainTokens(chainId)[0];
}

/** The faucet-enabled token for a chain, if it has one. */
export function getFaucetToken(chainId: number): TokenInfo | undefined {
  return getChainTokens(chainId).find((t) => t.faucet);
}
