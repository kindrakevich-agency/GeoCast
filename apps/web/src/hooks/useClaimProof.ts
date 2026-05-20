"use client";

import { useEffect, useState } from "react";
import type { Hex } from "viem";
import { ApiError, apiFetch, getValidToken } from "@/lib/api/client";

export type ClaimProof = {
  roundId: number;
  /** USDC micros as a numeric-string (server side uses uint128). */
  amount: string;
  amountUsdc: number;
  proof: Hex[];
  merkleRoot: Hex;
  distanceKm: number | null;
  rank: number | null;
};

/**
 * GET /api/rounds/{id}/claim-proof. Returns null when the round hasn't
 * been settled yet, when the caller isn't a participant, or when not
 * authed. Caller's typical pattern: iterate over the user's resolved
 * rounds, fire one of these per round, render a Claim button per non-null.
 */
export function useClaimProof(roundId: number | null): {
  proof: ClaimProof | null;
  isLoading: boolean;
  error: ApiError | Error | null;
} {
  const [proof, setProof] = useState<ClaimProof | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | Error | null>(null);

  useEffect(() => {
    if (roundId === null) return;
    if (!getValidToken()) return;

    setIsLoading(true);
    const ctrl = new AbortController();
    let cancelled = false;

    (async () => {
      try {
        const data = await apiFetch<ClaimProof | null>(
          `/rounds/${roundId}/claim-proof`,
          { signal: ctrl.signal },
        );
        if (!cancelled) setProof(data);
      } catch (e) {
        if (cancelled) return;
        if ((e as Error).name === "AbortError") return;
        setError(e as Error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [roundId]);

  return { proof, isLoading, error };
}
