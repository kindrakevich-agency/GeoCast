"use client";

import { useCallback, useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import type { Hex } from "viem";
import { geoCastPoolAbi } from "@/lib/onchain/abi";
import { getOnchainConfig } from "@/lib/onchain/config";
import { loadStashedCommit, toScaledInt32 } from "@/lib/onchain/commit";

export type RevealStatus =
  | { phase: "idle" }
  | { phase: "revealing"; txHash?: Hex }
  | { phase: "done"; txHash: Hex }
  | { phase: "error"; message: string };

/**
 * GeoCastPool.reveal(roundId, lat, lng, salt). Reads the stashed commit
 * (lat/lng/salt) from localStorage so the user doesn't have to re-enter
 * coords. Fails with a clear error if the stash is gone (we'd need a
 * salt-recovery flow then — out of v1 scope).
 */
export function useReveal(roundId: number) {
  const cfg = getOnchainConfig();
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [status, setStatus] = useState<RevealStatus>({ phase: "idle" });

  const reveal = useCallback(async () => {
    if (!address) {
      setStatus({ phase: "error", message: "Connect a wallet first." });
      return;
    }
    const stashed = loadStashedCommit(cfg.chainId, roundId);
    if (!stashed) {
      setStatus({
        phase: "error",
        message:
          "Couldn't find the commit data in this browser. " +
          "If you committed from a different device, reveal there.",
      });
      return;
    }
    try {
      setStatus({ phase: "revealing" });
      const txHash = await writeContractAsync({
        address: cfg.poolAddress,
        abi: geoCastPoolAbi,
        functionName: "reveal",
        args: [
          BigInt(roundId),
          toScaledInt32(stashed.lat),
          toScaledInt32(stashed.lng),
          stashed.salt,
        ],
        chainId: cfg.chainId,
      });
      setStatus({ phase: "done", txHash });
    } catch (e) {
      setStatus({
        phase: "error",
        message: (e as Error).message || "Reveal failed.",
      });
    }
  }, [address, cfg, roundId, writeContractAsync]);

  return { status, reveal };
}
