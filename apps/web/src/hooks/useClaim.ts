"use client";

import { useCallback, useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import type { Hex } from "viem";
import { geoCastPoolAbi } from "@/lib/onchain/abi";
import { getOnchainConfig } from "@/lib/onchain/config";
import { humanizeWalletError } from "@/lib/onchain/errors";

export type ClaimStatus =
  | { phase: "idle" }
  | { phase: "claiming"; txHash?: Hex }
  | { phase: "done"; txHash: Hex }
  | { phase: "error"; message: string };

/**
 * Claim a resolved round's payout. Caller provides the (amount, proof)
 * pair fetched from GET /api/rounds/{id}/claim-proof. The contract
 * verifies the proof against the stored Merkle root and transfers USDC.
 */
export function useClaim(roundId: number) {
  const cfg = getOnchainConfig();
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [status, setStatus] = useState<ClaimStatus>({ phase: "idle" });

  const claim = useCallback(
    async (amountMicros: bigint, proof: Hex[]) => {
      if (!address) {
        setStatus({ phase: "error", message: "Connect a wallet first." });
        return;
      }
      try {
        setStatus({ phase: "claiming" });
        const txHash = await writeContractAsync({
          address: cfg.poolAddress,
          abi: geoCastPoolAbi,
          functionName: "claim",
          args: [BigInt(roundId), amountMicros, proof],
          chainId: cfg.chainId,
        });
        setStatus({ phase: "done", txHash });
      } catch (e) {
        setStatus({ phase: "error", message: humanizeWalletError(e) });
      }
    },
    [address, cfg, writeContractAsync],
  );

  return { status, claim };
}
