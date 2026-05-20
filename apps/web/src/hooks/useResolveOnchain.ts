"use client";

import { useCallback, useState } from "react";
import { useWriteContract } from "wagmi";
import type { Hex } from "viem";
import { geoCastPoolAdminAbi } from "@/lib/onchain/abi";
import { getOnchainConfig } from "@/lib/onchain/config";
import { toScaledInt32 } from "@/lib/onchain/commit";

export type ResolveOnchainStatus =
  | { phase: "idle" }
  | { phase: "resolving"; txHash?: Hex }
  | { phase: "done"; txHash: Hex }
  | { phase: "error"; message: string };

/**
 * GeoCastPool.resolve — admin only. Posts the truth coords + the Merkle
 * root of the (address, amount) leaves. Coords get scaled int32 here so
 * the admin form can pass plain decimal degrees.
 */
export function useResolveOnchain(): {
  status: ResolveOnchainStatus;
  resolve: (args: {
    roundNumber: number;
    answerLat: number;
    answerLng: number;
    merkleRoot: Hex;
  }) => Promise<void>;
} {
  const cfg = getOnchainConfig();
  const { writeContractAsync } = useWriteContract();
  const [status, setStatus] = useState<ResolveOnchainStatus>({ phase: "idle" });

  const resolve = useCallback(
    async ({
      roundNumber,
      answerLat,
      answerLng,
      merkleRoot,
    }: {
      roundNumber: number;
      answerLat: number;
      answerLng: number;
      merkleRoot: Hex;
    }) => {
      try {
        setStatus({ phase: "resolving" });
        const txHash = await writeContractAsync({
          address: cfg.poolAddress,
          abi: geoCastPoolAdminAbi,
          functionName: "resolve",
          args: [
            BigInt(roundNumber),
            toScaledInt32(answerLat),
            toScaledInt32(answerLng),
            merkleRoot,
          ],
        });
        setStatus({ phase: "done", txHash });
      } catch (e) {
        setStatus({
          phase: "error",
          message: (e as Error).message || "resolve failed.",
        });
      }
    },
    [cfg.poolAddress, writeContractAsync],
  );

  return { status, resolve };
}
