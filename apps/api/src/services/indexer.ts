import { createSlotsClient, DEFAULT_API_URL, SlotsChain } from "@0xslots/sdk";

// Defaults to Base Sepolia; set CHAIN_ID=8453 for mainnet.
//
// `chainId` no longer picks an endpoint — one ponder deployment indexes every
// chain — so it is a row filter the client applies to each query. The endpoint
// comes from PONDER_URL.
const chainId =
  Number(process.env.CHAIN_ID) === SlotsChain.BASE
    ? SlotsChain.BASE
    : SlotsChain.BASE_SEPOLIA;

export const slotsClient = createSlotsClient({
  chainId,
  apiUrl: process.env.PONDER_URL || DEFAULT_API_URL,
  // No key: ponder serves the GraphQL API unauthenticated. If this deployment
  // ever sits behind auth, pass the header directly —
  // `headers: { Authorization: \`Bearer ${token}\` }`.
  ...(process.env.PONDER_API_KEY
    ? {
        headers: {
          Authorization: `Bearer ${process.env.PONDER_API_KEY}`,
        },
      }
    : {}),
});
