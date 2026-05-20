"use client";

import { useAccount, useReadContract } from "wagmi";
import { erc20Abi } from "@/lib/onchain/abi";
import { getOnchainConfig } from "@/lib/onchain/config";

/**
 * Reads the connected wallet's USDC balance on the configured chain.
 * Returns 0n while loading / not connected — caller can compare against
 * BET (1_000_000n) to decide whether to surface a "Get test USDC" CTA.
 */
export function useUsdcBalance(): {
  balance: bigint;
  isLoading: boolean;
  refetch: () => void;
} {
  const cfg = getOnchainConfig();
  const { address } = useAccount();
  const { data, isLoading, refetch } = useReadContract({
    address: cfg.usdcAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) && cfg.usdcAddress !== "0x0000000000000000000000000000000000000000" },
  });
  return {
    balance: (data ?? 0n) as bigint,
    isLoading,
    refetch: () => void refetch(),
  };
}
