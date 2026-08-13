"use client";

import { getFaucetToken } from "@0xslots/sdk";
import { Loader2 } from "lucide-react";
import { erc20Abi, parseUnits } from "viem";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { Button } from "@/components/ui/button";
import { useChain } from "@/context/chain";
import { formatBalance } from "@/utils";

const FAUCET_ABI = [
  {
    type: "function",
    name: "mint",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

const MINT_AMOUNT = 100;

/**
 * Testnet faucet for the chain's mintable currency.
 *
 * Circle's testnet USDC is the real FiatToken, so `mint` is minter-gated and a
 * new user has to leave for faucet.circle.com before they can buy anything —
 * an easy place to lose someone. This mints the shared USDCf instead, the same
 * token the Feed app uses, so balances carry across both apps.
 *
 * Renders nothing on chains with no faucet token, which is how it stays absent
 * on mainnet rather than needing a testnet check of its own.
 */
export function TestnetFaucet() {
  const { chainId } = useChain();
  const { address, isConnected } = useAccount();
  const token = getFaucetToken(chainId);

  const { data: balance, refetch } = useReadContract({
    address: token?.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId,
    query: { enabled: !!token && !!address },
  });

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash,
    query: { enabled: !!hash },
  });

  if (!token) return null;

  const busy = isPending || isConfirming;

  return (
    <div className="px-2 pb-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">
          {balance !== undefined
            ? `${formatBalance(balance, token.decimals)} ${token.symbol}`
            : token.symbol}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-6 px-2 text-[11px]"
          disabled={!isConnected || busy}
          onClick={() => {
            if (!address) return;
            writeContract(
              {
                address: token.address,
                abi: FAUCET_ABI,
                functionName: "mint",
                args: [
                  address,
                  parseUnits(String(MINT_AMOUNT), token.decimals),
                ],
                chainId,
              },
              { onSuccess: () => setTimeout(() => refetch(), 3000) },
            );
          }}
        >
          {busy ? (
            <>
              <Loader2 className="size-3 animate-spin" />
              {isConfirming ? "Confirming" : "Minting"}
            </>
          ) : (
            `Mint ${MINT_AMOUNT}`
          )}
        </Button>
      </div>
      {error && (
        <p className="mt-1 break-words text-[10px] text-destructive">
          {(error as { shortMessage?: string }).shortMessage ?? error.message}
        </p>
      )}
    </div>
  );
}
