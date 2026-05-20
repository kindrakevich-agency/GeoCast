"use client";

import { useCallback, useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import type { Hex } from "viem";
import { baseSepolia } from "viem/chains";
import { mockUsdcAbi } from "@/lib/onchain/abi";
import { getOnchainConfig } from "@/lib/onchain/config";
import { humanizeWalletError } from "@/lib/onchain/errors";

export type MintStatus =
  | { phase: "idle" }
  | { phase: "minting"; txHash?: Hex }
  | { phase: "done"; txHash: Hex }
  | { phase: "error"; message: string };

/**
 * Testnet faucet — calls MockUSDC.mint(self, amount). Only safe when the
 * configured chain is Base Sepolia (84532); on mainnet there's no public
 * mint, so the hook errors out.
 */
export function useMintTestUsdc(): {
  status: MintStatus;
  mint: (amountMicros: bigint) => Promise<void>;
} {
  const cfg = getOnchainConfig();
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [status, setStatus] = useState<MintStatus>({ phase: "idle" });

  const mint = useCallback(
    async (amountMicros: bigint) => {
      if (!address) {
        setStatus({ phase: "error", message: "Connect a wallet first." });
        return;
      }
      if (cfg.chainId !== baseSepolia.id) {
        setStatus({ phase: "error", message: "Mint only available on Base Sepolia testnet." });
        return;
      }
      try {
        setStatus({ phase: "minting" });
        const txHash = await writeContractAsync({
          address: cfg.usdcAddress,
          abi: mockUsdcAbi,
          functionName: "mint",
          args: [address, amountMicros],
          chainId: baseSepolia.id,
        });
        setStatus({ phase: "done", txHash });
      } catch (e) {
        setStatus({ phase: "error", message: humanizeWalletError(e) });
      }
    },
    [address, cfg, writeContractAsync],
  );

  return { status, mint };
}
