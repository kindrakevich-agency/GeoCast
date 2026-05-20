"use client";

import { useCallback, useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import type { Address, Hex } from "viem";
import { erc20Abi, geoCastPoolAbi } from "@/lib/onchain/abi";
import { getOnchainConfig } from "@/lib/onchain/config";
import {
  computeCommit,
  makeSalt,
  stashCommit,
} from "@/lib/onchain/commit";

/**
 * Two-step commit flow:
 *
 *   1. If allowance(usdc, player → pool) < BET, prompt USDC.approve(pool, BET)
 *   2. Call GeoCastPool.commitBet(roundId, commitHash)
 *
 * The hook tracks the phase ("idle" | "approving" | "committing" | "done" |
 * "error") and returns a single `commit({lat, lng})` callable. Salt is
 * generated client-side and stashed in localStorage so reveal can recover.
 */
export type CommitStatus =
  | { phase: "idle" }
  | { phase: "approving"; txHash?: Hex }
  | { phase: "committing"; txHash?: Hex }
  | { phase: "done"; txHash: Hex; salt: Hex }
  | { phase: "error"; message: string };

export function useCommitBet(roundId: number) {
  const cfg = getOnchainConfig();
  const { address } = useAccount();
  const [status, setStatus] = useState<CommitStatus>({ phase: "idle" });

  // Current allowance for pool → if < BET, we need an approve tx first.
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: cfg.usdcAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, cfg.poolAddress] : undefined,
    query: { enabled: Boolean(address && cfg.poolAddress !== "0x0000000000000000000000000000000000000000") },
  });

  const { writeContractAsync } = useWriteContract();
  const [pendingHash, setPendingHash] = useState<Hex | undefined>(undefined);
  useWaitForTransactionReceipt({ hash: pendingHash });

  const commit = useCallback(
    async (coords: { lat: number; lng: number }) => {
      if (!address) {
        setStatus({ phase: "error", message: "Connect a wallet first." });
        return;
      }
      try {
        // Step 1: approve if needed.
        const cur = (allowance ?? 0n) as bigint;
        if (cur < cfg.betMicros) {
          setStatus({ phase: "approving" });
          const approveHash = await writeContractAsync({
            address: cfg.usdcAddress,
            abi: erc20Abi,
            functionName: "approve",
            // Approve a generous amount so the user doesn't pay gas every round.
            // 100 USDC is enough for 100 commits without re-approving.
            args: [cfg.poolAddress, cfg.betMicros * 100n],
            chainId: cfg.chainId,
          });
          setStatus({ phase: "approving", txHash: approveHash });
          setPendingHash(approveHash);
          // Block until the approve confirms before sending commit.
          await waitFor(approveHash);
          await refetchAllowance();
        }

        // Step 2: commit.
        const salt = makeSalt();
        const commitHash = computeCommit({
          player: address as Address,
          lat: coords.lat,
          lng: coords.lng,
          salt,
        });

        setStatus({ phase: "committing" });
        const txHash = await writeContractAsync({
          address: cfg.poolAddress,
          abi: geoCastPoolAbi,
          functionName: "commitBet",
          args: [BigInt(roundId), commitHash],
          chainId: cfg.chainId,
        });
        setStatus({ phase: "committing", txHash });
        setPendingHash(txHash);
        await waitFor(txHash);

        stashCommit(cfg.chainId, roundId, {
          lat: coords.lat,
          lng: coords.lng,
          salt,
          commit: commitHash,
          txHash,
          createdAt: Date.now(),
        });

        setStatus({ phase: "done", txHash, salt });
      } catch (e) {
        setStatus({
          phase: "error",
          message: (e as Error).message || "Commit failed.",
        });
      }
    },
    [address, allowance, cfg, refetchAllowance, roundId, writeContractAsync],
  );

  return { status, commit };
}

// Lightweight tx-wait that doesn't need a hook — used inside `commit` because
// we want sequential awaits, and wagmi's useWaitForTransactionReceipt is
// hook-shaped. waitForTransactionReceipt is re-exported from wagmi/actions
// (wagmi v2's imperative action surface). Omit chainId → wagmi uses the
// currently-connected chain, which matches what the writes targeted.
async function waitFor(hash: Hex): Promise<void> {
  const { waitForTransactionReceipt } = await import("wagmi/actions");
  const { wagmiConfig } = await import("@/lib/wagmi");
  await waitForTransactionReceipt(wagmiConfig, { hash });
}
