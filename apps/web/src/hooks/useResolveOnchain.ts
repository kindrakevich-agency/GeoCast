"use client";

import { useCallback, useState } from "react";
import { useWriteContract } from "wagmi";
import { baseSepolia, base } from "viem/chains";
import type { Hex } from "viem";
import { geoCastPoolAdminAbi } from "@/lib/onchain/abi";
import { getOnchainConfig } from "@/lib/onchain/config";
import { toScaledInt32 } from "@/lib/onchain/commit";
import { humanizeWalletError } from "@/lib/onchain/errors";

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
        // Pin chainId so wagmi prompts a wallet network switch if needed.
        const targetChain = cfg.chainId === base.id ? base.id : baseSepolia.id;
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
          chainId: targetChain,
        });
        await waitForReceipt(txHash);
        setStatus({ phase: "done", txHash });
      } catch (e) {
        setStatus({
          phase: "error",
          message: humanizeWalletError(e),
        });
      }
    },
    [cfg.poolAddress, writeContractAsync],
  );

  return { status, resolve };
}

async function waitForReceipt(hash: Hex): Promise<void> {
  const { waitForTransactionReceipt } = await import("wagmi/actions");
  const { wagmiConfig } = await import("@/lib/wagmi");
  await waitForTransactionReceipt(wagmiConfig, { hash });
}
