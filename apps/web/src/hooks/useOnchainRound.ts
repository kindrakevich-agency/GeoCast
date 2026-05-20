"use client";

import { useReadContract } from "wagmi";
import { geoCastPoolAbi } from "@/lib/onchain/abi";
import { getOnchainConfig } from "@/lib/onchain/config";

export type OnchainRoundState = {
  /** True if rounds(roundId).opensAt > 0 — i.e. createRound() has been called. */
  exists: boolean;
  opensAt: number;
  closesAt: number;
  revealsAt: number;
  resolvedAt: number;
  poolMicros: bigint;
  isLoading: boolean;
  refetch: () => void;
};

/**
 * Read GeoCastPool.rounds(roundId) → packs the tuple into a typed result.
 * Returns exists=false when the round hasn't been mirrored on-chain yet.
 */
export function useOnchainRound(roundNumber: number | null): OnchainRoundState {
  const cfg = getOnchainConfig();
  const { data, isLoading, refetch } = useReadContract({
    address: cfg.poolAddress,
    abi: geoCastPoolAbi,
    functionName: "rounds",
    args: roundNumber !== null ? [BigInt(roundNumber)] : undefined,
    query: {
      enabled: Boolean(roundNumber !== null) && cfg.poolAddress !== "0x0000000000000000000000000000000000000000",
    },
  });

  const tuple = (data ?? [0n, 0n, 0n, 0n, 0n, "0x", 0, 0, false]) as readonly [
    bigint, bigint, bigint, bigint, bigint, `0x${string}`, number, number, boolean,
  ];
  const opensAt = Number(tuple[0]);

  return {
    exists: opensAt > 0,
    opensAt,
    closesAt: Number(tuple[1]),
    revealsAt: Number(tuple[2]),
    resolvedAt: Number(tuple[3]),
    poolMicros: tuple[4],
    isLoading,
    refetch: () => void refetch(),
  };
}
