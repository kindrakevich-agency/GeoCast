"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, apiFetch, getValidToken } from "@/lib/api/client";
import type { ApiPrediction } from "@/lib/api/types";

export type UseMyRoundPredictionResult = {
  /** null = either unauthed, no prediction on this round, or roundId not set yet. */
  prediction: ApiPrediction | null;
  isLoading: boolean;
  error: ApiError | Error | null;
  /** Force a re-fetch — useful when a POST returns 409 (prediction exists
   *  server-side but our client hasn't seen it yet). */
  refetch: () => void;
};

/**
 * Loads /api/rounds/{id}/my-prediction when authed and roundId is set.
 * Returns null when unauthed or when the user hasn't placed on this round.
 *
 * Used by the round page to rehydrate `myPin` across reloads — the local
 * React state is otherwise transient and forgets the placement on refresh.
 */
export function useMyRoundPrediction(
  roundId: string | null | undefined,
): UseMyRoundPredictionResult {
  const [prediction, setPrediction] = useState<ApiPrediction | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [bump, setBump] = useState(0);

  const refetch = useCallback(() => setBump((n) => n + 1), []);

  useEffect(() => {
    if (!roundId) return;
    if (!getValidToken()) return;

    setIsLoading(true);
    const ctrl = new AbortController();
    let cancelled = false;

    (async () => {
      try {
        const data = await apiFetch<ApiPrediction | null>(
          `/rounds/${roundId}/my-prediction`,
          { signal: ctrl.signal },
        );
        if (!cancelled) setPrediction(data);
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
  }, [roundId, bump]);

  return { prediction, isLoading, error, refetch };
}
