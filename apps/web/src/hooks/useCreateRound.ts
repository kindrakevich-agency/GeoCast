"use client";

import { useCallback, useState } from "react";
import { useWriteContract } from "wagmi";
import { baseSepolia, base } from "viem/chains";
import type { Hex } from "viem";
import { geoCastPoolAdminAbi } from "@/lib/onchain/abi";
import { getOnchainConfig } from "@/lib/onchain/config";

export type CreateRoundStatus =
  | { phase: "idle" }
  | { phase: "creating"; txHash?: Hex }
  | { phase: "done"; txHash: Hex }
  | { phase: "error"; message: string };

/**
 * GeoCastPool.createRound — admin only (RESOLVER_ROLE on the contract).
 * The off-chain DB round's `number` becomes the on-chain `roundId`.
 *
 * Reveal window defaults to closesAt + 6h (per docs/game.md §4). Caller
 * supplies the three unix timestamps that mirror rounds.opens_at /
 * closes_at + the reveal window.
 */
export function useCreateRound(): {
  status: CreateRoundStatus;
  create: (args: {
    roundNumber: number;
    opensAt: number;
    closesAt: number;
    revealsAt: number;
  }) => Promise<void>;
} {
  const cfg = getOnchainConfig();
  const { writeContractAsync } = useWriteContract();
  const [status, setStatus] = useState<CreateRoundStatus>({ phase: "idle" });

  const create = useCallback(
    async ({
      roundNumber,
      opensAt,
      closesAt,
      revealsAt,
    }: {
      roundNumber: number;
      opensAt: number;
      closesAt: number;
      revealsAt: number;
    }) => {
      try {
        setStatus({ phase: "creating" });
        // Pin to the configured chain so wagmi prompts the user to switch
        // networks in their wallet if they're on a different one. Without
        // this, MetaMask would send the tx to the currently-connected chain
        // (e.g. Ethereum mainnet) where the contract doesn't exist.
        const targetChain = cfg.chainId === base.id ? base.id : baseSepolia.id;
        const txHash = await writeContractAsync({
          address: cfg.poolAddress,
          abi: geoCastPoolAdminAbi,
          functionName: "createRound",
          args: [
            BigInt(roundNumber),
            BigInt(opensAt),
            BigInt(closesAt),
            BigInt(revealsAt),
          ],
          chainId: targetChain,
        });
        setStatus({ phase: "done", txHash });
      } catch (e) {
        setStatus({
          phase: "error",
          message: (e as Error).message || "createRound failed.",
        });
      }
    },
    [cfg.poolAddress, writeContractAsync],
  );

  return { status, create };
}
